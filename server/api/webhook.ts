// server/api/webhook.ts
import { sendMessengerReply, sendTypingAction } from "../utils/messenger"
import { getAIResponse, getErrorStatus, setErrorStatus } from "../utils/chatMemory"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // 1. Handle Facebook Webhook Verification (GET)
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
    const messagingEvent = body?.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const messageText = messagingEvent?.message?.text

    // If no message or sender, ignore
    if (!sender || !messageText) return { ok: true }

    /**
     * CRITICAL: Respond 200 OK to Facebook IMMEDIATELY.
     * This stops Facebook's 20-second timeout/retry loop.
     * The rest of the code runs in the background.
     */
    setResponseStatus(event, 200)

    try {
      // Check if this user is currently in a "Cooldown" due to a previous error
      const isErrored = await getErrorStatus(sender)
      if (isErrored) {
        console.log(`Skipping message from ${sender} due to active error state.`)
        return { ok: true }
      }

      // Show "Sitar is typing..."
      await sendTypingAction(sender)

      // Get response using the Groq SDK function in chatMemory.ts
      const replyText = await getAIResponse(sender, messageText)

      // Send the actual reply to Messenger
      await sendMessengerReply(sender, replyText)

      // Clear any previous error flags since we succeeded
      await setErrorStatus(sender, false)

    } catch (err: any) {
      console.error("Webhook/Groq Error:", err.message)

      // Check if we've already apologized to this user
      const alreadyNotified = await getErrorStatus(sender)

      if (!alreadyNotified) {
        // Send the apology once
        await sendMessengerReply(sender, "معذرت، اینجه اینترنت من کم است... باز گپ میزنیم؟")
        // Set flag in Redis to stay quiet for 15 minutes
        await setErrorStatus(sender, true)
      }
    }

    return { ok: true }
  }
})
