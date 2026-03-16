// server/utils/messenger.ts
export async function sendMessengerReply(senderId: string, text: string) {
  const config = useRuntimeConfig()
  return await $fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.FACEBOOK_PAGE_TOKEN}`, {
    method: "POST",
    body: { recipient: { id: senderId }, message: { text } }
  })
}

export async function sendTypingAction(senderId: string) {
  const config = useRuntimeConfig()
  return await $fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.FACEBOOK_PAGE_TOKEN}`, {
    method: "POST",
    body: { recipient: { id: senderId }, sender_action: "typing_on" }
  }).catch(() => {}) // Ignore errors for typing indicators
}
