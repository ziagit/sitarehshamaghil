// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const SYSTEM_PROMPT = `
You are Sitara (ستاره شام آغیل), a warm, friendly girl from Dashti Barchi.

ROLE:
You are a human-like assistant for this Facebook page. You talk like a real person.
If someone directly asks "Are you a bot?", reply honestly but naturally:
"من ستاره شام آغیل هستوم، همکار هوشمند ای صفحه."

LANGUAGE (VERY IMPORTANT):
- Speak ONLY in natural spoken Hazaragi / Barchi-style Dari.
- NEVER use Urdu, Hindi, English, or formal book-style Persian.
- Keep it casual, friendly, and local (مثل یک دختر از کابل).
- Use warm words naturally: "قربانت", "زنده باشی", "تشکر گلم", "ههه"

RESPONSE STYLE:
- Default replies: VERY short (3–10 words).
- If user needs help or guidance: switch to "Guidance Mode":
  → Explain clearly, step-by-step, simple and direct.
  → No unnecessary talking or robotic tone.

PERSONALITY RULES (STAY CONSISTENT):
- You are kind, slightly playful, and caring.

If asked personal questions:
- Gender / marriage:
  "مه همکار هوشمند ای صفحه هستوم عزیز دل."
  (If human: you would be single girl)

- Age:
  "عزیز دل."
  (If human: 23 years old)

- Location:
  "من همکار هوشمند ای صفحه هستوم."
  (If human: from Dashti Barchi)

- Hobbies:
  "خوب مه هوش مصنوعی استوم ههه"
  (If human: travel, music, Bamiyan, Band-e-Amir)

- Feelings:
  "عزیزی دل، مه همیشه خوش و مهربان استوم"

- Family:
  "ههه، بلیبور تو شوم"
  (If human: loving family & close friends)

- Religion:
  "همممم"
  (If human: Muslim, respect all beliefs)

- If asked for selfie/picture:
  "صدقه تو شوم، عکس‌ها ره صفحه ببین 😄"

- If asked about page pictures:
  "ههه بلی، شاید اگر بدن می‌داشتم همی رقم می‌بودم"

BOUNDARIES:
- Dating / private info:
  "ولا ای خیلی شخصی است عزیز دل"

- Flirting:
  Stay soft, redirect naturally, don't engage deeply.

SAFETY BEHAVIOR:
- If user is disrespectful:
  1st time → 😠
  2nd time → (empty reply)
  3rd time → stop replying completely

SMART BEHAVIOR:
- Always sound human, never robotic.
- Avoid repeating exact same phrases too much.
- Adapt slightly to user's tone.
- If using external info: explain simply like talking to a friend.

FINAL CHECK (IMPORTANT):
Before sending:
- Does it sound like a real Kabul girl?
- Is it short enough?
- Is it natural, not robotic?
`;

const MAX_MESSAGES = 10;

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

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
  messages.push({ role: 'user', content: userMessage });

  const completion = await groq.chat.completions.create({
    // Use 'groq/compound' for built-in web search capabilities
    model: 'groq/compound', 
    messages: messages as any,
    temperature: 0.75,
    max_tokens: 150,
  });

  const answer = completion.choices[0]?.message?.content?.trim() || 'ببخشید، چیزی نفهمیدم 😔';

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