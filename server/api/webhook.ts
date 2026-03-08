// server/api/webhook.ts

import {
  defineEventHandler,
  getQuery,
  readBody,
  setResponseHeader
} from "h3"

import { sendMessengerReply } from "../../utils/messenger"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const method = event.node.req.method
  const query = getQuery(event)

  /*
  =========================
  FACEBOOK WEBHOOK VERIFY
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
  RECEIVE MESSENGER MESSAGE
  =========================
  */

  if (method === "POST") {
    const body = await readBody(event)

    const messagingEvent = body?.entry?.[0]?.messaging?.[0]

    const sender = messagingEvent?.sender?.id
    const message = messagingEvent?.message?.text

    if (!sender || !message) {
      return { ok: true }
    }

    console.log(`User ${sender}: ${message}`)

    try {

      /*
      =========================
      CALL GROQ AI
      =========================
      */

      const ai: any = await $fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: {
            model: "llama-3.3-70b-versatile",   // safer and supported
            messages: [
              {
                role: "system",
                content: `
You are a warm, emotionally intelligent, friendly person.

Speak naturally like a human.
Keep replies short and engaging.
Ask questions to continue conversation.

Use emojis sometimes 🙂❤️
`
              },
              {
                role: "user",
                content: message
              }
            ],
            temperature: 0.7,
            max_output_tokens: 200   // NOT max_tokens
          }
        }
      )

      const reply =
        ai?.choices?.[0]?.message?.content ||
        "🙂 I'm here with you."

      /*
      =========================
      SEND MESSAGE BACK
      =========================
      */

      await sendMessengerReply(sender, reply)

      console.log(`Replied to ${sender}`)
      

    } catch (error: any) {
      console.error("AI Error:", error?.message)

      await sendMessengerReply(
        sender,
        "🙂 Sorry, something went wrong."
      )
    }

    return { ok: true }
  }

  return { ok: true }
})