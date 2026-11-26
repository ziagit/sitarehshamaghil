// server/api/page-posts.post.ts
//
// Called once a day by .github/workflows/page-posts.yml. Publishes to the
// page, so it refuses to run without CHECKIN_SECRET (same secret as the
// check-ins). Body {"dryRun": true} returns the draft without posting;
// {"force": true} posts even if the last post was under 20 hours ago;
// {"kind": "tip" | "question" | "opportunity" | "poem"} picks the type.
import { POST_KINDS, runPagePost } from "../utils/pagePosts"

export default defineEventHandler(async (event) => {
  const secret = process.env.CHECKIN_SECRET
  if (!secret) {
    throw createError({ statusCode: 503, statusMessage: "CHECKIN_SECRET is not configured" })
  }

  if (getHeader(event, "authorization") !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  }

  const body = await readBody(event).catch(() => null)
  return runPagePost({
    dryRun: body?.dryRun === true,
    force: body?.force === true,
    kind: POST_KINDS.find((kind) => kind === body?.kind),
  })
})
