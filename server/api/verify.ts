import {
  getQuery,
  readBody,
  setResponseHeader,
  defineEventHandler
} from "h3"

import { sendMessengerReply } from "../../utils/messenger"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const method = event.method
  const query = getQuery(event)

  /*
  --------------------------------
  1. FACEBOOK WEBHOOK VERIFICATION
  --------------------------------
  */
  if (method === "GET") {
    const mode = query["hub.mode"]
    const token = query["hub.verify_token"]
    const challenge = query["hub.challenge"]

    if (mode === "subscribe" && token === config.FACEBOOK_VERIFY_TOKEN) {
      setResponseHeader(event, "Content-Type", "text/plain")
      return challenge
    }

    return "Verification failed"
  }

  /*
  --------------------------------
  2. RECEIVE FACEBOOK MESSAGES
  --------------------------------
  */
  if (method === "POST") {
    const body = await readBody(event).catch(() => null)

    const messagingEvent = body?.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const message = messagingEvent?.message?.text

    if (!sender || !message) {
      return { ok: true }
    }

    console.log(`Message from ${sender}: ${message}`)

    try {
      /*
      --------------------------------
      3. CALL GROQ AI
      --------------------------------
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
            model: "llama3-70b-8192",
            messages: [
              {
                role: "system",
                content: `
You are a warm, friendly, emotionally intelligent person.

Speak naturally like a human.
Be kind and supportive.

Use short replies.
Ask questions to continue conversation.

Occasionally use light emojis 🙂❤️
`
              },
              {
                role: "user",
                content: message
              }
            ]
          }
        }
      )

      const reply =
        ai?.choices?.[0]?.message?.content || "🙂 I'm here for you."

      /*
      --------------------------------
      4. SEND REPLY TO FACEBOOK
      --------------------------------
      */

      await sendMessengerReply(sender, reply)

      console.log(`Replied to ${sender}`)

    } catch (error: any) {
      console.error("Processing Error:", error?.data || error?.message)

      await sendMessengerReply(
        sender,
        "🙂 Sorry, something went wrong. Please try again."
      )
    }

    /*
    --------------------------------
    FACEBOOK MUST ALWAYS RECEIVE 200
    --------------------------------
    */

    return { ok: true }
  }

  return { ok: true }
})