// server/api/webhook.ts
import { sendMessengerReply, sendTypingAction } from "../utils/messenger"
import { extractCommentEvent, sendFacebookCommentReply } from "../utils/facebookComments"
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

    // CRITICAL: Respond 200 OK immediately
    setResponseStatus(event, 200)

    try {
      const storage = useStorage('chat')

      const messagingEvent = body?.entry?.[0]?.messaging?.[0]
      if (messagingEvent) {
        const sender = messagingEvent?.sender?.id
        const messageText = messagingEvent?.message?.text
        const messageId = messagingEvent?.message?.mid

        if (!sender || !messageText || !messageId) return { ok: true }

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
        return { ok: true }
      }

      const commentEvent = extractCommentEvent(body)
      if (commentEvent) {
        const processedKey = `comment:${commentEvent.commentId}`
        const isDuplicate = await storage.getItem(processedKey)
        if (isDuplicate) return { ok: true }

        await storage.setItem(processedKey, true)

        const senderKey = `comment:${commentEvent.authorId || commentEvent.commentId}`
        const replyText = await getAIResponse(senderKey, commentEvent.message)
        await sendFacebookCommentReply({
          commentId: commentEvent.commentId,
          message: replyText,
        })

        return { ok: true }
      }

    } catch (err: any) {
      console.error("System Error:", err.message)

      const fallbackSender = body?.entry?.[0]?.messaging?.[0]?.sender?.id
      if (fallbackSender) {
        const alreadyNotified = await getErrorStatus(fallbackSender)
        if (!alreadyNotified) {
          await sendMessengerReply(fallbackSender, "معذرت... باز گپ میزنیم؟")
          await setErrorStatus(fallbackSender, true) 
        }
      }
    }

    return { ok: true }
  }
})
