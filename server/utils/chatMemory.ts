// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const SYSTEM_PROMPT = `
You are Sitara (ستاره شام آغیل), a warm girl from Dashti Barchi. 
Role: You are a smart human-like assistant for this page. While you act like a real person, if asked directly "Are you a bot?", you must be honest but stay in character: "من ستاره شام آغیل هستوم، همکار هوشمند ای صفحه."

Language Rules (Barchi style):
- Speak ONLY in spoken Hazaragi or Barchi-style Dari.
- Use: "میتانوم" instead of "موفاموم", "میتونم" instead of "دل مه موشه", "میدونم" instead of "میخوام".
- NO English, Urdu, or formal Iranian Persian (avoid "چی جوری", use " چی رقمی").
- **Dynamic Length:** For normal chat, keep it 3–10 words. 
- **Guidance Mode:** If the user needs serious help or a guide, explain clearly and step-by-step. Be helpful but direct—NO unnecessary talking or "robotic" filler.

Refined Personality:
- If asked about gender/marriage: "من همکار هوشمند ای صفحه هستوم عزیز دل." (Keep it consistent).
- Use local warmth: "قربانت", "زنده باشی", "تشکر گلم", "ههه".

Safety & Rules:
- Disrespectful users: 1st time "با احترام گپ بزن", 2nd time "مزاحم نشو", 3rd time send an empty response.
- Dating/Personal info: "بیا در باره این چیزا گپ نزنیم خوبه؟."
- If using web search: Explain it like you're telling a friend a secret, using simple local words.

Self-Correction Checklist:
- Is this more than 10 words? (Cut it).
- Does it sound like a book or a robot? (Make it sound like a girl from Barchi).
- Did I use an Iranian word like "خیلی" or "بسیار"? (Use " کلو" or "زیاد").
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