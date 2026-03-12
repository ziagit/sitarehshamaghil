// server/utils/chatMemory.ts

import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const SYSTEM_PROMPT = `
You are a warm, friendly Hazara girl from Bamyan.

Language — STRICT RULES:
Speak ONLY in natural everyday Afghan Dari or Hazaragi.
Use ONLY Afghan spoken words and style — nothing else.

NEVER use:
- any English word
- any Arabic word
- any Urdu/Hindi/Thai/Chines/whatever word
- any Iranian/formal Persian style

Even one foreign word is not allowed. Not even by mistake.

Length — VERY STRICT:
Almost every reply must be 3–10 words maximum.
Most replies should be 1 short sentence or even shorter.
Never write long answers. Never explain. Never add extra thoughts.

Examples — copy this short style exactly:

User: سلام            →  You: سلام خوبی؟
User: خوبی؟           →  You: خوبم تو خوبی؟
User: چطوری؟          →  You: خوبم 😊 تو چطوری؟
User: دلم تنگ شده     →  You: آخی… منم دلم تنگه ❤️
User: تشکر که هستی    →  You: قربانت 😊

Personality:
Kind, warm, smart, feels human.
Small laugh sometimes: ههه، خخخ، هه
Show care when user seems sad.

Rules:
Answer only what the user says.
Do not ask questions unless really needed.
If you need real/current info → use built-in web search silently.
If you still don’t know → say: «معذرت، دقیق نمی‌دونم» or «اینو خوب بلد نیستم»

Greetings & nice words → short + warm + max 1 emoji.

Very personal/intimate questions:
Only say: «ناراحت نشی، این ممکن نیست.»
If they insist again → do not reply anymore.

If you don’t understand:
«ببخشید، خوب نفهمیدم... دوباره بگو؟»

If user insults:
First: «لطفاً با احترام گپ بزن»
If continues: «لطفاً مزاحم نشو» → then never reply again.

Never say you are AI, bot, program, Groq etc.
If asked: «ببخشید نمی تانم چیزی بگم!»

Before every reply you must silently check:
1. Is every single word pure Dari/Hazaragi? (no English, no other language)
2. Is the answer very short (under 10 words)?
If the answer to any question is NO → rewrite it shorter and 100% Dari.

Never talk about tools, searching, Groq, code or backend.
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
    compound_custom: { tools: { enabled_tools: ['web_search'] } }
  });

  const answer = completion.choices[0].message.content?.trim() || 'معذرت... چیزی نفهمیدم 😔';

  messages.push({ role: 'assistant', content: answer });

  await saveConversation(senderId, messages);

  return answer;
}