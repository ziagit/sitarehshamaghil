import { getRandomPoem } from './poemLibrary';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type SearchResult = {
  title: string;
  url: string;
  snippet?: string;
  source: 'web';
};

// Songs aren't here: song/music requests get a Drive photo instead
// (see getPhotoReply), never links.
type ContentKind = 'story' | 'biography' | 'poem';

const WEB_SEARCH_TIMEOUT_MS = 8000;

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

  if (/(قصه|داستان|حکایت|story|tale|روایت)/u.test(normalized)) {
    return 'story';
  }

  if (/(زندگی‌نامه|زندگی نامه|بیوگرافی|biography|bio|زندگی|سرگذشت|شرح حال)/u.test(normalized)) {
    return 'biography';
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
    kind === 'story'
      ? ['قصه', 'داستان']
      : kind === 'biography'
        ? ['زندگی‌نامه', 'بیوگرافی']
        : ['شعر', 'poem'];

  return filtered.length > 0 ? filtered.join(' ') : fallback.join(' ');
}

// Never send people to our own Facebook page: they'd find (and download)
// every picture there.
function isOwnPageLink(url: string) {
  return /sitarehshamaghil|293726924758356/i.test(url);
}

async function searchWeb(query: string, kind: ContentKind) {
  const searchQuery =
    kind === 'story'
      ? `${query} story OR storybook OR tale`
      : kind === 'biography'
        ? `${query} biography OR life story OR profile OR biography page`
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
      if (!title || !url || isOwnPageLink(url)) continue;
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
  const kindLabel =
    kind === 'story'
      ? 'قصه'
      : kind === 'biography'
        ? 'زندگی‌نامه'
        : 'شعر';

  const lines = results.slice(0, 3).map((result, index) => {
    const snippet = result.snippet ? ` - ${result.snippet.slice(0, 110)}` : '';
    return `${index + 1}. ${result.title}\n${result.url}${snippet}`;
  });

  return `قربانت، همی ${kindLabel} ره از ${sourceLabel} پیدا کدم:\n\n${lines.join('\n\n')}`;
}

function followUpSearchMessage(kind: ContentKind) {
  const kindLabel =
    kind === 'story'
      ? 'قصه'
      : kind === 'biography'
        ? 'زندگی‌نامه'
        : 'شعر';
  return `قربانت، نام یا موضوع همی ${kindLabel} ره دقیق‌تر بگو تا بهتر پیدا کنم.`;
}

export async function resolveContentReply(userMessage: string, conversation: ChatMessage[]): Promise<string | null> {
  const kind = detectContentKind(userMessage);
  if (!kind) return null;

  if (kind === 'poem') {
    const poem = getRandomPoem();
    if (poem) {
      return poem.text;
    }
    return null;
  }

  const lastUserMessage = [...conversation].reverse().find((message) => message.role === 'user')?.content;
  const isVeryShortFollowUp = compact(userMessage).split(' ').length <= 2;
  const query = buildSearchQuery(
    isVeryShortFollowUp && lastUserMessage ? `${lastUserMessage} ${userMessage}` : userMessage,
    kind,
  );

  const webResults = await searchWeb(query, kind);
  if (webResults.length > 0) {
    return formatResults(kind, webResults, 'انترنت');
  }

  return followUpSearchMessage(kind);
}
