import { getRandomPoem } from './poemLibrary';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type PagePost = {
  message?: string;
  story?: string;
  permalink_url?: string;
  created_time?: string;
  full_picture?: string;
  attachments?: {
    data?: Array<{
      title?: string;
      description?: string;
      url?: string;
      target?: {
        url?: string;
      };
    }>;
  };
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
  source: 'page' | 'web';
};

type ContentKind = 'song' | 'story' | 'poem';

const PAGE_POSTS_CACHE_TTL = 10 * 60 * 1000;
const WEB_SEARCH_TIMEOUT_MS = 8000;

let cachedPagePosts: { at: number; posts: PagePost[] } | null = null;

const POEM_FALLBACK_HINTS = [
  'شعر بخوان',
  'یک شعر',
  'شعری',
  'شعر بگو',
  'شعر',
  'poem',
  'poetry',
];

function wantsLocalPoem(text: string) {
  const normalized = normalize(text);
  return POEM_FALLBACK_HINTS.some((hint) => normalized.includes(normalize(hint)));
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[‌‍]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokenize(text: string) {
  return normalize(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function compact(text: string) {
  return normalize(text).replace(/\s+/g, ' ');
}

function stripHtml(input: string) {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeDuckDuckGoUrl(href: string) {
  try {
    const url = new URL(href, 'https://duckduckgo.com');
    const redirect = url.searchParams.get('uddg');
    if (redirect) return decodeURIComponent(redirect);
    return url.toString();
  } catch {
    return href;
  }
}

function detectContentKind(text: string): ContentKind | null {
  const normalized = normalize(text);

  if (/(آهنگ|آواز|ترانه|موسیقی|song|music|track|lyrics|play|پخش|روان کو)/u.test(normalized)) {
    return 'song';
  }

  if (/(قصه|داستان|حکایت|story|tale|روایت)/u.test(normalized)) {
    return 'story';
  }

  if (/(شعر|شعری|poem|poetry|غزل|سروده|نظم)/u.test(normalized)) {
    return 'poem';
  }

  return null;
}

function buildSearchQuery(text: string, kind: ContentKind) {
  const tokens = tokenize(text);
  const stopWords = new Set([
    'یک', 'یه', 'هم', 'همه', 'را', 'ره', 'رهه', 'مه', 'من', 'تو', 'شما',
    'لطفا', 'لطفاً', 'بشه', 'بده', 'بفرست', 'بفرستید', 'show', 'tell', 'give',
    'me', 'a', 'an', 'the', 'please', 'from', 'internet', 'online', 'page',
    'لینک', 'link', 'بیا', 'کو', 'کن', 'کنه', 'کنید', 'روان',
  ]);

  const filtered = tokens.filter((token) => !stopWords.has(token));
  
  const fallback =
    kind === 'song'
      ? ['آهنگ', 'موسیقی']
      : kind === 'story'
        ? ['قصه', 'داستان']
        : ['شعر', 'poem'];

  return filtered.length > 0 ? filtered.join(' ') : fallback.join(' ');
}

function extractPostText(post: PagePost) {
  const attachment = post.attachments?.data?.[0];
  return [
    post.message,
    post.story,
    attachment?.title,
    attachment?.description,
    attachment?.url,
    attachment?.target?.url,
  ]
    .filter(Boolean)
    .join(' ');
}

function getPostTitle(post: PagePost) {
  const attachment = post.attachments?.data?.[0];
  const raw =
    attachment?.title ||
    post.story ||
    post.message?.split('\n')[0] ||
    attachment?.description ||
    'Facebook post';
  return raw.length > 110 ? `${raw.slice(0, 107)}...` : raw;
}

function getPostLink(post: PagePost) {
  return post.permalink_url || post.attachments?.data?.[0]?.url || post.attachments?.data?.[0]?.target?.url || '';
}

function scoreText(haystack: string, queryTokens: string[], kind: ContentKind) {
  const normalizedHaystack = compact(haystack);
  let score = 0;

  for (const token of queryTokens) {
    if (token && normalizedHaystack.includes(compact(token))) score += 3;
  }

  if (kind === 'song' && /(آهنگ|music|song|audio|video|خواننده|ترانه)/u.test(normalizedHaystack)) score += 2;
  if (kind === 'story' && /(قصه|داستان|story|tale|روایت|حکایت)/u.test(normalizedHaystack)) score += 2;
  if (kind === 'poem' && /(شعر|poem|poetry|غزل|سروده|نظم)/u.test(normalizedHaystack)) score += 2;

  return score;
}

async function fetchFacebookPosts(): Promise<PagePost[]> {
  const now = Date.now();
  if (cachedPagePosts && now - cachedPagePosts.at < PAGE_POSTS_CACHE_TTL) {
    return cachedPagePosts.posts;
  }

  const config = useRuntimeConfig();
  const token = config.FACEBOOK_PAGE_TOKEN;
  if (!token) return [];

  const url = new URL('https://graph.facebook.com/v19.0/me/posts');
  url.searchParams.set('fields', 'message,story,permalink_url,created_time,full_picture,attachments{title,description,url,target}');
  url.searchParams.set('limit', '25');
  url.searchParams.set('access_token', token);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json() as { data?: PagePost[] };
    const posts = Array.isArray(data.data) ? data.data : [];
    cachedPagePosts = { at: now, posts };
    return posts;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function searchPagePosts(posts: PagePost[], query: string, kind: ContentKind) {
  const queryTokens = tokenize(query);
  const scored = posts
    .map((post) => {
      const haystack = extractPostText(post);
      const score = scoreText(haystack, queryTokens, kind);
      const url = getPostLink(post);
      return {
        score,
        post,
        url,
      };
    })
    .filter((item) => item.score > 0 && item.url)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 3).map(({ post, url }) => ({
    title: getPostTitle(post),
    url,
    source: 'page' as const,
    snippet: post.message || post.story || post.attachments?.data?.[0]?.description,
  }));
}

async function searchWeb(query: string, kind: ContentKind) {
  const searchQuery =
    kind === 'song'
      ? `${query} song OR music`
      : kind === 'story'
        ? `${query} story OR storybook OR tale`
        : `${query} poem OR poetry`;

  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEB_SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const results: SearchResult[] = [];
    const blockRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/g;

    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(html)) !== null && results.length < 5) {
      const rawUrl = match[1] || '';
      const title = stripHtml(match[2] || '');
      const snippet = stripHtml(match[3] || match[4] || '');
      const url = decodeDuckDuckGoUrl(rawUrl);
      if (!title || !url) continue;
      results.push({ title, url, snippet, source: 'web' });
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function formatResults(kind: ContentKind, results: SearchResult[], sourceLabel: string) {
  const kindLabel = kind === 'song' ? 'آهنگ' : kind === 'story' ? 'قصه' : 'شعر';

  const lines = results.slice(0, 3).map((result, index) => {
    const snippet = result.snippet ? ` - ${result.snippet.slice(0, 110)}` : '';
    return `${index + 1}. ${result.title}\n${result.url}${snippet}`;
  });

  return `قربانت، همی ${kindLabel} ره از ${sourceLabel} پیدا کدم:\n\n${lines.join('\n\n')}`;
}

function followUpSearchMessage(kind: ContentKind) {
  const kindLabel = kind === 'song' ? 'آهنگ' : kind === 'story' ? 'قصه' : 'شعر';
  return `قربانت، نام یا موضوع همی ${kindLabel} ره دقیق‌تر بگو تا بهتر پیدا کنم.`;
}

export async function resolveContentReply(userMessage: string, conversation: ChatMessage[]): Promise<string | null> {
  const kind = detectContentKind(userMessage);
  if (!kind) return null;

  if (kind === 'poem' && wantsLocalPoem(userMessage)) {
    const poem = getRandomPoem();
    if (poem) {
      return poem.text;
    }
  }

  const lastUserMessage = [...conversation].reverse().find((message) => message.role === 'user')?.content;
  const isVeryShortFollowUp = compact(userMessage).split(' ').length <= 2;
  const query = buildSearchQuery(
    isVeryShortFollowUp && lastUserMessage ? `${lastUserMessage} ${userMessage}` : userMessage,
    kind,
  );

  const pagePosts = await fetchFacebookPosts();
  const pageResults = searchPagePosts(pagePosts, query, kind);
  if (pageResults.length > 0) {
    return formatResults(kind, pageResults, 'صفحه');
  }

  const webResults = await searchWeb(query, kind);
  if (webResults.length > 0) {
    return formatResults(kind, webResults, 'انترنت');
  }

  return followUpSearchMessage(kind);
}
