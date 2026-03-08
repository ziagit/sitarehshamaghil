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
You are a warm, friendly, emotionally intelligent assistant.
Speak naturally like a human.
Keep replies short and engaging.
Ask questions to continue conversation.
Use light emojis 🙂❤️
`
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
        "🙂 I'm here with you."

      /*
        =========================
        5️⃣ SEND REPLY TO MESSENGER
        =========================
      */
      await sendMessengerReply(sender, reply)
      console.log(`Replied to ${sender}`)

    } catch (err: any) {
      console.error("AI Error:", err?.data || err?.message)
      await sendMessengerReply(sender, "🙂 Sorry, something went wrong.")
    }

    return { ok: true }
  }

  return { ok: true }
})