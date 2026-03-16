// server/api/webhook.ts
import { sendMessengerReply, sendTypingAction } from "../utils/messenger"
import { getConversation, saveConversation } from "../utils/chatMemory"

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (event.node.req.method === "GET") {
    const query = getQuery(event)
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === config.FACEBOOK_VERIFY_TOKEN) {
      return query["hub.challenge"]
    }
    return "Verification failed"
  }

  if (event.node.req.method === "POST") {
    const body = await readBody(event)
    const messagingEvent = body?.entry?.[0]?.messaging?.[0]
    const sender = messagingEvent?.sender?.id
    const messageText = messagingEvent?.message?.text

    if (!sender || !messageText) return { ok: true }

    // Start "typing" indicator immediately
    await sendTypingAction(sender)

    try {
      let messages = await getConversation(sender)
      messages.push({ role: "user", content: messageText })

      const aiResponse = await $fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.GROQ_API_KEY}` },
        body: {
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.8,
          max_tokens: 150
        }
      }) as any;

      const replyText = aiResponse?.choices?.[0]?.message?.content?.trim() || "ببخشید، باز بگو؟"

      messages.push({ role: "assistant", content: replyText })
      await saveConversation(sender, messages)
      await sendMessengerReply(sender, replyText)

    } catch (err) {
      console.error("Error:", err)
      await sendMessengerReply(sender, "معذرت، اینجه اینترنت من کم است... باز گپ میزنیم؟")
    }

    return { ok: true }
  }
})
