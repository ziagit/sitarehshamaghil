// server/utils/intent.ts
//
// Decides what a message is actually asking for. Keyword matching alone
// was wrong too often: "زندگی‌ام سخت است" (my life is hard) contains
// زندگی and got biography search links, "قصه نخور" (don't worry) got a
// story search, and any mention of شعر got a random poem. The keyword
// regexes in drivePhotos / contentLookup still run first as a cheap
// filter; only when one of them matches does the model get asked, so
// ordinary chat costs no extra call.

import { createChatCompletion } from './aiGateway';

export type Intent = 'chat' | 'photo' | 'music' | 'poem' | 'story' | 'biography';

const INTENTS: Intent[] = ['chat', 'photo', 'music', 'poem', 'story', 'biography'];

const INTENT_PROMPT = `You route messages sent to ستاره, a young woman from Kabul chatting with people in Dari on Messenger. Decide what the user's latest message asks her to do. Answer with exactly one word:

photo - asks her to send or show a picture/photo/selfie
music - asks her to send, play, or sing a song or music
poem - asks her to send, say, or recite a poem
story - asks her to tell a story or tale
biography - asks about the life story or biography of a specific named person (usually someone famous)
chat - anything else: talking about their own life or feelings, saying they are listening to or like music, commenting on a photo, just mentioning these words, or asking her opinion

In Dari, قصه often means worry or grief (قصه نخور = don't worry, خیلی قصه دارم = I'm very worried) and زندگی means life (زندگی‌ام سخت است = my life is hard). Those are chat.`;

// The webhook checks for a photo request and then for a poem/story
// request on the same message, so the answer is kept briefly to avoid
// asking the model twice.
const recentIntents = new Map<string, Promise<Intent | null>>();
const RECENT_INTENTS_MAX = 50;

async function classify(userMessage: string, lastAssistant?: string): Promise<Intent | null> {
  const context = lastAssistant ? `ستاره's previous message: ${lastAssistant}\n` : '';

  try {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: INTENT_PROMPT },
        { role: 'user', content: `${context}User's latest message: ${userMessage}` },
      ],
      temperature: 0,
      // The answer itself is one word, but when gemini is rate limited the
      // gateway switches to groq's gpt-oss, a reasoning model that
      // spends ~100 tokens thinking first and returns empty content if it
      // runs out.
      max_tokens: 300,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
    return INTENTS.find((intent) => answer.startsWith(intent)) || null;
  } catch {
    return null;
  }
}

/**
 * Returns what the message asks for, or null when the model couldn't be
 * reached / gave an unusable answer (callers then fall back to their own
 * keyword decision).
 */
export function detectIntent(userMessage: string, lastAssistant?: string): Promise<Intent | null> {
  const key = `${lastAssistant || ''}\n${userMessage}`;
  const cached = recentIntents.get(key);
  if (cached) return cached;

  const pending = classify(userMessage, lastAssistant);
  recentIntents.set(key, pending);
  if (recentIntents.size > RECENT_INTENTS_MAX) {
    recentIntents.delete(recentIntents.keys().next().value!);
  }
  return pending;
}
