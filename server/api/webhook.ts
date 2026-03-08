// server/api/webhook.ts
import { defineEventHandler, getQuery, readBody, setResponseHeader } from "h3"
import { sendMessengerReply } from "../../utils/messenger"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const method = event.node.req.method
  const query = getQuery(event)

  // =========================
  // FACEBOOK WEBHOOK VERIFY
  // =========================
  if (method === "GET") {
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.FACEBOOK_VERIFY_TOKEN) {
      setResponseHeader(event, "Content-Type", "text/plain")
      return query["hub.challenge"]
    }
    return "Verification failed"
  }

  // =========================
  // RECEIVE MESSENGER MESSAGE
  // =========================
  if (method === "POST") {
    const body = await readBody(event)
    const messagingEvent = body?.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const message = messagingEvent?.message?.text?.trim()

    if (!sender || !message) return { ok: true }

    console.log(`User ${sender}: ${message}`)

    try {
      let reply = ""
      const lower = message.toLowerCase()

      // =========================
      // Handle gender/bot/AI questions
      // =========================
      if (/(bot|روبات|ماشین|gender|جنسیت|AI)/i.test(lower)) {
        reply = "من یک دختر هزاره هستم 🙂"
      } else if (/(اسم تو|چی نام داری|your name)/i.test(lower)) {
        reply = "ستاره"
      } else {
        // =========================
        // Call Groq AI with enhanced cultural prompt
        // =========================
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
You are a warm, friendly, and emotionally intelligent Hazara girl.
Always reply in Dari or Hazaragi. Avoid Iranian accent.
Speak naturally like a human, with short lively sentences and occasional emojis 🙂❤️.
Never say you are a robot or AI. If someone asks about gender, bot, or AI, reply: "من یک دختر هزاره هستم".
Do not try to help people or give instructions; act like a smart, curious Hazara girl.
Always talk about Hazara culture, life, music, Dambura, Hazara girls’ situation, traditions, and places in Afghanistan.
Ask engaging questions to continue the conversation.
Add a 1–2 second natural typing delay before replying.
Keep responses warm, expressive, and emotionally intelligent.
                `
                },
                { role: "user", content: message }
              ],
              temperature: 0.7,
              max_output_tokens: 200
            }
          }
        )

        reply = ai?.choices?.[0]?.message?.content?.trim() || "🙂 من ستاره هستم باشما"
      }

      // =========================
      // Typing delay to simulate human
      // =========================
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800))

      // =========================
      // Send reply
      // =========================
      await sendMessengerReply(sender, reply)
      console.log(`Replied to ${sender}: ${reply}`)

    } catch (error: any) {
      console.error("AI Error:", error?.message)
      await sendMessengerReply(sender, "🙂بخشید مه نمیتانم با شما گب بزنم فعلا. ")
    }

    return { ok: true }
  }

  return { ok: true }
})