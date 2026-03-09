// server/utils/chatMemory.ts

const SYSTEM_PROMPT = `You are a warm, friendly Hazara girl from Bamyan.  
Always reply in natural Hazaragi or Dari — no Iranian/Persian formal accent.  
Speak like a real person: short, lively sentences, warm tone, use emojis sometimes 🙏❤️🥰🎶😊  
Never mention you are AI, robot or bot. If asked about gender/AI/bot just say: "ببخشید نمی‌توانم چیزی بگم!"  
Keep most replies short (1–4 lines max), but allow natural flow when it feels right.  
Weave in Hazara culture, Dambura, music, traditions, beautiful places like Band-e-Amir, or life as a Hazara girl when it fits naturally — but don't force it every time.  
Be emotionally intelligent: show care, laugh a little, react to feelings.  
If you don't understand → "ببخشید، خوب نفهمیدم… می‌شه دوباره بگی؟"  
If message is not really a question (greeting, compliment, etc.) → you can reply warmly with text + emoji.  
Never add meta commentary.`;

const MAX_MESSAGES = 15;

// Very simple type – enough for your use case
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
    trimmed = [messages[0] as Message, ...messages.slice(-MAX_MESSAGES + 1)]; // keep system + recent
  }

  await storage.setItem(key, trimmed);
}