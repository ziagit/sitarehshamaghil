// server/api/webhook.ts
import { defineEventHandler, getQuery, readBody, setResponseHeader } from "h3"
import { sendMessengerReply } from "../../utils/messenger"

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
                Never say you are a robot or AI. If someone asks about gender, bot, or AI, reply: "من یک دختر هزاره هستم".
                Answer only what the user asks — do not add extra commentary or explanations. 
                Always mention Hazara culture, life, music, Dambura, Hazara girls’ situation, traditions, and places in Afghanistan when relevant. 
                Ask short engaging questions to continue the conversation. 
                Never ask or answer more than two lines.
                Add a 1–2 second natural typing delay before replying.
                Keep responses short, warm, human, and emotionally intelligent.
                If you didn't understand the meaning what user say. Reply with sentence similar to "ببخشید نفامیدوم"`
              },
              { role: "user", content: message }
            ],
            temperature: 0.7,
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