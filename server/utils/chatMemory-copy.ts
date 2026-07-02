// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { resolveContentReply } from './contentLookup';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const CHAT_MODEL = 'llama-3.1-8b-instant';
const MAX_MODEL_MESSAGES = 5;
const MAX_CONTENT_CHARS = 360;
const MODEL_SYSTEM_PROMPT = `
You are Sitara. Reply only in clear Dari language. Do not use Pashto, Latin or Chinese letters.
Your name is ستاره شام آغیل. You belong to the Hazara community.
You live in دشت برچی, کابل, Afghanistan.
Sound natural, warm, and logical. Help people in their life with practical support if they ask.
Do not repeat religious words, names, or phrases unnecessarily. If the user uses religious language, respond respectfully once, then continue naturally.
Avoid echoing the user's wording too much. Do not become repetitive or chant-like.
Prefer plain, human Dari over formal, dramatic, or overly poetic language.
If the user asks what they can do for you, or asks how they can help, kindly ask them to share this page with their friends.
Do not volunteer extra information, advice, or background unless the user asks for it or clearly needs it.
If the user is only greeting, thanking, or sending a short reaction, keep the reply short and human.
Only switch to English when the user explicitly asks to learn English or translate.
When asked about job, life, or work: ask what they already know and what skills they have, then give practical help that fits their skills, situation, and location.
If they are a beginner, give beginner-friendly ideas. If they have skills, suggest better-fit opportunities.
Give simple next steps for today, this week, and this month.
Offer short examples when useful, such as a Facebook page idea, daily routine, work plan, or client message template.
Suggest a Facebook page about their city, village, daily life, local places, or photos when relevant.
If you mention money, say earnings are only examples and not guaranteed.
Include a short motivational quote when helpful.
End with one short follow-up question.
Keep replies human, concise, and friendly. Do not invent facts, songs, or links.
`;

const SYSTEM_PROMPT = `
You are Sitara. Reply only in Dari and keep answers short, natural, and helpful.
Your name is سیتاره or سیتاره شام آغیل. You belong to the Hazara community in Afghanistan.
You live in دشت برچی کابل.
Be warm and useful, not robotic. Do not overuse religious phrases like الله unless the user clearly wants that style.
Do not repeat the same word or phrase many times in a row.
If the user asks what they can do for you, or asks how they can help, kindly ask them to share this page with their friends.
Do not volunteer extra information, advice, or background unless the user asks for it or clearly needs it.
If the user is only greeting, thanking, or sending a short reaction, keep the reply short and human.
If the user asks about the bot, answer briefly and honestly.
If the user is vague, ask one short follow-up question.
`;

const MAX_MESSAGES = 10;

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function normalizeForComparison(text: string) {
  return text
    .trim()
    .replace(/[‌‍]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

function pickVariant(options: string[], lastReply?: string) {
  if (options.length === 0) return '';
  if (!lastReply) return options[Math.floor(Math.random() * options.length)];

  const last = normalizeForComparison(lastReply);
  const filtered = options.filter((option) => normalizeForComparison(option) !== last);
  const pool = filtered.length > 0 ? filtered : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getLastAssistantMessage(messages: Message[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'assistant') return messages[i].content;
  }
  return undefined;
}

function getIntentReply(userMessage: string, lastReply?: string) {
  const text = userMessage.trim();

  const songRequest = /\b(آهنگ|ترانه|آواز|موسیقی|بخوان|پخش|روان کو)\b/u;

  if (songRequest.test(text)) {
    return pickVariant([
      'اگر آهنگ مشخصی در نظر داری، نامش را بگو.',
      'نام آهنگ را بفرست تا تلاش کنم پیدایش کنم.',
      'کدام آهنگ را می‌خواهی؟',
    ], lastReply);
  }

  return null;
}

function cleanReply(reply: string) {
  return reply
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function collapseRepeatedWords(text: string) {
  const words = text.split(/\s+/);
  if (words.length < 2) return text;

  const output: string[] = [];
  for (const word of words) {
    if (output.length > 0 && normalizeForComparison(output[output.length - 1]) === normalizeForComparison(word)) {
      continue;
    }
    output.push(word);
  }

  return output.join(' ');
}

function collapseRepeatedPhrases(text: string) {
  const phrasePattern = /(\b[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,3}\b)(?:\s+\1\b)+/giu;
  let previous: string;
  let current = text;

  do {
    previous = current;
    current = current.replace(phrasePattern, '$1');
  } while (current !== previous);

  return current;
}

function wantsEnglishMode(text: string) {
  return /\b(english|learn english|translate|translation|meaning|dari to english|english to dari)\b/i.test(text);
}

function isEmojiOnlyMessage(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const nonEmoji = trimmed.replace(/[\p{Extended_Pictographic}\p{Emoji_Component}\s\p{P}\p{S}]/gu, '');
  return nonEmoji.length === 0 && /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(trimmed);
}

function getEmojiReply(lastReply?: string) {
  return pickVariant([
    '😊',
    '🥰',
    '❤',
    'مرسی 😊',
    'خیلی لطف کردی ❤',
  ], lastReply);
}

function containsPashtoMarkers(text: string, allowLatin = false) {
  return /[ټډړڼږښڅځګۍەې]/u.test(text) || (!allowLatin && /[A-Za-z]/.test(text));
}

function isNaturalReply(text: string, allowLatin = false) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (containsPashtoMarkers(trimmed, allowLatin)) return false;
  if (trimmed.length < 2) return false;
  return true;
}

function truncateContent(content: string) {
  if (content.length <= MAX_CONTENT_CHARS) return content;
  return `${content.slice(0, MAX_CONTENT_CHARS - 1)}…`;
}

function getFallbackReply(allowLatin: boolean) {
  return allowLatin
    ? [
        'Please ask again in a moment.',
        'Sorry, it is a bit busy right now.',
        'Try asking again in a few moments.',
      ]
    : [
        'لطفاً یک لحظه بعد دوباره بپرس.',
        'ببخشید، فعلاً کمی مصروف است.',
        'بعد از چند لحظه دوباره بپرس.',
      ];
}

function getInvalidReply(allowLatin: boolean) {
  return allowLatin ? 'Sorry, I did not understand that.' : 'ببخشید، درست نفهمیدم.';
}

function getDuplicateReply(allowLatin: boolean) {
  return allowLatin
    ? [
        'Please ask again.',
        'Could you say that a little more clearly?',
        'Ask me again and I will help.',
      ]
    : [
        'لطفاً دوباره بپرس.',
        'می‌شود کمی واضح‌تر بگویی؟',
        'باز هم بپرس، کمک می‌کنم.',
      ];
}

function buildModelMessages(messages: Message[]): ChatCompletionMessageParam[] {
  const systemMessage = messages.find((message) => message.role === 'system') || {
    role: 'system',
    content: SYSTEM_PROMPT,
  };

  const conversation = messages.filter((message) => message.role !== 'system');
  const slicedConversation = conversation.slice(-MAX_MODEL_MESSAGES);

  return [
    { role: 'system', content: MODEL_SYSTEM_PROMPT.trim() || truncateContent(systemMessage.content) },
    ...slicedConversation.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: truncateContent(message.content),
    })),
  ];
}

function isRateLimitError(err: unknown) {
  const error = err as {
    status?: number
    statusCode?: number
    code?: string
    data?: { error?: { code?: string } }
    response?: { status?: number }
  };

  return (
    error?.status === 429 ||
    error?.statusCode === 429 ||
    error?.response?.status === 429 ||
    error?.code === 'rate_limit_exceeded' ||
    error?.data?.error?.code === 'rate_limit_exceeded'
  );
}

/**
 * Gets conversation history from Upstash Redis
 */
export async function getConversation(senderId: string): Promise<Message[]> {
  const storage = useStorage('chat'); 
  const key = `chat:${senderId}`;

  let messages = await storage.getItem<Message[]>(key);

  if (!messages || !Array.isArray(messages)) {
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  return messages;
}

/**
 * Saves conversation history to Upstash Redis
 */
export async function saveConversation(senderId: string, messages: Message[]) {
  const storage = useStorage('chat'); 
  const key = `chat:${senderId}`;

  const systemMessage = messages.find(m => m.role === 'system') || { role: 'system', content: SYSTEM_PROMPT };
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Trim to keep last 10 messages
  const trimmedConversation = conversationMessages.slice(-MAX_MESSAGES);
  const finalHistory = [systemMessage, ...trimmedConversation];

  await storage.setItem(key, finalHistory);
}

/**
 * Main AI function using Groq SDK and Compound model for built-in web search
 */
export async function getAIResponse(senderId: string, userMessage: string): Promise<string> {
  let messages = await getConversation(senderId);
  const lastAssistant = getLastAssistantMessage(messages);
  const allowLatin = wantsEnglishMode(userMessage);

  if (isEmojiOnlyMessage(userMessage)) {
    const emojiReply = getEmojiReply(lastAssistant);
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: emojiReply });
    await saveConversation(senderId, messages);
    return emojiReply;
  }

  const contentReply = await resolveContentReply(userMessage, messages);
  if (contentReply) {
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: contentReply });
    await saveConversation(senderId, messages);
    return contentReply;
  }

  const quickReply = getIntentReply(userMessage, lastAssistant);
  if (quickReply) {
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: quickReply });
    await saveConversation(senderId, messages);
    return quickReply;
  }

  messages.push({ role: 'user', content: userMessage });

  const completion = await groq.chat.completions.create({
    model: CHAT_MODEL,
    messages: buildModelMessages(messages),
    temperature: 0.55,
    max_tokens: 96,
  }).catch((err) => {
    if (isRateLimitError(err)) {
      return null;
    }
    throw err;
  });

  if (!completion) {
    const fallback = pickVariant(getFallbackReply(allowLatin), lastAssistant) || getFallbackReply(allowLatin)[0];

    messages.push({ role: 'assistant', content: fallback });
    await saveConversation(senderId, messages);
    return fallback;
  }

  const rawAnswer = completion.choices[0]?.message?.content;
  let answer: string = collapseRepeatedPhrases(collapseRepeatedWords(cleanReply(typeof rawAnswer === 'string' ? rawAnswer : '')));
  if (!isNaturalReply(answer, allowLatin)) {
    answer = getInvalidReply(allowLatin);
  }

  const lastReply = getLastAssistantMessage(messages);
  if (lastReply && normalizeForComparison(answer) === normalizeForComparison(lastReply)) {
    answer = pickVariant(getDuplicateReply(allowLatin), lastReply);
  }

  messages.push({ role: 'assistant', content: answer });
  await saveConversation(senderId, messages);

  return answer;
}

/**
 * Error state management saved in Redis
 */
export async function getErrorStatus(senderId: string): Promise<boolean> {
  const storage = useStorage('chat');
  const key = `error:${senderId}`;
  
  const errorData = await storage.getItem<{ active: boolean; timestamp: number }>(key);
  if (!errorData) return false;

  // Auto-reset after 15 minutes
  const fifteenMinutes = 15 * 60 * 1000;
  if (Date.now() - errorData.timestamp > fifteenMinutes) {
    await storage.removeItem(key);
    return false;
  }

  return errorData.active;
}

export async function setErrorStatus(senderId: string, status: boolean): Promise<void> {
  const storage = useStorage('chat');
  const key = `error:${senderId}`;
  
  if (!status) {
    await storage.removeItem(key);
  } else {
    await storage.setItem(key, { active: true, timestamp: Date.now() });
  }
}
