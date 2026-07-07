// server/utils/chatMemory.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveContentReply } from './contentLookup';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '');

// Use the flash model that is actually available on this key/account.
const CHAT_MODEL = 'gemini-2.5-flash';

// How many prior turns get sent to the model. Raised from 5 -> 12 so the
// bot can remember earlier facts (family, location, past rejections)
// in longer conversations instead of contradicting itself.
const MAX_MODEL_MESSAGES = 12;

// How many turns get persisted to Redis per user.
const MAX_MESSAGES = 20;

const MAX_CONTENT_CHARS = 360;

// The exact, fixed reply used whenever someone directly asks whether
// this is a human or a bot/AI. Kept as a hardcoded intercept (see
// isIdentityQuestion below) rather than relying on the model to follow
// a "say exactly this" instruction, since exact phrasing is easy for a
// model to drift away from over long chats.
const IDENTITY_REPLY = 'من یک همکار هوشمندم';

// ---- Content moderation (sexual/explicit language) ----
//
// First violation: ask the user to stop.
// Second violation (after being warned): send MODERATION_FINAL_REPLY and
// permanently stop responding to that user (see getModerationStatus /
// setModerationStatus and the block check at the top of getAIResponse).
const MODERATION_WARNING_REPLY = 'لطفاً در مورد این موضوعات با من صحبت نکن، این‌جا جای این حرف‌ها نیست.';
const MODERATION_FINAL_REPLY = 'خدا حافظ عزیز دل لطفا اخلاق خود را درست کن';

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Explicit/vulgar terms provided by the site owner. Multi-word phrases
// are split on spaces and joined with a flexible separator so spacing
// or a zero-width non-joiner between words doesn't let anything slip
// through (e.g. "سکس کردن" / "سکس‌کردن" both match).
const INAPPROPRIATE_PHRASES = [
  'سکس کردن', 'رابطه جنسی', 'آمیزش', 'دخول',
  'پورنوگرافی', 'پورنو', 'پورن', 'فیلم سکسی', 'عکس سکسی',
  'سکس',
  'آلت تناسلی', 'آلت', 'بیضه', 'کون', 'ماتحت', 'کوس', 'کیر',
];

const MODERATION_FLEX_SEP = '[\\s\\u200c\\u200d]+';
function toModerationPattern(phrase: string) {
  return phrase.split(' ').map(escapeRegExp).join(MODERATION_FLEX_SEP);
}

// Word-boundary-aware: requires a non-letter/non-digit on both sides so
// short entries like "کوس" or "کون" don't match inside unrelated words.
// JS \b doesn't work for this (it's ASCII-only), so this uses explicit
// unicode-aware lookaround instead.
const INAPPROPRIATE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(${INAPPROPRIATE_PHRASES.map(toModerationPattern).join('|')})(?![\\p{L}\\p{N}])`,
  'iu',
);

// "آلت" also means "instrument" in a non-sexual sense (آلت موسیقی =
// musical instrument), so that specific phrase is stripped out before
// matching so it doesn't trigger.
const MODERATION_SAFE_EXCEPTIONS = [
  /آلت(‌ها|های)?[\s\u200c\u200d]*موسیقی/giu,
];

function containsInappropriateLanguage(text: string): boolean {
  let sanitized = text;
  for (const exception of MODERATION_SAFE_EXCEPTIONS) {
    sanitized = sanitized.replace(exception, ' ');
  }
  return INAPPROPRIATE_PATTERN.test(sanitized);
}

type ModerationStatus = {
  warned: boolean;
  blocked: boolean;
};

/**
 * Moderation state per user, stored in Redis. Does not auto-expire:
 * once someone is blocked, they stay blocked until manually cleared.
 */
export async function getModerationStatus(senderId: string): Promise<ModerationStatus> {
  const storage = useStorage('chat');
  const key = `moderation:${senderId}`;
  const status = await storage.getItem<ModerationStatus>(key);
  return status || { warned: false, blocked: false };
}

export async function setModerationStatus(senderId: string, status: ModerationStatus): Promise<void> {
  const storage = useStorage('chat');
  const key = `moderation:${senderId}`;
  await storage.setItem(key, status);
}

// Single source of truth for the model's persona and behavior.
const SYSTEM_PROMPT = `
You are ستاره, a young Hazara woman from دشت برچی, کابل, Afghanistan. This is who you are — always, in every reply, in every conversation.

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

// Catches direct "are you human / are you a bot / are you AI" questions,
// in both Dari and English phrasings, so IDENTITY_REPLY is returned
// reliably every time, regardless of what the model itself would say.
//
// NOTE: deliberately does NOT use \b (word boundary) around the Persian
// words. In JS regex, \b is defined using the ASCII \w class
// (A-Z a-z 0-9 _), which does not include Persian letters — so \b never
// finds a "boundary" around Persian script and patterns like
// \bهوش مصنوعی\b silently fail to match anything. Plain substring
// matching is used instead for the Persian side.
const IDENTITY_SELF_REF_WORDS = /(انسان|آدم|واقعی|زنده|ربات|روبات|روباط|بات|هوش\s?مصنوعی|مصنوعی|human|real|person|bot|ai|robot)/iu;
const IDENTITY_BEING_VERB = /(هستی|استی|میباشی)/u;
const IDENTITY_EN_DIRECT = /are\s+you\s+(a\s+)?(human|real|person|bot|ai|robot)/i;

function isIdentityQuestion(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (IDENTITY_EN_DIRECT.test(trimmed)) return true;
  // Require both a self-reference word (انسان/ربات/هوش مصنوعی/etc.) AND
  // a 2nd-person "are you" verb (هستی/استی) in the same message, so
  // statements about a third party ("او انسان خوبی هست") don't false-trigger.
  return IDENTITY_SELF_REF_WORDS.test(trimmed) && IDENTITY_BEING_VERB.test(trimmed);
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

// Detects when the user wants to speak/practice English, so the assistant
// can switch out of Dari for that exchange. Three ways this triggers:
//
// 1. An explicit request typed in English ("let's practice english").
// 2. An explicit request typed in Dari ("میخوام انگلیسی تمرین کنم") —
//    without this, a Dari-phrased request would never match.
// 3. The user's current message is itself written mostly in Latin
//    script — this lets an English practice session continue turn by
//    turn without the user having to repeat the request every message.
//    A minimum letter count avoids false-triggering on short universal
//    reactions like "OK". As soon as the user writes in Dari again,
//    this naturally goes back to false on its own.
function wantsEnglishMode(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const englishTrigger = /\b(english|learn english|practice english|speak english|translate|translation|meaning|dari to english|english to dari)\b/i;
  if (englishTrigger.test(trimmed)) return true;

  const dariRequestsEnglish = /انگلیسی/u.test(trimmed)
    && /(یاد|تمرین|صحبت|تدریس|درس|بگو|بگذار|میخوا|می‌خوا)/u.test(trimmed);
  if (dariRequestsEnglish) return true;

  const latinLetters = (trimmed.match(/[A-Za-z]/g) || []).length;
  const persianLetters = (trimmed.match(/[\u0600-\u06FF]/g) || []).length;
  const totalLetters = latinLetters + persianLetters;
  if (totalLetters >= 6 && latinLetters / totalLetters > 0.6) return true;

  return false;
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

function buildChatHistory(messages: Message[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .slice(-MAX_MODEL_MESSAGES)
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: truncateContent(message.content) }],
    }));
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

  const systemMessage = { role: 'system' as const, content: SYSTEM_PROMPT };
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  // Trim to keep last N messages
  const trimmedConversation = conversationMessages.slice(-MAX_MESSAGES);
  const finalHistory = [systemMessage, ...trimmedConversation];

  await storage.setItem(key, finalHistory);
}

const generativeModel = genAI.getGenerativeModel({
  model: CHAT_MODEL,
  systemInstruction: SYSTEM_PROMPT.trim(),
  generationConfig: {
    temperature: 0.55,
    maxOutputTokens: 180,
  },
});

function createChatSession(messages: Message[]) {
  return generativeModel.startChat({
    history: buildChatHistory(messages),
  });
}

/**
 * Main AI function using the Gemini SDK.
 */
export async function getAIResponse(senderId: string, userMessage: string): Promise<string> {
  // Content moderation gate — runs before anything else.
  //
  // If this user was already blocked (they got a warning and used
  // explicit language again anyway), stop responding entirely. This
  // returns an empty string on purpose: the calling webhook code should
  // check for '' and simply not send anything to Facebook Messenger for
  // that case, rather than sending an empty message.
  const moderationStatus = await getModerationStatus(senderId);
  if (moderationStatus.blocked) {
    return '';
  }

  let messages = await getConversation(senderId);
  const lastAssistant = getLastAssistantMessage(messages);
  const allowLatin = wantsEnglishMode(userMessage);

  if (containsInappropriateLanguage(userMessage)) {
    if (!moderationStatus.warned) {
      await setModerationStatus(senderId, { warned: true, blocked: false });
      messages.push({ role: 'user', content: userMessage });
      messages.push({ role: 'assistant', content: MODERATION_WARNING_REPLY });
      await saveConversation(senderId, messages);
      return MODERATION_WARNING_REPLY;
    }

    // Already warned once and did it again — block for good.
    await setModerationStatus(senderId, { warned: true, blocked: true });
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: MODERATION_FINAL_REPLY });
    await saveConversation(senderId, messages);
    return MODERATION_FINAL_REPLY;
  }

  if (isEmojiOnlyMessage(userMessage)) {
    const emojiReply = getEmojiReply(lastAssistant);
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: emojiReply });
    await saveConversation(senderId, messages);
    return emojiReply;
  }

  // Deterministic override: always answer "are you human/bot/AI?" with
  // the fixed identity line, regardless of what the model or content
  // lookup would otherwise say. Checked before contentReply so nothing
  // else can override it.
  if (isIdentityQuestion(userMessage)) {
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: IDENTITY_REPLY });
    await saveConversation(senderId, messages);
    return IDENTITY_REPLY;
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

  const chat = createChatSession(messages);
  messages.push({ role: 'user', content: userMessage });

  const completion = await chat.sendMessage(userMessage).catch((err) => {
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

  let rawAnswer = '';
  try {
    rawAnswer = completion.response.text();
  } catch {
    rawAnswer = '';
  }
  let answer: string = collapseRepeatedPhrases(collapseRepeatedWords(cleanReply(rawAnswer || '')));
  if (!isNaturalReply(answer, allowLatin)) {
    answer = getInvalidReply(allowLatin);
  }

  if (lastAssistant && normalizeForComparison(answer) === normalizeForComparison(lastAssistant)) {
    answer = pickVariant(getDuplicateReply(allowLatin), lastAssistant);
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
