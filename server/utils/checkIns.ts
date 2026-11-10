// server/utils/checkIns.ts
//
// Sitara checks in on people who went quiet, like a friend would.
//
// Messenger only lets a page message someone within 24 hours of that
// person's last message (outside it, re-engagement messages break the
// platform rules and can get the page restricted). So the check-in goes
// out 20-23 hours after their last message, once per quiet spell: if they
// don't answer it, nothing more is sent until they write again.
//
// Last-message times live in a Redis sorted set (one call finds everyone
// due), which is why this talks to Upstash directly instead of through
// useStorage. A scheduler calls /api/check-ins every 30 minutes.

import { Redis } from '@upstash/redis';
import { createCheckInMessage, saveCheckInMessage } from './chatMemory';
import { sendMessengerReply } from './messenger';

const LAST_SEEN_KEY = 'sitara:lastSeen';

const HOUR = 60 * 60 * 1000;
const CHECK_IN_AFTER_MS = 20 * HOUR;
const CHECK_IN_BEFORE_MS = 23 * HOUR;

// Past the 24-hour window nothing can be sent anyway.
const FORGET_AFTER_MS = 48 * HOUR;

// Each check-in is a model call; this keeps one run well inside the
// serverless time limit. Anyone not reached stays due for the next runs.
const MAX_CHECK_INS_PER_RUN = 5;

let redis: Redis | null = null;

function getRedis() {
  // automaticDeserialization is off because Messenger ids are 16+ digit
  // numbers: parsed as JSON they'd lose precision and point at nobody.
  redis ??= new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    automaticDeserialization: false,
  });
  return redis;
}

export async function recordActivity(senderId: string): Promise<void> {
  await getRedis().zadd(LAST_SEEN_KEY, { score: Date.now(), member: senderId });
}

export type CheckInResult = { sent: number; skipped: number; failed: number };

export async function runCheckIns(now = Date.now()): Promise<CheckInResult> {
  const client = getRedis();
  const storage = useStorage('chat');

  await client.zremrangebyscore(LAST_SEEN_KEY, 0, now - FORGET_AFTER_MS);

  // [id, score, id, score, ...]
  const quiet = await client.zrange<string[]>(
    LAST_SEEN_KEY,
    now - CHECK_IN_BEFORE_MS,
    now - CHECK_IN_AFTER_MS,
    { byScore: true, withScores: true },
  );

  const due: Array<{ senderId: string; lastSeen: number }> = [];
  for (let i = 0; i + 1 < quiet.length && due.length < MAX_CHECK_INS_PER_RUN; i += 2) {
    const senderId = String(quiet[i]);
    const lastSeen = Number(quiet[i + 1]);
    // checkin:<id> holds the last-message time we already checked in on.
    const checkedInFor = await storage.getItem<number>(`checkin:${senderId}`);
    if (checkedInFor === lastSeen) continue;
    due.push({ senderId, lastSeen });
  }

  const result: CheckInResult = { sent: 0, skipped: 0, failed: 0 };

  await Promise.all(due.map(async ({ senderId, lastSeen }) => {
    try {
      // Claimed before sending so overlapping runs never send twice.
      await storage.setItem(`checkin:${senderId}`, lastSeen);

      const text = await createCheckInMessage(senderId);
      if (!text) {
        result.skipped += 1;
        return;
      }

      await sendMessengerReply(senderId, text);
      await saveCheckInMessage(senderId, text);
      result.sent += 1;
    } catch (err: any) {
      console.error('Check-in error:', senderId, err?.data || err?.message);
      result.failed += 1;
    }
  }));

  return result;
}
