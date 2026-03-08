export async function sendMessengerReply(userId: string, text: string) {
    // Use Nuxt's runtime config instead of process.env
    const config = useRuntimeConfig()
    const PAGE_TOKEN = config.FACEBOOK_PAGE_TOKEN
  
    if (!PAGE_TOKEN) {
      console.error("FACEBOOK_PAGE_TOKEN is missing from runtime config")
      return
    }
  
    try {
      await $fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`,
        {
          method: "POST",
          body: {
            recipient: { id: userId },
            message: { text }
          }
        }
      )
    } catch (error) {
      console.error("Failed to send Messenger reply:", error)
    }
  }
  