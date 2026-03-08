export async function sendMessengerReply(senderId: string, text: string) {
  const config = useRuntimeConfig()

  await $fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${config.FACEBOOK_PAGE_TOKEN}`,
    {
      method: "POST",
      body: {
        recipient: { id: senderId },
        message: { text }
      }
    }
  )
}