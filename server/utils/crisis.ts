// server/utils/crisis.ts
//
// Messages about suicide or self-harm. Detection is keyword-based on
// purpose: missing one of these is far worse than treating an ordinary
// message with extra care, so there's no model confirmation step that
// could fail or say no. Once triggered, the user stays in crisis mode
// for CRISIS_MODE_MS, because follow-ups ("yes", "I have the pills")
// won't contain the keywords themselves.

const CRISIS_MODE_MS = 24 * 60 * 60 * 1000;

// Optional phone number / contact the page owner trusts (a local
// helpline or organization). Never made up here: if it isn't set, Sitara
// points people to someone they trust or to emergency help instead.
function getHelpContact() {
  return process.env.CRISIS_HELP_CONTACT?.trim() || '';
}

// Matched against the message with ZWNJ removed and spaces collapsed, so
// "می‌خواهم" and "میخواهم" look the same. "بمیرم" alone isn't enough:
// "الهی بمیرم" / "بمیرم برایت" are everyday expressions of affection.
const CRISIS_PATTERNS = [
  /خود ?کشی/u,
  /خود(م|مه|مو|ه)? ?(را|ره|رو)? ?(بکشم|میکشم|می کشم|بکشوم)/u,
  /(میخواهم|میخوام|میخایم|میخواستم|دلم میخواهد|دلم میخواد|کاش|بهتر است|بهتره) ?(که)? ?(بمیرم|مرده باشم|دیگر نباشم|دیگه نباشم|نباشم)/u,
  /(نمیخواهم|نمیخوام|نمیخایم) ?(دیگر|دیگه)? ?زنده/u,
  /زنده ?(ماندن|بودن)? ?(را|ره|رو)? ?(نمیخواهم|نمیخوام)/u,
  /(زندگی|زنده بودن) ?(دیگر|دیگه)? ?(هیچ)? ?(ارزش|معنی|معنا) ?(ندارد|نداره)/u,
  /رگ(م|مه|مو|ه)? ?(خود|خودم)? ?(را|ره|رو)? ?(بزنم|میزنم|ببرم|میبرم)/u,
  /(به )?خود(م|مه|مو)? ?(را|ره|رو)? ?(آسیب|اسیب) ?(بزنم|میزنم|برسانم)/u,
  /(آرزوی|ارزوی) ?مرگ/u,
  /(به )?(آخر|اخر) ?خط ?رسیدم/u,
  /\b(suicid\w*|kill myself|want to die|wanna die|end my life|end it all|self[- ]?harm|hurt myself|cut myself|no reason to live|better off dead)\b/i,
];

function normalize(text: string) {
  return text
    .replace(/[\u200c\u200d]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mentionsSuicideOrSelfHarm(text: string) {
  const normalized = normalize(text);
  return CRISIS_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Extra system instruction for the model while the user is in crisis
 * mode. It takes priority over the style rules in SYSTEM_PROMPT (short
 * replies, no advice), which are wrong for this situation.
 */
export function getCrisisNote() {
  const contact = getHelpContact();
  return [
    'IMPORTANT: The user may be thinking about suicide or hurting themselves. This matters more than every style rule above, including "keep it short" and "no advice".',
    'Reply as ستاره, a caring friend: take it seriously, say you are glad they told you, gently ask whether they are safe right now, and encourage them to reach out today to someone they trust (family, a friend, a doctor) — or to emergency help if they are in danger right now. You may use up to four sentences.',
    contact ? `Tell them they can also call or message: ${contact}` : '',
    'Never describe ways to hurt themselves, never agree that they should die, never lecture or judge. Keep listening and keep the conversation going.',
    'If they are clearly not talking about themselves (for example, news about someone else), just reply normally.',
  ].filter(Boolean).join('\n');
}

/**
 * Fixed reply used when the model can't be reached (or returns nothing
 * usable) while the user is in crisis mode, instead of the usual
 * "busy, ask again" / "didn't understand" lines.
 */
export function getCrisisFallbackReply(allowLatin: boolean) {
  const contact = getHelpContact();
  if (allowLatin) {
    return [
      "I hear how much pain you're in, and it matters to me. Please don't stay alone with this — reach out right now to someone you trust, family, a friend, or a doctor.",
      contact ? `You can also call: ${contact}` : '',
      "I'm here too. Tell me, what happened?",
    ].filter(Boolean).join(' ');
  }
  return [
    'جان، می‌فهمم که خیلی درد داری و این برایم مهم است. لطفاً تنها نمان، همین حالا با کسی که به او اعتماد داری تماس بگیر، فامیل، دوست یا داکتر.',
    contact ? `می‌توانی به این شماره هم زنگ بزنی: ${contact}` : '',
    'من هم این‌جا استم. بگو چی شده؟',
  ].filter(Boolean).join(' ');
}

export async function isInCrisisMode(senderId: string): Promise<boolean> {
  const storage = useStorage('chat');
  const since = await storage.getItem<number>(`crisis:${senderId}`);
  return typeof since === 'number' && Date.now() - since < CRISIS_MODE_MS;
}

export async function startCrisisMode(senderId: string): Promise<void> {
  const storage = useStorage('chat');
  await storage.setItem(`crisis:${senderId}`, Date.now());
}
