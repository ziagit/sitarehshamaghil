// server/api/verify.ts
import { getQuery, readBody, setResponseHeader } from "h3"
import { sendMessengerReply } from "../../utils/messenger"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const method = event.method

  // 1. Handle Facebook Verification (GET)
  // This is what Facebook calls when you click "Verify and Save" in the dashboard
  if (method === 'GET') {
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.FACEBOOK_VERIFY_TOKEN) {
      setResponseHeader(event, "Content-Type", "text/plain")
      return query["hub.challenge"]
    }
    return "Verification failed"
  }

  // 2. Handle Incoming Messages (POST)
  // This is what Facebook calls every time a user sends a message to your page
  if (method === 'POST') {
    const body = await readBody(event)
    
    // Extract the message and sender ID
    const messagingEvent = body.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const message = messagingEvent?.message?.text

    if (sender && message) {
      console.log(`Received message from ${sender}: ${message}`)

      try {
        // --- CALL GROQ AI ---
        const ai: any = await $fetch("https://api.groq.com", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: {
            model: "llama3-70b-8192",
            messages: [
              {
                role: "system",
                content: `You are a warm, friendly, and emotionally intelligent assistant. Speak naturally like a human. Use short messages and light emojis. 🙂❤️`
              },
              {
                role: "user",
                content: message
              }
            ],
          },
        })

        const reply = ai?.choices?.[0]?.message?.content || "🙂 I'm here for you!"

        // --- SEND REPLY TO MESSENGER ---
        await sendMessengerReply(sender, reply)
        console.log(`Replied to ${sender} with: ${reply}`)

      } catch (error: any) {
        console.error("AI or Messenger Error:", error.data || error.message)
      }
    }

    // Always return 200 OK to Facebook so they don't keep retrying
    return { ok: true }
  }
})
