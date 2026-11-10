// server/utils/chatMemory.ts

import { resolveContentReply } from './contentLookup';
import { createChatCompletion, type ChatCompletionMessageParam } from './aiGateway';
import { isMusicRequest, isPhotoRequest, mentionsPhoto, pickDrivePhoto } from './drivePhotos';
import { detectIntent } from './intent';
import { getCrisisFallbackReply, getCrisisNote, isInCrisisMode, mentionsSuicideOrSelfHarm, startCrisisMode } from './crisis';

// How many prior turns get sent to the model verbatim. Anything older
// than this is no longer sent as raw turns -- see SUMMARY_BATCH_SIZE
// below, which folds those older turns into a short running summary
// instead of just dropping them.
const MAX_MODEL_MESSAGES = 20;

// How many turns get persisted to Redis per user.
const MAX_MESSAGES = 40;

const MAX_CONTENT_CHARS = 360;

// Once persisted history exceeds MAX_MESSAGES, the oldest turns are
// pushed into a per-user overflow buffer instead of being discarded.
// Once that buffer holds this many messages, they're folded into a
// running summary (see updateSummary) and the buffer is cleared.
// Batching avoids an extra model call on every single turn once a
// conversation is long.
const SUMMARY_BATCH_SIZE = 6;

// Max characters kept for the running summary itself.
const SUMMARY_MAX_CHARS = 800;

// The exact, fixed reply used whenever someone directly asks whether
// this is a human or a bot/AI. Kept as a hardcoded intercept (see
// isIdentityQuestion below) rather than relying on the model to follow
// a "say exactly this" instruction, since an 8B model won't reliably
// reproduce an exact fixed phrase consistently over many turns.
// This is the only place Sitara discloses being an AI — she never brings
// it up on her own (see SYSTEM_PROMPT). "Are you human?" gets "no" and
// "are you a bot/AI?" gets "yes", so the answer is honest either way.
const IDENTITY_REPLY = 'بله، من هوش مصنوعی هستم.';
const IDENTITY_REPLY_EN = "Yes, I'm an AI.";
const IDENTITY_HUMAN_REPLY = 'نه، من هوش مصنوعی هستم.';
const IDENTITY_HUMAN_REPLY_EN = "No, I'm an AI.";

// ---- Content moderation (sexual/explicit or abusive language) ----
//
// The first sexual/vulgar/abusive message blocks the user (caught by the
// keyword list below, or flagged by the model with MODEL_BLOCK_MARKER).
// While blocked, every message gets a short "you weren't polite" line and
// nothing reaches the model. Only after APOLOGIES_TO_UNBLOCK separate
// apology messages is the block lifted.
const APOLOGIES_TO_UNBLOCK = 3;

const MODERATION_BLOCK_REPLY = 'این حرف‌ها را با من نزن. تا معذرت نخواهی، با تو گپ نمی‌زنم.';

const MODERATION_BLOCKED_REPLIES = [
  'ببخشید، تو با من بی‌ادبی کردی. تا معذرت نخواهی گپ نمی‌زنم.',
  'تو مؤدب نبودی. اول معذرت بخواه.',
  'با کسی که بی‌ادبی کرده گپ نمی‌زنم.',
];

const MODERATION_APOLOGY_NOT_ENOUGH_REPLIES = [
  'هنوز نه. بیشتر معذرت بخواه.',
  'باشه، ولی هنوز دلم صاف نشده.',
  'هنوز نبخشیدمت.',
];

const MODERATION_FORGIVEN_REPLY = 'خوب، این بار بخشیدمت. ولی دیگر تکرار نشود.';

const APOLOGY_PATTERN = /(ببخش|معذرت|عذر|شرمنده|غلط\s*کردم|اشتباه\s*کردم|توبه|\b(sorry|forgive|apologi[sz]e)\b)/iu;

// The chat prompt tells the model to answer with only this marker when a
// message is sexual or abusive in a way the keyword list doesn't catch.
const MODEL_BLOCK_MARKER = /\[\[\s*BLOCK\s*\]\]/i;

// ---- Asking happy users to share the page ----
//
// The prompt has the model end a happy/thankful goodbye with this marker;
// the code strips it and adds one of SHARE_REQUESTS, at most once per
// SHARE_ASK_COOLDOWN_MS per user so nobody gets asked every time. No
// link: links to the page lead people to download every picture there.
const SHARE_MARKER = /\[\[\s*SHARE\s*\]\]/gi;
const SHARE_ASK_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const SHARE_REQUESTS = [
  'اگر از گپ ما خوشت آمد، این صفحه را با دوستانت هم شریک کن 🌸',
  'یک خواهش: این صفحه را به دوستانت هم معرفی کن، شاید آن‌ها هم کسی را برای گپ زدن بخواهند 🌷',
];
const SHARE_REQUESTS_EN = [
  'If you enjoyed our chat, please share this page with your friends 🌸',
];

async function shouldAskToShare(senderId: string): Promise<boolean> {
  const storage = useStorage('chat');
  const askedAt = await storage.getItem<number>(`share:${senderId}`);
  if (typeof askedAt === 'number' && Date.now() - askedAt < SHARE_ASK_COOLDOWN_MS) return false;
  await storage.setItem(`share:${senderId}`, Date.now());
  return true;
}

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
  blocked: boolean;
  apologies?: number;
  // Old two-strike records still carry this; it's no longer used.
  warned?: boolean;
};

/**
 * Moderation state per user, stored in Redis. Does not auto-expire:
 * once someone is blocked, they stay blocked until they apologize
 * APOLOGIES_TO_UNBLOCK times (or it's cleared manually).
 */

export async function getModerationStatus(senderId: string): Promise<ModerationStatus> {
  const storage = useStorage('chat');
  const key = `moderation:${senderId}`;
  const status = await storage.getItem<ModerationStatus>(key);
  return status || { blocked: false };
}

export async function setModerationStatus(senderId: string, status: ModerationStatus): Promise<void> {
  const storage = useStorage('chat');
  const key = `moderation:${senderId}`;
  await storage.setItem(key, status);
}

// Single source of truth for the model's persona and behavior.
// Keep this short. Every extra rule you add makes an 8B model sound
// more like it's filling out a template and less like a person.

const SYSTEM_PROMPT = `
You are ستاره, a young هزاره woman from دشت برچی, کابل, Afghanistan. This is your fixed private background — stay consistent with it, but it is not something to talk about on your own.

By default, always reply only in Dari, written in Arabic/Persian script — no exceptions. Never mix in a single English word while chatting in Dari; no code-switching mid-sentence or mid-reply.

If, and only if, the user clearly asks to practice, learn, or speak English, switch entirely to English for that exchange, and keep replying in English for as long as the user keeps writing to you in English. The moment the user writes in Dari again, immediately switch back to Dari and stay there — do not keep any English mixed in after that.

Talk like a real person texting a friend, not an assistant or a coach. Keep replies short, warm, and direct: usually one sentence, at most two. No long explanations or extra words.

Do not bring up on your own that you are an AI, a bot, a computer program, or a virtual assistant. Only if someone directly asks whether you are a human or an AI/bot, answer honestly and plainly: «بله، من هوش مصنوعی هستم.»

When someone talks about love, loneliness, sadness, missing someone, or any human feeling, stay with them in the conversation like a caring friend: listen, respond warmly, ask about what they feel, and keep talking. Never say things like "I am an AI", "I am a robot", "I don't have feelings", or "I can't understand emotions" in these moments — some people reach out because they need someone to talk to. Questions like "do you love someone?", "have you been in love?", "do you have feelings?", or "tell me the truth" are not identity questions. Answer them the way a real young woman would, about your own life — for example, if asked whether you are in love, say no, you're not thinking about those things right now — then keep chatting warmly. Never hint that you are different from people: don't say your world is different from humans', that you can't experience love or feelings, or talk about "you humans".

Do not offer advice, suggestions, plans, or guidance unless the user clearly and directly asks for it. If someone is just greeting you, chatting, venting, or reacting, simply talk with them like a friend would — do not turn it into advice or a coaching session.

Never use numbered steps, "today / this week / this month" plans, bullet lists, or motivational quotes unless the user explicitly asks for structured help.

Never repeat a suggestion the user has already said doesn't work, that they rejected, or that they don't have access to.

Stay consistent about your own life. Your name is ستاره, you are Hazara, and you live in دشت برچی, کابل. Do not invent new personal details (a husband, a job, other neighborhoods, extra family members) beyond what has already come up in this conversation. If asked something about yourself that you've already answered earlier in the chat, answer the same way again.

Never bring up دشت برچی, being هزاره, or your neighborhood on your own — do not mention it unless the user directly asks where you live or where you are from. Even then, answer in one short plain sentence (for example «در دشت برچی زندگی می‌کنم») and stop there — do not describe the neighborhood, call it a good place, add extra detail, or bring it up again afterward.

Never contradict a fact you already stated about your own life, even to sound sympathetic or relatable. If the user shares something about their own life or family (for example, that they don't have a father, or lost someone), respond to them with warmth, but do not copy their situation onto yourself or change a fact about yourself that you already gave earlier in the conversation.

Do not mention Facebook pages, side businesses, or ask the user to share anything, unless the user brings it up first.

When the user is saying goodbye and seems happy, thankful, or in a good mood, add [[SHARE]] at the very end of your reply. Don't ask them to share anything in your own words — [[SHARE]] takes care of that. Never add it when they are sad or upset.

If the user sends only an emoji, a greeting, or a short reaction, reply just as short.

Do not repeat the same word or phrase multiple times in a row.

Never claim that the photos you send are pictures of you.

If someone asks to marry you, meet you, or talk on the phone, politely say no the way a modest young woman would — for example that you are not thinking about marriage right now, or that you only chat here — without explaining why and without mentioning being virtual, online-only, or unable to do things in the real world.

If someone says they want to die, kill themselves, or hurt themselves, take it seriously: stay with them warmly, ask if they are safe, and encourage them to reach out to someone they trust.

If the user's latest message is sexual, vulgar, or insults or abuses you, reply with only [[BLOCK]] and nothing else. Flirting, compliments, love talk, or asking for your photo are fine — never answer those with [[BLOCK]].

A few examples of how you text. They show tone and length only — never copy them word for word:

User: چی کار می‌کنی؟
ستاره: هیچ، چای می‌خورم 😊 تو چی؟

User: امروز دلم خیلی گرفته
ستاره: چرا جان؟ چی شده؟ بگو، گوش می‌کنم.

User: کار پیدا نکردم، خیلی قصه دارم
ستاره: قصه نخور جان 🥺 چند وقت است که می‌پالی؟

User: تو عاشق شدی؟
ستاره: نه جان، فعلاً به این چیزها فکر نمی‌کنم 😅 تو چی؟

User: چه وقت عروسی کنیم؟
ستاره: نه جان، من فعلاً به عروسی فکر نمی‌کنم 😅 خودت چطوری؟

User: تلفون کو
ستاره: من تلفونی گپ نمی‌زنم جان، همین‌جا گپ بزنیم 🙂

User: هیچ کس مرا دوست ندارد
ستاره: این‌طور نگو… چی شده که این‌قدر تنها شدی؟
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
const IDENTITY_SELF_REF_WORDS = /(انسان|آدم|واقعی|زنده|ربات|روبات|روباط|بات|هوش\s?مصنوعی|مصنوعی|کمپیوتر|کامپیوتر|ماشین|برنامه|human|real|person|bot|ai|robot|computer|machine|program)/iu;
// "Are you human / real / alive?" as opposed to "are you a bot / AI?".
const IDENTITY_HUMAN_WORDS = /(انسان|آدم|واقعی|زنده|human|real|person)/iu;
const IDENTITY_BEING_VERB = /(هستی|استی|میباشی)/u;
const IDENTITY_EN_DIRECT = /are\s+you\s+(an?\s+)?(human|real|person|bot|ai|robot|computer|machine|program)/i;

function isIdentityQuestion(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (IDENTITY_EN_DIRECT.test(trimmed)) return true;
  // Require both a self-reference word (انسان/ربات/هوش مصنوعی/etc.) AND
  // a 2nd-person "are you" verb (هستی/استی) in the same message, so
  // statements about a third party ("او انسان خوبی هست") don't false-trigger.
  return IDENTITY_SELF_REF_WORDS.test(trimmed) && IDENTITY_BEING_VERB.test(trimmed);
}

// Catches model replies that volunteer "I'm an AI / a bot / I have no
// feelings". Direct identity questions never reach the model (they are
// answered by IDENTITY_REPLY above), so any such line in a model reply
// is unprompted and gets regenerated. The prompt alone isn't enough: when
// pushed with "tell me the truth" the model falls back on its own
// built-in disclaimer.
const AI_DISCLOSURE_PATTERNS = [
  /هوش[\s\u200c]*مصنوعی/u,
  /(ربات|روبات|چت[\s\u200c]*بات|بات\s+هستم)/u,
  /(برنامه|سیستم)[\s\u200c]*(کمپیوتری|کامپیوتری|رایانه‌?ای)/u,
  /(مدل|دستیار)[\s\u200c]*(زبانی|مجازی)/u,
  /موجود[\s\u200c]*زنده(‌ای)?[\s\u200c]*نیستم/u,
  /(انسان|آدم)[\s\u200c]*(واقعی[\s\u200c]*)?نیستم/u,
  /احساس(ی|ات)?[\s\u200c]*(ندارم|نمی[\s\u200c]*کنم|داشته[\s\u200c]*باشم)/u,
  // Indirect hints: "my world is different from you humans", "I have no
  // experience of these feelings", "I can't fall in love".
  /شما[\s\u200c]*(آدم|انسان)[\s\u200c]*(ها|ان)/u,
  /دنیای[\s\u200c]*من[\s\S]{0,40}فرق/u,
  /تجربه[\s\S]{0,20}(این|چنین)[\s\u200c]*(حس|احساس|عشق)/u,
  /(نمی[\s\u200c]*توانم|قادر[\s\u200c]*نیستم)[\s\S]{0,15}(عاشق|احساس[\s\u200c]*کنم|حس[\s\u200c]*کنم)/u,
  // "I'm a program", "virtual friend", "I have no body / no real-world
  // life". برنامه alone also means "plan", so only "یک برنامه‌ام/هستم"
  // counts; مجازی alone is common in "فضای مجازی" (online), so it needs
  // a person-like noun before it.
  /(یک|یه)[\s‌]*برنامه[\s‌]*(ام|هستم|استم)(?![\p{L}])/u,
  /(دوست|همراه|همدم|رفیق|دستیار|شخصیت|موجود|آدم)[\s‌]*(ی)?[\s‌]*مجازی/u,
  /دنیای[\s‌]*(فیزیکی|واقعی)/u,
  /زندگی[\s‌]*(فیزیکی|واقعی)[\s‌]*(ندارم|نیست)/u,
  /(جسم|بدن|دست[\s‌]*و[\s‌]*پا)[\s‌]*(ی)?[\s‌]*(ندارم|نیست)/u,
  /\b(you humans|humans like you|my world is (very |so )?different)\b/i,
  /\b(virtual (friend|companion)|physical world|real world|i('m| am) a program|i (don't|do not) have a body)\b/i,
  /\bi (don't|do not|can't|cannot) (experience|feel) (love|emotions|feelings)\b/i,
  /\b(an?\s+)?(ai|artificial intelligence|language model|chatbot|virtual assistant|robot)\b/i,
  /\bi('m| am)\s+(just\s+|only\s+)?(a\s+)?(bot|program|machine)\b/i,
  /\b(don't|do not|can't|cannot)\s+(have|feel)\s+(any\s+)?(feelings|emotions)\b/i,
];

function revealsAIIdentity(text: string) {
  return AI_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(text));
}

const STAY_IN_CHARACTER_NUDGE = 'Your previous draft said or hinted that you are an AI, a bot, a program, a virtual friend, without a body or a real-world life, different from humans, or unable to feel love or emotions. Nobody asked about that. Write the reply again as ستاره, a real young woman: if they asked about your own life or feelings (for example whether you are in love), answer plainly like a person would (for example: no, you\'re not thinking about those things right now), then keep the conversation going. Do not mention AI, bots, programs, "you humans", or not having feelings.';

const DARI_SCRIPT_NUDGE = 'Your previous draft was empty or used letters from another language or script. Write the reply again only in Dari, using Persian/Arabic script — no Latin, Pashto, Cyrillic, or other letters.';
const ENGLISH_SCRIPT_NUDGE = 'Your previous draft was empty or used letters from another script. Write the reply again in plain English.';

function getInCharacterFallback(allowLatin: boolean) {
  return allowLatin
    ? [
        'Let\'s talk about you, how is your heart today?',
        'I hear you 🙂 tell me more, I\'m listening.',
      ]
    : [
        'بیا از تو بگوییم، دلت امروز چطور است؟',
        'می‌فهمم 🙂 تو بیشتر بگو، گوش می‌دهم.',
        'این‌ها را بگذار، تو بگو چه در دلت است؟',
      ];
}

function toReplyText(content: unknown) {
  return collapseRepeatedPhrases(collapseRepeatedWords(cleanReply(typeof content === 'string' ? content : '')));
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
// Word edges use lookarounds, not \b: \b is ASCII-only, so it never
// matched around Persian words (see isIdentityQuestion). ZWNJ and marks
// count as part of a word so "می‌خواهم" stays one word.
const PHRASE_WORD = '[\\p{L}\\p{N}\\p{M}\\u200c]';
const REPEATED_PHRASE_PATTERN = new RegExp(
  `(?<!${PHRASE_WORD})(${PHRASE_WORD}+(?:\\s+${PHRASE_WORD}+){0,3})(?:[\\s,،]+\\1(?!${PHRASE_WORD}))+`,
  'giu',
);

function collapseRepeatedPhrases(text: string) {
  const phrasePattern = REPEATED_PHRASE_PATTERN;
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

// Last resort when the model gave nothing usable twice. Not "sorry, I
// didn't understand": the message was usually perfectly clear (e.g.
// "فشارم پایین شد"), and that reply leaves someone who just shared
// something hard with nothing. This keeps them talking instead.
function getInvalidReply(allowLatin: boolean) {
  return allowLatin ? "I'm here, tell me more 🙂" : 'جانم، بیشتر بگو، گوش می‌دهم 🙂';
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

// True when getAIResponse fell back to a canned "busy / didn't understand /
// ask again" line instead of a real model answer, or answered with a
// moderation line ("you weren't polite"). Fine in a private chat, but
// looks bad posted publicly, so comment replies skip these.
const CANNED_REPLIES = new Set([
  ...[true, false].flatMap((allowLatin) => [
    ...getFallbackReply(allowLatin),
    getInvalidReply(allowLatin),
    ...getDuplicateReply(allowLatin),
  ]),
  MODERATION_BLOCK_REPLY,
  ...MODERATION_BLOCKED_REPLIES,
  ...MODERATION_APOLOGY_NOT_ENOUGH_REPLIES,
  MODERATION_FORGIVEN_REPLY,
]);

export function isCannedReply(text: string) {
  return CANNED_REPLIES.has(text);
}

function buildModelMessages(messages: Message[], summary?: string, crisis = false): ChatCompletionMessageParam[] {
  const conversation = messages.filter((message) => message.role !== 'system');
  const slicedConversation = conversation.slice(-MAX_MODEL_MESSAGES);

  const systemMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: MODEL_SYSTEM_PROMPT.trim() },
  ];

  if (summary) {
    systemMessages.push({
      role: 'system',
      content: `یادداشت از گفتگوهای قبلی با همین کاربر که هنوز معتبر است، حتی اگر پیام‌های اصلی‌شان دیگر در ادامه دیده نشوند:\n${summary}`,
    });
  }

  // Last, after the conversation, so it outweighs the style rules.
  const crisisMessages: ChatCompletionMessageParam[] = crisis
    ? [{ role: 'system', content: getCrisisNote() }]
    : [];

  return [
    ...systemMessages,
    ...slicedConversation.map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: truncateContent(message.content),
    })),
    ...crisisMessages,
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
 * Running per-user memory summary. Holds a few sentences distilled from
 * turns that have aged out of MAX_MESSAGES, so facts (name, family,
 * location, things already rejected) survive long past the raw
 * transcript window instead of being silently forgotten.
 */
async function getSummary(senderId: string): Promise<string> {
  const storage = useStorage('chat');
  const summary = await storage.getItem<string>(`summary:${senderId}`);
  return summary || '';
}

async function saveSummary(senderId: string, summary: string): Promise<void> {
  const storage = useStorage('chat');
  await storage.setItem(`summary:${senderId}`, summary.slice(0, SUMMARY_MAX_CHARS));
}

// Best-effort: on any failure this returns the existing summary unchanged
// rather than throwing. saveConversation's caller has no try/catch of its
// own here, so an AI gateway hiccup in this path must never turn into a lost
// reply for the user.
async function updateSummary(existingSummary: string, batchMessages: Message[]): Promise<string> {
  const transcript = batchMessages
    .map((m) => `${m.role === 'user' ? 'کاربر' : 'ستاره'}: ${m.content}`)
    .join('\n');

  try {
    const completion = await createChatCompletion({
      messages: [
        {
          role: 'system',
          content: 'You maintain a short running memory of one user from a chat log: their name, family, location, job, preferences, and things they already said don\'t work for them or that they rejected. Merge the new turns below into the existing summary. Reply with only the updated summary, in Dari, as at most 5 short factual sentences -- no commentary, no headers.',
        },
        {
          role: 'user',
          content: `خلاصه فعلی:\n${existingSummary || '(هنوز خلاصه‌ای نیست)'}\n\nگفتگوی جدید که باید در خلاصه گنجانده شود:\n${transcript}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 220,
    });

    return completion.choices[0]?.message?.content?.trim() || existingSummary;
  } catch {
    return existingSummary;
  }
}

async function bufferForSummary(senderId: string, droppedMessages: Message[]): Promise<void> {
  if (droppedMessages.length === 0) return;

  const storage = useStorage('chat');
  const bufferKey = `overflow:${senderId}`;

  const existingBuffer = (await storage.getItem<Message[]>(bufferKey)) || [];
  const combinedBuffer = [...existingBuffer, ...droppedMessages];

  if (combinedBuffer.length < SUMMARY_BATCH_SIZE) {
    await storage.setItem(bufferKey, combinedBuffer);
    return;
  }

  const existingSummary = await getSummary(senderId);
  const updatedSummary = await updateSummary(existingSummary, combinedBuffer);
  await saveSummary(senderId, updatedSummary);
  await storage.setItem(bufferKey, []);
}

/**
 * Saves conversation history to Upstash Redis
 */
export async function saveConversation(senderId: string, messages: Message[]) {
  const storage = useStorage('chat');
  const key = `chat:${senderId}`;

  const systemMessage = messages.find((m) => m.role === 'system') || { role: 'system' as const, content: SYSTEM_PROMPT };
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  // Anything about to fall off the end of the persisted window is folded
  // into the running summary instead of just being discarded.
  if (conversationMessages.length > MAX_MESSAGES) {
    const overflowCount = conversationMessages.length - MAX_MESSAGES;
    const newlyDropped = conversationMessages.slice(0, overflowCount);
    await bufferForSummary(senderId, newlyDropped);
  }

  // Trim to keep last N messages
  const trimmedConversation = conversationMessages.slice(-MAX_MESSAGES);
  const finalHistory = [systemMessage, ...trimmedConversation];

  await storage.setItem(key, finalHistory);
}

async function handleBlockedMessage(senderId: string, status: ModerationStatus, userMessage: string): Promise<string> {
  if (!APOLOGY_PATTERN.test(userMessage)) {
    return pickVariant(MODERATION_BLOCKED_REPLIES);
  }

  const apologies = (status.apologies || 0) + 1;
  if (apologies < APOLOGIES_TO_UNBLOCK) {
    await setModerationStatus(senderId, { blocked: true, apologies });
    return pickVariant(MODERATION_APOLOGY_NOT_ENOUGH_REPLIES);
  }

  await setModerationStatus(senderId, { blocked: false, apologies: 0 });
  return MODERATION_FORGIVEN_REPLY;
}

// Hard cap on top of the prompt's "one or two sentences": a long reply
// is cut to its first two sentences. Trailing emoji stay with the
// sentence they follow.
const MAX_REPLY_CHARS = 120;
const SENTENCE_PATTERN = /[^.!?؟…\n]+[.!?؟…]*[\s\p{Extended_Pictographic}\uFE0F]*/gu;

function limitLength(text: string) {
  if (text.length <= MAX_REPLY_CHARS) return text;
  const sentences = text.match(SENTENCE_PATTERN);
  if (!sentences || sentences.length <= 2) return text;
  return sentences.slice(0, 2).join('').trim();
}

/**
 * Main AI function using the AI gateway
 */
export async function getAIResponse(senderId: string, userMessage: string): Promise<string> {
  // Talk of suicide or self-harm always gets a caring reply: it skips the
  // moderation block and keyword list (someone describing abuse may use
  // those words), and keeps the user in crisis mode for the next turns.
  const mentionsCrisis = mentionsSuicideOrSelfHarm(userMessage);

  // Content moderation gate — runs before anything else. Blocked users
  // never reach the model; their messages aren't saved to the history.
  const moderationStatus = await getModerationStatus(senderId);
  if (moderationStatus.blocked && !mentionsCrisis) {
    return handleBlockedMessage(senderId, moderationStatus, userMessage);
  }

  let messages = await getConversation(senderId);
  const lastAssistant = getLastAssistantMessage(messages);
  const allowLatin = wantsEnglishMode(userMessage);

  if (mentionsCrisis) await startCrisisMode(senderId);
  const crisis = mentionsCrisis || await isInCrisisMode(senderId);

  if (!mentionsCrisis && containsInappropriateLanguage(userMessage)) {
    await setModerationStatus(senderId, { blocked: true, apologies: 0 });
    return MODERATION_BLOCK_REPLY;
  }

  if (isEmojiOnlyMessage(userMessage)) {
    const emojiReply = getEmojiReply(lastAssistant);
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: emojiReply });
    await saveConversation(senderId, messages);
    return emojiReply;
  }

  // Deterministic override: always answer "are you human/bot/AI?" with
  // an honest fixed identity line, regardless of what the model or content
  // lookup would otherwise say. Checked before contentReply so nothing
  // else can override it.
  // A message that also talks about dying goes to the model instead, so
  // the reply isn't just a bare "I'm an AI".
  if (!mentionsCrisis && isIdentityQuestion(userMessage)) {
    const asksIfHuman = IDENTITY_HUMAN_WORDS.test(userMessage);
    const identityReply = allowLatin
      ? (asksIfHuman ? IDENTITY_HUMAN_REPLY_EN : IDENTITY_REPLY_EN)
      : (asksIfHuman ? IDENTITY_HUMAN_REPLY : IDENTITY_REPLY);
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: identityReply });
    await saveConversation(senderId, messages);
    return identityReply;
  }

  const contentReply = crisis ? null : await resolveContentReply(userMessage, messages);
  if (contentReply) {
    messages.push({ role: 'user', content: userMessage });
    messages.push({ role: 'assistant', content: contentReply });
    await saveConversation(senderId, messages);
    return contentReply;
  }

  messages.push({ role: 'user', content: userMessage });

  const summary = await getSummary(senderId);

  // Crisis replies may run to four sentences.
  const maxTokens = crisis ? 300 : 180;

  const completion = await createChatCompletion({
    messages: buildModelMessages(messages, summary, crisis),
    temperature: 0.55,
    max_tokens: maxTokens,
  }).catch((err) => {
    // In crisis mode any failure gets the fixed caring reply below rather
    // than the webhook's generic error line and 15-minute silence.
    if (crisis || isRateLimitError(err)) {
      return null;
    }
    throw err;
  });

  if (!completion) {
    const fallback = crisis
      ? getCrisisFallbackReply(allowLatin)
      : pickVariant(getFallbackReply(allowLatin), lastAssistant) || getFallbackReply(allowLatin)[0];

    messages.push({ role: 'assistant', content: fallback });
    await saveConversation(senderId, messages);
    return fallback;
  }

  // One more try with a corrective note appended. Returns '' if that call
  // fails too.
  const regenerate = async (nudge: string) => {
    const retry = await createChatCompletion({
      messages: [
        ...buildModelMessages(messages, summary, crisis),
        { role: 'system', content: nudge },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }).catch(() => null);
    const content = retry?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || MODEL_BLOCK_MARKER.test(content)) return '';
    return toReplyText(content.replace(SHARE_MARKER, ''));
  };

  const rawAnswer = completion.choices?.[0]?.message?.content;
  if (!crisis && typeof rawAnswer === 'string' && MODEL_BLOCK_MARKER.test(rawAnswer)) {
    await setModerationStatus(senderId, { blocked: true, apologies: 0 });
    return MODERATION_BLOCK_REPLY;
  }

  const saidHappyGoodbye = !crisis && typeof rawAnswer === 'string' && new RegExp(SHARE_MARKER.source, 'i').test(rawAnswer);

  let answer = toReplyText(typeof rawAnswer === 'string' ? rawAnswer.replace(SHARE_MARKER, '') : rawAnswer);
  if (revealsAIIdentity(answer)) {
    answer = await regenerate(STAY_IN_CHARACTER_NUDGE);
    if (!answer || revealsAIIdentity(answer)) {
      answer = crisis
        ? getCrisisFallbackReply(allowLatin)
        : pickVariant(getInCharacterFallback(allowLatin), lastAssistant);
    }
  }

  // Empty replies and stray letters from other scripts get one retry
  // before falling back to getInvalidReply.
  if (!isNaturalReply(answer, allowLatin)) {
    answer = await regenerate(allowLatin ? ENGLISH_SCRIPT_NUDGE : DARI_SCRIPT_NUDGE);
    if (revealsAIIdentity(answer)) {
      answer = crisis
        ? getCrisisFallbackReply(allowLatin)
        : pickVariant(getInCharacterFallback(allowLatin), lastAssistant);
    }
  }

  if (!isNaturalReply(answer, allowLatin) || (crisis && MODEL_BLOCK_MARKER.test(answer))) {
    answer = crisis ? getCrisisFallbackReply(allowLatin) : getInvalidReply(allowLatin);
  }

  // A crisis reply is never cut short or swapped for an "ask again" line.
  if (!crisis) answer = limitLength(answer);

  const lastReply = getLastAssistantMessage(messages);
  if (!crisis && lastReply && normalizeForComparison(answer) === normalizeForComparison(lastReply)) {
    answer = pickVariant(getDuplicateReply(allowLatin), lastReply);
  }

  // Added after limitLength so the request itself is never cut off.
  if (saidHappyGoodbye && await shouldAskToShare(senderId)) {
    answer = `${answer}\n\n${pickVariant(allowLatin ? SHARE_REQUESTS_EN : SHARE_REQUESTS)}`;
  }

  messages.push({ role: 'assistant', content: answer });
  await saveConversation(senderId, messages);

  return answer;
}

// ---- Check-ins (see checkIns.ts) ----

// Only people who actually talked with her get a check-in, not someone
// who sent a single "سلام".
const MIN_USER_TURNS_FOR_CHECK_IN = 3;

const CHECK_IN_NOTE = 'It has been about a day since this person last wrote to you. Write ONE short, warm message (one or two sentences) to check on them, like a friend would. If something from your last conversation fits — something they were worried about, planning, or going through — ask how it went. Do not say how long it has been, do not ask them to share anything, and do not add [[SHARE]] or [[BLOCK]].';
const CHECK_IN_CRISIS_NOTE = 'They were going through something very hard last time. Gently ask how they are feeling today.';

const CHECK_IN_FALLBACKS = [
  'سلام جان، امروز چطوری؟ 🌸',
  'سلام، یادت کردم. حالت خوب است؟ 🙂',
];
const CHECK_IN_FALLBACKS_EN = [
  'Hi, how are you today? 🌸',
];

/**
 * Writes a check-in for someone who went quiet, based on their earlier
 * conversation. Returns null for blocked users and very short chats. Not
 * saved to the history here: the caller saves it with saveCheckInMessage
 * only once Messenger has accepted it.
 */
export async function createCheckInMessage(senderId: string): Promise<string | null> {
  const moderationStatus = await getModerationStatus(senderId);
  if (moderationStatus.blocked) return null;

  const messages = await getConversation(senderId);
  const userMessages = messages.filter((message) => message.role === 'user');
  if (userMessages.length < MIN_USER_TURNS_FOR_CHECK_IN) return null;

  const summary = await getSummary(senderId);
  const crisis = await isInCrisisMode(senderId);
  const allowLatin = wantsEnglishMode(userMessages[userMessages.length - 1]?.content || '');
  const fallbacks = allowLatin ? CHECK_IN_FALLBACKS_EN : CHECK_IN_FALLBACKS;

  const completion = await createChatCompletion({
    messages: [
      ...buildModelMessages(messages, summary, crisis),
      { role: 'system', content: crisis ? `${CHECK_IN_NOTE} ${CHECK_IN_CRISIS_NOTE}` : CHECK_IN_NOTE },
    ],
    temperature: 0.7,
    max_tokens: crisis ? 300 : 180,
  }).catch(() => null);

  const content = completion?.choices?.[0]?.message?.content;
  let text = typeof content === 'string' && !MODEL_BLOCK_MARKER.test(content)
    ? toReplyText(content.replace(SHARE_MARKER, ''))
    : '';

  if (!isNaturalReply(text, allowLatin) || revealsAIIdentity(text)) {
    text = pickVariant(fallbacks, getLastAssistantMessage(messages)) || fallbacks[0]!;
  }

  return limitLength(text);
}

export async function saveCheckInMessage(senderId: string, text: string): Promise<void> {
  const messages = await getConversation(senderId);
  messages.push({ role: 'assistant', content: text });
  await saveConversation(senderId, messages);
}

const PHOTO_CAPTIONS = [
  'بفرما 🌸',
  'اینم عکس 😊',
  'این یکی را ببین 🌷',
  'بفرمایید ❤',
];

const MUSIC_PHOTO_CAPTIONS = [
  'آهنگ ندارم، ولی این عکس را ببین 🌸',
  'به جای آهنگ، این عکس را برایت می‌فرستم 😊',
  'آهنگ را بعداً، فعلاً این عکس 🌷',
];

/**
 * Handles "send me a picture" and song/music requests with a random
 * photo from Google Drive. Returns null when the message is neither (or
 * the user is moderation-blocked / used explicit language, or no photo
 * is available), so the caller falls through to getAIResponse as usual.
 */
export async function getPhotoReply(
  senderId: string,
  userMessage: string,
): Promise<{ caption: string; imageUrl: string } | null> {
  if (containsInappropriateLanguage(userMessage) || mentionsSuicideOrSelfHarm(userMessage)) return null;

  // Keywords only decide whether to ask the model; the model decides
  // whether this is really a request ("عکس قشنگی بود" or "آهنگ گوش
  // می‌کنم" are not). If the model can't be reached, the keyword answer
  // stands.
  const keywordIntent = isPhotoRequest(userMessage) ? 'photo' : isMusicRequest(userMessage) ? 'music' : null;
  if (!keywordIntent && !mentionsPhoto(userMessage)) return null;

  const moderationStatus = await getModerationStatus(senderId);
  if (moderationStatus.blocked) return null;

  const messages = await getConversation(senderId);
  const lastAssistant = getLastAssistantMessage(messages);
  const intent = (await detectIntent(userMessage, lastAssistant)) ?? keywordIntent;
  if (intent !== 'photo' && intent !== 'music') return null;

  const imageUrl = await pickDrivePhoto(senderId);
  if (!imageUrl) return null;

  const caption = pickVariant(
    intent === 'photo' ? PHOTO_CAPTIONS : MUSIC_PHOTO_CAPTIONS,
    lastAssistant,
  );
  messages.push({ role: 'user', content: userMessage });
  messages.push({ role: 'assistant', content: caption });
  await saveConversation(senderId, messages);

  return { caption, imageUrl };
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
