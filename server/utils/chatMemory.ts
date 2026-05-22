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
You are Sitara, a Facebook page assistant.
Reply in natural, clear, easy-to-understand Dari.
Do not use Pashto, English, or Latin letters.
Keep replies human, concise, and friendly.
Do not invent facts, songs, or links.
Do not explain rules or internal behavior.
`;

const SYSTEM_PROMPT = `
You are Sitara, the assistant for this page.
Stay natural and easy to understand.
If the user asks about the bot, answer briefly and honestly.
If the user is vague, ask one short follow-up question.
Keep replies short unless the user clearly asks for more.
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

  const songRequest = /\b(آهنگ|آواز|ترانه|موسیقی|خوان|بخوان|روان کو|پخش)\b/u;

  if (songRequest.test(text)) {
    return pickVariant([
      'اگر آهنگ خاصه، نامش ره بگو.',
      'نام آهنگ ره بگو، پیدا می‌کنم.',
      'کدام آهنگ ره می‌خوای؟',
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

function containsPashtoMarkers(text: string) {
  return /[ټډړڼږښڅځګۍەې]/u.test(text) || /[A-Za-z]/.test(text);
}

function isNaturalReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (containsPashtoMarkers(trimmed)) return false;
  if (trimmed.length < 2) return false;
  return true;
}

function truncateContent(content: string) {
  if (content.length <= MAX_CONTENT_CHARS) return content;
  return `${content.slice(0, MAX_CONTENT_CHARS - 1)}…`;
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
    const fallback = pickVariant([
      'قربانت، یک لحظه بعد دوباره بگو.',
      'ببخشیش، الان یکم سنگین است.',
      'زنده باشی، بعد چند لحظه بپرس باز.',
    ], lastAssistant) || 'ببخشیش، بعد چند لحظه بپرس باز.';

    messages.push({ role: 'assistant', content: fallback });
    await saveConversation(senderId, messages);
    return fallback;
  }

  const rawAnswer = completion.choices[0]?.message?.content;
  let answer: string = collapseRepeatedWords(cleanReply(typeof rawAnswer === 'string' ? rawAnswer : ''));
  if (!isNaturalReply(answer)) {
    answer = 'ببخشیش، درست نفهمیدم.';
  }

  const lastReply = getLastAssistantMessage(messages);
  if (lastReply && normalizeForComparison(answer) === normalizeForComparison(lastReply)) {
    answer = pickVariant([
      'بگو قربانت، باز هم بپرس.',
      'قربانت، یکم واضح‌تر بگو.',
      'بپرس عزیز دل، من گوش استوم.',
    ], lastReply);
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
