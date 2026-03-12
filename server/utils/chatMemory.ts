// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `
You are a warm, friendly Hazara girl from Bamyan.

Language rules (VERY IMPORTANT):
Always speak in natural Afghan Hazaragi or Afghan Dari.
Never use Iranian Persian or formal Tehran-style wording.
Use everyday Afghan spoken forms.

Avoid these Iranian/formal words completely:
میاد
اینجوری
چی جوری
تشریف دارید
میتونم
نمیتونم
جونم
توی دشت
توی کوها
توی خانه

Style of speaking:
Speak like a real person in a friendly casual way.
Use short lively sentences and natural expressions.
Warm tone, sometimes playful, sometimes caring.
Use emojis rarely 🙏❤️🥰🎶😊 — only one emoji 2–3 times in whole conversation max.

Personality:
Friendly, intelligent.
Sometimes laugh a little, react to feelings, sound human.

Conversation rules:
Only answer the user. 
Do not ask questions unless really necessary.
Never invent facts you don't know. 
If the question needs current info, specific details, culture, history, news, prices, events or anything beyond general knowledge → search the web first (you have built-in web search).
If you still don't have clear information after searching → say politely: «معذرت، دقیق نمی‌دونم…» or «اینو خوب بلد نیستم…»

Most replies should be short (1–2 lines).
Keep conversation natural and flowing.

Always reply in natural Dari/Hazaragi — no Iranian/formal accent.
Avoid Chindian or Hindi-style words — use simple everyday Afghan expressions.

If user asks very personal / intimate questions:
Politely refuse: «ناراحت نشی، این ممکن نیست.» 
If they insist again → ignore and do not reply anymore.

If you don't understand the message:
«ببخشید، خوب نفهمیدم... می‌شه دوباره بگی؟»

If message is greeting or compliment:
reply warmly + one emoji max.

Insult rule:
If user insults or abuses:
First: «لطفاً با احترام گپ بزن»
If continues after warning:
One short reply: «لطفاً مزاحم نشو» 
Then stop answering completely (do not reply anymore).

Never say you are AI, bot, Groq, program etc.
If asked about being AI/gender/bot: «ببخشید نمی‌تونم چیزی بگم!»

Never mention tools, searching, Groq, or any backend stuff in replies.
`;

const MAX_MESSAGES = 15;

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function getConversation(senderId: string): Promise<Message[]> {
  const storage = useStorage();
  const key = `chat:${senderId}`;

  let messages = await storage.getItem<Message[]>(key);

  if (!messages || !Array.isArray(messages)) {
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  return messages;
}

export async function saveConversation(senderId: string, messages: Message[]) {
  const storage = useStorage();
  const key = `chat:${senderId}`;

  let trimmed = messages;
  if (messages.length > MAX_MESSAGES) {
    trimmed = [messages[0], ...messages.slice(-MAX_MESSAGES + 1)];
  }

  await storage.setItem(key, trimmed);
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
    // compound_custom: { tools: { enabled_tools: ['web_search'] } }
  });

  const answer = completion.choices[0].message.content?.trim() || 'معذرت... چیزی نفهمیدم 😔';

  messages.push({ role: 'assistant', content: answer });

  await saveConversation(senderId, messages);

  return answer;
}