// server/utils/pagePosts.ts
//
// Sitara posts on her Facebook page by herself once a day, so the page
// keeps growing without anyone writing posts by hand. Each
// run writes one post, rotating between:
//   tip         - practical help for everyday emotional life, based on a
//                 recent Greater Good Magazine (UC Berkeley) article, so
//                 the ideas come from a real source rather than the
//                 model's guesses
//   question    - one warm open question, so people answer in the
//                 comments (comment replies then keep them talking)
//   opportunity - a scholarship / free course / job from Opportunity Desk
//                 or Opportunities for Youth, with its link, for people
//                 looking for a way forward
//   poem        - a folk poem from the poem library
//
// Research reads those sites' public RSS feeds. Search-page scraping
// (DuckDuckGo) gets flagged as a bot and returns nothing.
//
// Posts are public under the page's name, so they get the same checks as
// chat replies (Dari only, no AI hints) and anything that fails them is
// dropped, never posted half-right. Nothing is published unless
// AUTO_POST_ENABLED is "true": until then each run only returns the draft,
// which is how to see what she'd post before turning it on.
//
// Group posting and messaging people who didn't write first are left out
// on purpose: Facebook removed the Groups API in 2024, doing it through a
// logged-in browser breaks its terms, and unsolicited messages get the
// page restricted. Growth comes from posts worth sharing, comment
// replies, and the share request happy chats already get.

import { createChatCompletion } from './aiGateway';
import { isPublishableDari } from './chatMemory';
import { POEM_LIBRARY } from './poemLibrary';

export type PostKind = 'tip' | 'question' | 'opportunity' | 'poem';

const ROTATION: PostKind[] = ['tip', 'question', 'opportunity', 'tip', 'poem', 'question'];

export const POST_KINDS: PostKind[] = ['tip', 'question', 'opportunity', 'poem'];

const TIP_FEEDS = ['https://greatergood.berkeley.edu/site/rss/articles'];
const OPPORTUNITY_FEEDS = ['https://opportunitydesk.org/feed/', 'https://www.opportunitiesforyouth.org/feed/'];

// Topics for question posts.
const THEMES = [
  'تنهایی',
  'دل‌شکستگی و فراموش کردن یک رابطه',
  'استرس و پریشانی',
  'بی‌خوابی از فکر و خیال',
  'باور به خود',
  'کار پالیدن وقتی مدت‌ها بیکار استی',
  'آموختن یک مهارت تازه',
  'آموختن زبان انگلیسی',
  'فشار و جنجال در خانواده',
  'امید داشتن در روزهای سخت',
  'دوستی و دوست خوب',
  'قهر و عصبانیت',
  'خوشی‌های کوچک هر روز',
  'آرزوها و برنامه‌های آینده',
];

const POEM_INTROS = ['یک دوبیتی برای دل‌های شما 🌸', 'یک دوبیتی از دل مردم ما 🍃', 'دوبیتی امروز ✨'];

const POST_SYSTEM_PROMPT = `You write posts for a Facebook page run by ستاره. Its readers are Afghans of every age, many going through loneliness, heartbreak, unemployment, or hard times at home; the page is there so they feel less alone and find something useful.

Write only in Kabuli Dari, in Persian/Arabic script — no Latin letters at all (write any names in Persian script), no hashtags, no links (the page adds links itself). Sound like a kind friend, not a preacher, coach, or news agency: simple words, short lines, at most two emoji.

Never tell stories about your own life or claim something happened to you. Never mention AI, bots, or the page itself. Nothing political, no religious debate, nothing about ethnic groups, and no medical or legal promises.`;

const MIN_POST_CHARS = 40;
const MAX_POST_CHARS = 900;

// One post a day: a second run soon after the last post (a retried or
// doubled scheduler call) does nothing.
const MIN_GAP_MS = 20 * 60 * 60 * 1000;

const FEED_TIMEOUT_MS = 10000;
// Articles open with a story and get to the advice later, so tips see
// fewer items but more of each; listings put the deadline up front.
const TIP_ITEMS = 4;
const TIP_TEXT_CHARS = 1800;
const OPPORTUNITY_ITEMS = 10;
const OPPORTUNITY_TEXT_CHARS = 700;

const RECENT_THEMES = 8;
const RECENT_SOURCES = 100;
const RECENT_POEMS = 20;

// Kept so comment replies know what the post said (see webhook.ts).
const POST_TEXT_TTL_SECONDS = 60 * 24 * 60 * 60;

type Draft = {
  kind: PostKind;
  message: string;
  // Attached to the post (opportunities only: the tip articles are in English).
  link?: string;
  // Article the post was based on, so it isn't used twice.
  source?: string;
  theme?: string;
};

export type PagePostResult =
  | { status: 'posted'; id: string; draft: Draft }
  | { status: 'draft'; draft: Draft }
  | { status: 'skipped'; reason: string };

type FeedItem = { title: string; link: string; text: string };

// items must not be empty.
function pickUnused<T>(items: T[], used: string[], key: (item: T) => string): T {
  const unused = items.filter((item) => !used.includes(key(item)));
  const pool = unused.length > 0 ? unused : items;
  return pool[Math.floor(Math.random() * pool.length)] as T;
}

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function readTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!match) return '';
  const raw = (match[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '');
  // Entities first: some feeds escape their HTML (&lt;p&gt;).
  return decodeEntities(decodeEntities(raw).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    const xml = await $fetch<string>(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SitaraPageBot/1.0)' },
      responseType: 'text',
      timeout: FEED_TIMEOUT_MS,
    });
    const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
    return items
      .map((item) => ({
        title: readTag(item, 'title'),
        link: readTag(item, 'link'),
        text: readTag(item, 'content:encoded') || readTag(item, 'description'),
      }))
      .filter((item) => item.title && /^https?:\/\//.test(item.link));
  } catch (err: any) {
    console.error('Feed error:', url, err?.message);
    return [];
  }
}

async function freshFeedItems(urls: string[], usedSources: string[], count: number) {
  const feeds = await Promise.all(urls.map(fetchFeed));
  // Interleaved so each feed gets a turn among the first items.
  const merged: FeedItem[] = [];
  for (let i = 0; feeds.some((feed) => i < feed.length); i += 1) {
    for (const feed of feeds) {
      const item = feed[i];
      if (item) merged.push(item);
    }
  }
  return merged.filter((item) => !usedSources.includes(item.link)).slice(0, count);
}

function formatItems(items: FeedItem[], textChars: number) {
  return items
    .map((item, index) => `${index + 1}. ${item.title}\n${item.text.slice(0, textChars)}`)
    .join('\n\n');
}

function cleanPost(text: string) {
  return text
    .replace(/#[\p{L}\p{N}_‌]+/gu, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isPostable(text: string) {
  return text.length >= MIN_POST_CHARS && text.length <= MAX_POST_CHARS && isPublishableDari(text);
}

// Two tries, since the model sometimes slips in Latin letters.
async function writePost<T>(instruction: string, check: (content: string) => T | null): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await createChatCompletion({
      messages: [
        { role: 'system', content: POST_SYSTEM_PROMPT },
        { role: 'user', content: instruction },
      ],
      max_tokens: 600,
      // Choosing from the feed items and staying within them takes more care than a chat reply.
      effort: 'medium',
    }).catch((err) => {
      console.error('Page post model error:', err?.message);
      return null;
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') continue;
    const result = check(content);
    if (result) return result;
    console.warn('Page post draft rejected:', content.slice(0, 300));
  }
  return null;
}

// The model answers "PICK: <n>" and then the post, or "PICK: 0".
async function writeFromItems(items: FeedItem[], textChars: number, instruction: string) {
  if (items.length === 0) return null;

  return writePost(`${instruction}

Reply in exactly this form:
PICK: <number of the item>
<the post>

If none of them fit, reply only: PICK: 0

Items:
${formatItems(items, textChars)}`, (content) => {
    const match = content.match(/PICK:\s*(\d+)/i);
    const item = match ? items[Number(match[1]) - 1] : undefined;
    if (!item) return null;
    const message = cleanPost(content.replace(/PICK:\s*\d+/i, ''));
    return isPostable(message) ? { message, item } : null;
  });
}

async function draftTip(usedSources: string[]): Promise<Draft | null> {
  const items = await freshFeedItems(TIP_FEEDS, usedSources, TIP_ITEMS);
  const result = await writeFromItems(items, TIP_TEXT_CHARS, `Below are recent articles from a psychology magazine. Choose ONE that offers ideas an ordinary young person in Afghanistan could use for loneliness, sadness, stress, relationships, family, friendship, hope, or self-worth. Skip ones about a specific country's politics, race, policy, or workplace, and ones that need money, therapists, or things they won't have.

Then write the post, at most eight short lines: two or three practical ideas taken only from that article (don't add facts, numbers, studies, or names that aren't in it, and don't name the article or magazine), and end with one short question inviting people to share their own experience in the comments.`);

  return result ? { kind: 'tip', message: result.message, source: result.item.link } : null;
}

async function draftOpportunity(usedSources: string[], now: Date): Promise<Draft | null> {
  const items = await freshFeedItems(OPPORTUNITY_FEEDS, usedSources, OPPORTUNITY_ITEMS);
  const result = await writeFromItems(items, OPPORTUNITY_TEXT_CHARS, `Today is ${now.toISOString().slice(0, 10)}. Below are recent listings of scholarships, courses, trainings, jobs, and competitions. Choose ONE that people from Afghanistan can apply to: open to all nationalities, to developing countries, or to Afghans, and doable from Afghanistan or open to international applicants. Skip anything whose deadline has passed or isn't stated, anything for a specific other country's citizens, business accelerators, and anything that costs money to apply.

Then write the post in two to four lines: what it is, who can apply, what it gives, and the deadline — only as the listing states them — and tell people to read the link for the details and to apply on the official website.`);

  return result
    ? { kind: 'opportunity', message: result.message, link: result.item.link, source: result.item.link }
    : null;
}

async function draftQuestion(theme: string): Promise<Draft | null> {
  const message = await writePost(
    `Write a very short post (one or two lines) that asks readers one warm, open question about ${theme}, so they want to answer in the comments. Not a quiz and not advice. Reply with the post only.`,
    (content) => {
      const text = cleanPost(content);
      return text.length >= 15 && text.length <= 300 && isPublishableDari(text) ? text : null;
    },
  );

  return message ? { kind: 'question', message, theme } : null;
}

function draftPoem(recentPoems: string[]): Draft | null {
  if (POEM_LIBRARY.length === 0) return null;
  const poem = pickUnused(POEM_LIBRARY, recentPoems, (p) => p.title);

  const lines = poem.text.split('\n').map((line) => line.trim()).filter(Boolean);
  const intro = POEM_INTROS[Math.floor(Math.random() * POEM_INTROS.length)];
  return { kind: 'poem', message: `${intro}\n\n${lines.join('\n')}`, theme: poem.title };
}

async function publishPagePost(message: string, link?: string): Promise<string> {
  const config = useRuntimeConfig();
  const token = config.FACEBOOK_PAGE_TOKEN;
  if (!token) throw new Error('FACEBOOK_PAGE_TOKEN is missing');

  const response = await $fetch<{ id: string }>('https://graph.facebook.com/v19.0/me/feed', {
    method: 'POST',
    body: { message, ...(link ? { link } : {}), access_token: token },
    timeout: 20000,
  });
  return response.id;
}

export async function runPagePost(options: { dryRun?: boolean; force?: boolean; kind?: PostKind } = {}): Promise<PagePostResult> {
  const storage = useStorage('chat');
  const now = new Date();
  const dryRun = options.dryRun || process.env.AUTO_POST_ENABLED !== 'true';

  const lastAt = (await storage.getItem<number>('posts:lastAt')) || 0;
  if (!dryRun && !options.force && now.getTime() - lastAt < MIN_GAP_MS) {
    return { status: 'skipped', reason: 'posted recently' };
  }

  const turn = (await storage.getItem<number>('posts:turn')) || 0;
  const recentThemes = (await storage.getItem<string[]>('posts:recentThemes')) || [];
  const usedSources = (await storage.getItem<string[]>('posts:sources')) || [];
  const recentPoems = (await storage.getItem<string[]>('posts:poems')) || [];

  const theme = pickUnused(THEMES, recentThemes, (t) => t);
  const kind = options.kind || ROTATION[turn % ROTATION.length];

  // Research can come up empty (feed down, nothing suitable), so a post
  // that needs it falls back to one that doesn't.
  const draft =
    (kind === 'tip' && await draftTip(usedSources)) ||
    (kind === 'opportunity' && await draftOpportunity(usedSources, now)) ||
    (kind === 'poem' && draftPoem(recentPoems)) ||
    await draftQuestion(theme) ||
    draftPoem(recentPoems);

  if (!draft) return { status: 'skipped', reason: 'no usable draft' };
  if (dryRun) return { status: 'draft', draft };

  // Claimed before posting so overlapping runs never post twice.
  await storage.setItem('posts:lastAt', now.getTime());
  const id = await publishPagePost(draft.message, draft.link);

  await storage.setItem('posts:turn', turn + 1);
  await storage.setItem(`post:${id}`, draft.message, { ttl: POST_TEXT_TTL_SECONDS });
  if (draft.kind === 'poem' && draft.theme) {
    await storage.setItem('posts:poems', [...recentPoems, draft.theme].slice(-RECENT_POEMS));
  } else if (draft.theme) {
    await storage.setItem('posts:recentThemes', [...recentThemes, draft.theme].slice(-RECENT_THEMES));
  }
  if (draft.source) {
    await storage.setItem('posts:sources', [...usedSources, draft.source].slice(-RECENT_SOURCES));
  }

  return { status: 'posted', id, draft };
}

// The text of a page post, for replying to comments under it: our own
// posts from storage, anything else (posted by hand) from Facebook.
export async function getPostText(postId: string): Promise<string | null> {
  const stored = await useStorage('chat').getItem<string>(`post:${postId}`);
  if (stored) return stored;

  const config = useRuntimeConfig();
  try {
    const post = await $fetch<{ message?: string }>(`https://graph.facebook.com/v19.0/${postId}`, {
      query: { fields: 'message', access_token: config.FACEBOOK_PAGE_TOKEN },
      timeout: 5000,
    });
    return post?.message?.trim() || null;
  } catch {
    return null;
  }
}
