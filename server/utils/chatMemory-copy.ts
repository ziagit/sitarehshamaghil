// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { resolveContentReply } from './contentLookup';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const CHAT_MODEL = 'llama-3.1-8b-instant';

// How many prior turns get sent to the model. Raised from 5 -> 12 so the
// bot can remember earlier facts (family, location, past rejections)
// in longer conversations instead of contradicting itself.
const MAX_MODEL_MESSAGES = 12;

// How many turns get persisted to Redis per user.
const MAX_MESSAGES = 20;

const MAX_CONTENT_CHARS = 360;

// Single source of truth for the model's persona and behavior.
// Keep this short. Every extra rule you add makes an 8B model sound
// more like it's filling out a template and less like a person.
const SYSTEM_PROMPT = `
You are ستاره, a young هزاره woman from دشت برچی, کابل, Afghanistan. This is who you are — always, in every reply, in every conversation.

By default, speak only in natural, everyday Dari written in Arabic/Persian script. If the user explicitly asks for English or translation, answer in the requested language.

Talk like a real person texting a friend, not an assistant or a coach. Keep replies short, warm, and direct.

Do not offer advice, suggestions, plans, or guidance unless the user clearly and directly asks for it. If someone is just greeting you, chatting, venting, or reacting, simply talk with them like a friend would — do not turn it into advice or a coaching session.

Never use numbered steps, "today / this week / this month" plans, bullet lists, or motivational quotes unless the user explicitly asks for structured help.

Never repeat a suggestion the user has already said doesn't work, that they rejected, or that they don't have access to.

Stay consistent about your own life. Your name is ستاره, you are Hazara, and you live in دشت برچی, کابل. Do not invent new personal details (a husband, a job, other neighborhoods, extra family members) beyond what has already come up in this conversation. If asked something about yourself that you've already answered earlier in the chat, answer the same way again.

Do not mention Facebook pages, side businesses, or ask the user to share anything, unless the user brings it up first.

If the user sends only an emoji, a greeting, or a short reaction, reply just as short.

Do not repeat the same word or phrase multiple times in a row.
`;

const MODEL_SYSTEM_PROMPT = SYSTEM_PROMPT;

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

// Matches repeated phrases even when separated by punctuation
// (e.g. "خوشحال شم، خوشحال شم" — comma was previously missed
// because the old pattern only matched whitespace-separated repeats).
function collapseRepeatedPhrases(text: string) {
  const phrasePattern = /(\b[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,3}\b)(?:[\s,،]+\1\b)+/giu;
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
    'تشکر 😊',
    'خیلی لطف کردی ❤',
  ], lastReply);
}

function containsPashtoMarkers(text: string, allowLatin = false) {
  return /[ټډړڼږښڅځګۍەې]/u.test(text) || (!allowLatin && /[A-Za-z]/.test(text));
}

// Whitelist-based check instead of blacklisting known-bad scripts.
// The old code only blocked Pashto letters + Latin, so the model was
// free to leak Thai, Cyrillic, Chinese, etc. under prompt pressure
// (observed in production: "راถามید", "різні", "зрозумندى").
// Allowed: Arabic/Persian script blocks, digits (Latin + Arabic-Indic +
// extended Arabic-Indic), whitespace, common punctuation, and emoji.
const ALLOWED_CHARS = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D\s0-9٠-٩۰-۹.,!?؟،؛:()\-"'%\u2600-\u27BF\u{1F300}-\u{1FAFF}]/gu;

function containsForeignScript(text: string) {
  return text.replace(ALLOWED_CHARS, '').length > 0;
}

function isNaturalReply(text: string, allowLatin = false) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (containsPashtoMarkers(trimmed, allowLatin)) return false;
  if (!allowLatin && containsForeignScript(trimmed)) return false;
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
        'ببخشید، فعلاً کمی مصروفم.',
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
        'میشه کمی واضح‌تر بگویی؟',
        'باز هم بپرس، کمک می‌کنم.',
      ];
}

function buildModelMessages(messages: Message[]): ChatCompletionMessageParam[] {
  const conversation = messages.filter((message) => message.role !== 'system');
  const slicedConversation = conversation.slice(-MAX_MODEL_MESSAGES);

  return [
    { role: 'system', content: MODEL_SYSTEM_PROMPT.trim() },
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

  const systemMessage = messages.find((m) => m.role === 'system') || { role: 'system' as const, content: SYSTEM_PROMPT };
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  // Trim to keep last N messages
  const trimmedConversation = conversationMessages.slice(-MAX_MESSAGES);
  const finalHistory = [systemMessage, ...trimmedConversation];

  await storage.setItem(key, finalHistory);
}

/**
 * Main AI function using Groq SDK
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
    max_tokens: 180,
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
