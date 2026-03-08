// server/api/verify.get.ts
import { getQuery, setResponseHeader } from "h3"

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)

  const mode = query["hub.mode"]
  const token = query["hub.verify_token"]
  const challenge = query["hub.challenge"]

  // 1. Check if this is a subscribe request and the token matches
  if (mode === "subscribe" && token === config.FACEBOOK_VERIFY_TOKEN) {
    // 2. CRITICAL: Facebook requires a PLAIN TEXT response
    setResponseHeader(event, "Content-Type", "text/plain")
    
    // 3. Return the challenge string directly
    return challenge 
  }

  // If validation fails, return a 403 Forbidden
  event.node.res.statusCode = 403
  return "Verification failed"
})
