// server/api/webhook.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const method = event.node.req.method
 
  // --- 1. HANDLE VERIFICATION (GET) ---
  if (method === 'GET') {
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.FACEBOOK_VERIFY_TOKEN) {
      setResponseHeader(event, "Content-Type", "text/plain")
      return query["hub.challenge"]
    }
    return "Verification failed"
  }

  // --- 2. HANDLE MESSAGES (POST) ---
  if (method === 'POST') {
    const body = await readBody(event)
    const messagingEvent = body.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const message = messagingEvent?.message?.text

    if (sender && message) {
      // Your Groq AI logic here...
      // await sendMessengerReply(sender, aiResponse)
    }
    return { ok: true }
  }
})
