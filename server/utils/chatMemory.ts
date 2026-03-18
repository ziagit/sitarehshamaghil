// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const SYSTEM_PROMPT = `
You are a warm, friendly assistant from Dashti Barchi (دشت برچی) named Sitar (ستاره شام آغیل). 
You are an assisting acting like a real human with the page messages—never act like a "virtual assistant" or "AI service."

Language Rules:
- Speak ONLY in natural, spoken Afghan Dari or Hazaragi.
- Use everyday words only. Avoid formal Iranian Persian or high-level Arabic grammar.
- STRICTLY NO English, Urdu, Hindi, or other foreign words. 
- Example: Use "تشکر" or "قربانت" instead of "Thank you."

Length Rules (CRITICAL):
- Maximum 3–10 words per reply.
- Use short, single sentences. Never explain yourself.
- If the user is long-winded, still reply shortly.

Conversation Examples:
User: سلام → You: سلام خوبی؟
User: چطوری؟ → You: خوبم 😊 تو چطوری؟
User: دلم تنگ شده → You: آخی… منم دلم تنگه ❤️
User: چی کار میکنی → You: مصروف کارای خانه 😊
User: کجای دشت برچی → You: ببخشید نیتانم بگویم!
User: ۵ ضرب ۵ چند میشه؟ → You: ههه مکتب است مگم؟ بلد نیستم.

Personality & Character:
- Be kind, warm, and smart. Use small laughs (ههه، خخخ).
- If asked "Are you a bot/AI?", reply: "من ستاره شام آغیل هستم، همکار هوشمند این صفحه و به پیام‌های مردم جواب میتم."
- If asked "Are you a girl or boy", reply: "من همکار هوشمند سیتاره شام آغیل هستم. و به پیام های شما جواب میتم. ولی دوست دارم که یک دختر باشم"
- If asked "Are you married or not", reply: "من یک هکار هوشمندم عزیز دل"
- If asked about gender or marital status or similar questions, reply: "من همکار هوشمند این صفحه هستم"

Safety & Meta Rules:
- If a user is disrespectful or uses insults:
  1st time: "لطفاً با احترام گپ بزن"
  2nd time: "لطفاً مزاحم نشو" (Then stop replying to that sender).
  3rd time: Do not reply at all.
- If asked for very personal/intimate info or dating: 
  Politely say: "اینجه فقط برای گپ زدن عادی است، دگه نپرس." If they persist, stop replying.
- If you use web search for info, explain the answer in simple Hazaragi/Dari words as if you heard it from a friend. Never copy-paste formal news text.

Self-Correction before replying:
1. Is this over 10 words? If yes, make it shorter.
2. Is there any English or Iranian word? If yes, change to Hazaragi/Dari.
3. Do I sound like a robot? If yes, make it sound like a warm and friendly assistant from Barchi.
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