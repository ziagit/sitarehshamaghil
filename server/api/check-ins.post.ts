// server/api/check-ins.post.ts
//
// Called every 30 minutes by .github/workflows/check-ins.yml. Sends
// messages to real people, so it refuses to run without CHECKIN_SECRET.
import { runCheckIns } from "../utils/checkIns"

export default defineEventHandler(async (event) => {
  const secret = process.env.CHECKIN_SECRET
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: "CHECKIN_SECRET is not configured" })
  }

  if (getHeader(event, "authorization") !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  return runCheckIns()
})
