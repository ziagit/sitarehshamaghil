// server/api/webhook.ts
import { defineEventHandler, getQuery, readBody, setResponseHeader } from "h3"
import { sendMessengerReply } from "../utils/messenger"
import { getConversation, saveConversation } from "../utils/chatMemory"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const method = event.node.req.method
  const query = getQuery(event)

  // ── Verification (GET) ────────────────────────────────────────
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

  // ── Incoming message (POST) ───────────────────────────────────
  if (method === "POST") {
    const body = await readBody(event)
    const messagingEvent = body?.entry?.[0]?.messaging?.[0]

    const sender = messagingEvent?.sender?.id
    const messageText = messagingEvent?.message?.text

    if (!sender || !messageText) {
      return { ok: true }
    }

    console.log(`[${sender}] → ${messageText}`)

    try {
      // 1. Load conversation history (includes system prompt if new)
      let messages = await getConversation(sender)

      // 2. Add current user message
      messages.push({ role: "user", content: messageText })

      // 3. Call Groq
      const aiResponse = await $fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: {
            model: "llama-3.3-70b-versatile",
            messages,                      // ← full history is sent here
            temperature: 0.9,              // more lively / natural
            max_tokens: 180,
            top_p: 0.95,
          },
        }
      ) as any;

      const replyText =
        aiResponse?.choices?.[0]?.message?.content?.trim() ||
        "چی کمکی میتانم بکنم؟"

      // 4. Append assistant's reply to history
      messages.push({ role: "assistant", content: replyText })

      // 5. Save updated conversation
      await saveConversation(sender, messages)

      // 6. Fake typing delay (human feel)
      const delayMs = 800 + Math.random() * 1400 // 0.8 – 2.2 seconds
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      // 7. Send reply to Facebook Messenger
      await sendMessengerReply(sender, replyText)

      console.log(`[${sender}] ← ${replyText.substring(0, 60)}${replyText.length > 60 ? "..." : ""}`)

    } catch (err: any) {
      console.error("Groq / Messenger error:", err?.data || err?.message || err)

      const fallback = "🙏 ببخشید، فعلا نمی‌تانم گپ بزنم… بعداً میای؟"
      await sendMessengerReply(sender, fallback)
    }

    return { ok: true }
  }

  return { ok: true }
})