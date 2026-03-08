// utils/messenger.ts
import { useRuntimeConfig } from '#imports'
import { $fetch } from 'ofetch'

export async function sendMessengerReply(userId: string, text: string) {
  const config = useRuntimeConfig()
  const PAGE_TOKEN = config.FACEBOOK_PAGE_TOKEN

  if (!PAGE_TOKEN) {
    console.error("FACEBOOK_PAGE_TOKEN is missing")
    return
  }

  try {
    await $fetch(
      `https://graph.facebook.com{PAGE_TOKEN}`,
      {
        method: "POST",
        body: {
          recipient: { id: userId },
          message: { text }
        }
      }
    )
  } catch (error: any) {
    // This will help you see WHY it fails in Vercel logs
    console.error("Messenger API Error:", error.data || error.message)
  }
}
