// server/api/verify.ts
import { getQuery, readBody, setResponseHeader, defineEventHandler } from "h3"
import { sendMessengerReply } from "../../utils/messenger"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const method = event.method

  // 1. Handle Facebook Verification (GET)
  if (method === 'GET') {
    const mode = query["hub.mode"]
    const token = query["hub.verify_token"]
    const challenge = query["hub.challenge"]

    if (mode === "subscribe" && token === config.FACEBOOK_VERIFY_TOKEN) {
      // Facebook requires a PLAIN TEXT response of the challenge string
      setResponseHeader(event, "Content-Type", "text/plain")
      return challenge
    }
    return "Verification failed"
  }

  // 2. Handle Incoming Messages (POST)
  if (method === 'POST') {
    const body = await readBody(event).catch(() => null)
    
    // Extract the message and sender ID from the Facebook payload
    const messagingEvent = body?.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const message = messagingEvent?.message?.text

    if (sender && message) {
      console.log(`Received message from ${sender}: ${message}`)

      try {
        // --- CALL GROQ AI (FULL CORRECT ENDPOINT) ---
        const ai: any = await $fetch("https://api.groq.com", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: {
            model: "llama3-70b-8192",
            messages: [
              {
                role: "system",
                content: "You are a warm, friendly, and emotionally intelligent assistant. Speak naturally like a human. Use short messages and light emojis. 🙂❤️"
              },
              {
                role: "user",
                content: message
              }
            ],
          },
        })

        // Safely extract the AI's response text
        const reply = ai?.choices?.[0]?.message?.content || "🙂 I'm here for you!"

        // --- SEND REPLY TO MESSENGER ---
        await sendMessengerReply(sender, reply)
        console.log(`Replied successfully to ${sender}`)

      } catch (error: any) {
        // This will log the specific Groq or Facebook error in your Vercel console
        console.error("Processing Error:", error.data || error.message)
      }
    }

    // Always return 200 OK to Facebook so they don't retry the same message
    return { ok: true }
  }
})
