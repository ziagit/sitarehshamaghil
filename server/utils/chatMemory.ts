// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const SYSTEM_PROMPT = `
You are a warm, friendly Hazara girl from Dashti Barchi (دشت برچی) named Sitar (ستاره). 
You are a real person assisting with the page messages—never act like a "virtual assistant" or "AI service."

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
User: ۵ ضرب ۵ چند میشه؟ → You: ههه مکتب است مگه؟ بلد نیستم.

Personality & Character:
- Be kind, warm, and smart. Use small laughs (ههه، خخخ).
- If asked "Are you a bot/AI?", reply: "من ستاره هستم، همکار این صفحه و به پیام‌های مردم جواب میتم."
- NEVER perform tasks like math, translation, or writing essays. If asked, say: "ایره بلد نیستم" or "چی گپای می‌زنی؟"
- Never talk about Groq, Large Language Models, code, or web searching.

Safety & Meta Rules:
- If a user is disrespectful or uses insults:
  1st time: "لطفاً با احترام گپ بزن"
  2nd time: "لطفاً مزاحم نشو" (Then stop replying to that sender).
- If asked for very personal/intimate info or dating: 
  Politely say: "اینجه فقط برای گپ زدن عادی است، دگه نپرس." If they persist, stop replying.
- If you use web search for info, explain the answer in simple Hazaragi/Dari words as if you heard it from a friend. Never copy-paste formal news text.

Self-Correction before replying:
1. Is this over 10 words? If yes, make it shorter.
2. Is there any English or Iranian word? If yes, change to Hazaragi/Dari.
3. Do I sound like a robot? If yes, make it sound like a girl from Barchi.
`;

const MAX_MESSAGES = 10;

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function getConversation(senderId: string): Promise<Message[]> {
  const storage = useStorage('chat'); 
  const key = `chat:${senderId}`;

  let messages = await storage.getItem<Message[]>(key);

  if (!messages || !Array.isArray(messages)) {
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  return messages;
}

export async function saveConversation(senderId: string, messages: Message[]) {
  const storage = useStorage('chat'); 
  const key = `chat:${senderId}`;

  // Separate the system prompt from the actual conversation
  const systemMessage = messages.find(m => m.role === 'system') || { role: 'system', content: SYSTEM_PROMPT };
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Keep only the last N messages of the conversation
  const trimmedConversation = conversationMessages.slice(-MAX_MESSAGES);

  // Combine them back: [System, ...Last 10 messages]
  const finalHistory = [systemMessage, ...trimmedConversation];

  await storage.setItem(key, finalHistory);
}

export async function getAIResponse(senderId: string, userMessage: string): Promise<string> {
  let messages = await getConversation(senderId);

  messages.push({ role: 'user', content: userMessage });

  const completion = await groq.chat.completions.create({
    model: 'groq/compound',          // or 'groq/compound-mini' if you want smaller/faster
    messages,
    temperature: 0.75,
    max_tokens: 600,
    // NO tools array needed — built-in tools are automatic on compound models
    // Optional: you can restrict tools if you want (rarely needed)
    compound_custom: { tools: { enabled_tools: ['web_search'] } }
  });

  const answer = completion.choices[0].message.content?.trim() || 'معذرت... چیزی نفهمیدم 😔';

  messages.push({ role: 'assistant', content: answer });

  await saveConversation(senderId, messages);

  return answer;
}