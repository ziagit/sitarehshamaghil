// server/api/webhook.ts
import { sendMessengerReply, sendTypingAction } from "../utils/messenger"
import { getAIResponse, getErrorStatus, setErrorStatus } from "../utils/chatMemory"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // 1. Facebook Webhook Verification (GET)
  if (event.node.req.method === "GET") {
    const query = getQuery(event)
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.FACEBOOK_VERIFY_TOKEN) {
      return query["hub.challenge"]
    }
    throw createError({ statusCode: 403, statusMessage: "Verification failed" })
  }

  // 2. Handle Incoming Messages (POST)
  if (event.node.req.method === "POST") {
    const body = await readBody(event)
    
    // FIX: Added the correct array indexing [0]
    const messagingEvent = body?.entry?.[0]?.messaging?.[0]
    
    const sender = messagingEvent?.sender?.id
    const messageText = messagingEvent?.message?.text
    const messageId = messagingEvent?.message?.mid

    if (!sender || !messageText || !messageId) return { ok: true }

    // CRITICAL: Respond 200 OK immediately
    setResponseStatus(event, 200)

    try {
      const storage = useStorage('chat')
      
      // Deduplication: Stop double-processing the same Message ID
      const processedKey = `mid:${messageId}`
      const isDuplicate = await storage.getItem(processedKey)
      if (isDuplicate) return { ok: true }
      
      // Mark as processed (Redis via Upstash)
      await storage.setItem(processedKey, true)

      // Check if user is in "Error Cooldown"
      const isErrored = await getErrorStatus(sender)
      if (isErrored) return { ok: true }

      // Interaction
      await sendTypingAction(sender)

      // AI Logic (Sitar Personality)
      const replyText = await getAIResponse(sender, messageText)

      // Send to Messenger
      await sendMessengerReply(sender, replyText)

      // Success - Clear error status
      await setErrorStatus(sender, false)

    } catch (err: any) {
      console.error("System Error:", err.message)

      const alreadyNotified = await getErrorStatus(sender)
      if (!alreadyNotified) {
        await sendMessengerReply(sender, "معذرت، اینجه اینترنت من کم است... باز گپ میزنیم؟")
        await setErrorStatus(sender, true) 
      }
    }

    return { ok: true }
  }
})
