// server/utils/messenger.ts
export async function sendMessengerReply(senderId: string, text: string) {
  const config = useRuntimeConfig()
  try {
    return await $fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.FACEBOOK_PAGE_TOKEN}`, {
      method: "POST",
      body: { recipient: { id: senderId }, message: { text } },
      // If Facebook doesn't respond in 10s, move on
      timeout: 10000 
    })
  } catch (err: any) {
    console.error("Facebook Send Error:", err.data || err.message)
    throw err // Let the webhook catch this to set the Error Status
  }
}

// Facebook fetches imageUrl itself, so it must be publicly reachable.
export async function sendMessengerImage(senderId: string, imageUrl: string) {
  const config = useRuntimeConfig()
  try {
    return await $fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.FACEBOOK_PAGE_TOKEN}`, {
      method: "POST",
      body: {
        recipient: { id: senderId },
        message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } },
      },
      // Facebook downloads the image before answering, so allow longer
      timeout: 20000
    })
  } catch (err: any) {
    console.error("Facebook Image Send Error:", err.data || err.message)
    throw err
  }
}

export async function sendTypingAction(senderId: string) {
  const config = useRuntimeConfig()
  // We don't 'await' or 'return' this if we want it to be non-blocking
  $fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${config.FACEBOOK_PAGE_TOKEN}`, {
    method: "POST",
    body: { recipient: { id: senderId }, sender_action: "typing_on" },
    timeout: 5000
  }).catch(() => {}) // Always ignore typing errors to keep the bot moving
}
