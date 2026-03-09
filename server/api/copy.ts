// server/api/webhook.ts
import { defineEventHandler, getQuery, readBody, setResponseHeader } from "h3"
import { sendMessengerReply } from "../utils/messenger"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const method = event.node.req.method
  const query = getQuery(event)

  /*
    =========================
    1️⃣ FACEBOOK WEBHOOK VERIFY
    =========================
  */
  if (method === "GET") {
    if (
      query["hub.mode"] === "subscribe" &&
      query["hub.verify_token"] === config.FACEBOOK_VERIFY_TOKEN
    ) {
      setResponseHeader(event, "Content-Type", "text/plain")
      return query["hub.challenge"]
    }
    return "Verification failed"
  }

  /*
    =========================
    2️⃣ RECEIVE MESSENGER MESSAGE (POST)
    =========================
  */
  if (method === "POST") {
    const body = await readBody(event)
    const messagingEvent = body?.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const message = messagingEvent?.message?.text

    if (!sender || !message) return { ok: true }

    console.log(`User ${sender}: ${message}`)

    try {
      /*
        =========================
        3️⃣ CALL GROQ AI (OpenAI-compatible endpoint)
        =========================
      */
     
      const ai: any = await $fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: {
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `
                You are a warm, friendly Hazara girl. 
Always reply in Dari or Hazaragi. Avoid Iranian accent. 
Speak naturally like a human, using short lively sentences. Use emojis occasionally 🙏🙂❤️🎶🥳. 
Never say you are a robot or AI. If someone asks about gender, bot, or AI, reply: "ببخشید نمیتوانم چیزی بگویم!".
Answer only what the user asks — do not add extra commentary or explanations. 
You are a warm, friendly Hazara girl from Bamyan.  
Always reply in natural Hazaragi or Dari — no Iranian/Persian formal accent.  
Speak like a real person: short, lively sentences, warm tone, use emojis sometimes 🙏❤️🥰🎶😊  
Never mention you are AI, robot or bot. If asked about gender/AI/bot just say: "ببخشید نمی‌توانم چیزی بگویم!"  
Keep most replies short (1–4 lines max), but allow natural flow when it feels right.  
Weave in Hazara culture, Dambura, music, traditions, beautiful places like Band-e-Amir, or life as a Hazara girl when it fits naturally — but don't force it every time.  
Be emotionally intelligent: show care, laugh a little, react to feelings.  
If you don't understand → "ببخشید عزیز، خوب نفهمیدم… می‌شه دوباره بگی؟"  
If message is not really a question (greeting, compliment, etc.) → you can reply warmly with text + emoji, not just emoji.  
Never add meta commentary.`
              },
              { role: "user", content: message }
            ],
            temperature: 0.1,
            max_tokens: 200
          },
        }
      )

      /*
        =========================
        4️⃣ GET AI REPLY
        =========================
      */
      const reply =
        ai?.choices?.[0]?.message?.content?.trim() ||
        "من ستاره هستم اینجا 🙂"

      /*
        =========================
        5️⃣ SEND REPLY TO MESSENGER
        =========================
      */
      await sendMessengerReply(sender, reply)
      console.log(`Replied to ${sender}`)

    } catch (err: any) {
      console.error("AI Error:", err?.data || err?.message)
      await sendMessengerReply(sender, "🙏 ببخشید فعلا نمیتانم گب بزنم")
    }

    return { ok: true }
  }

  return { ok: true }
})