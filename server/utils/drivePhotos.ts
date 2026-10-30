// server/utils/drivePhotos.ts
//
// Picks a photo from the Google Drive folder behind GOOGLE_SCRIPT_URL
// (same Apps Script the gallery page uses) when someone asks for a
// picture in Messenger.

type DriveItem = { id?: string; fileId?: string; file_id?: string };

const PHOTO_LIST_CACHE_TTL = 10 * 60 * 1000;

// How many recently sent photo ids are remembered per user, so asking
// again a few times doesn't return the same picture.
const RECENT_PHOTOS_PER_USER = 30;

let cachedPhotoIds: { at: number; ids: string[] } | null = null;

// Persian words match as substrings (عکست, عکسای, ...); English ones need
// word boundaries so "topic" / "picnic" don't count as "pic".
const PHOTO_WORD = /(عکس|تصویر|فوتو|فوطو|سلفی|\b(photos?|pics?|pictures?|images?|selfies?)\b)/iu;
const REQUEST_WORD = /(بفرست|روان|بده|بدی|بدین|بدید|نشان|نشون|ببینم|میخوا|می‌خوا|\b(send|show|share|want)\b)/iu;

// Needs both a picture word and a "send / show / give / I want" word, so
// just talking about a photo ("عکس قشنگی بود") doesn't trigger it.
export function isPhotoRequest(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return PHOTO_WORD.test(trimmed) && REQUEST_WORD.test(trimmed);
}

// Song/music requests get a photo instead of links (links lead people to
// the page, where they can download every picture).
const MUSIC_WORD = /(آهنگ|آواز|ترانه|موسیقی|موزیک|\b(songs?|music|lyrics)\b)/iu;

export function isMusicRequest(text: string) {
  return MUSIC_WORD.test(text.trim());
}

async function getPhotoIds(): Promise<string[]> {
  if (cachedPhotoIds && Date.now() - cachedPhotoIds.at < PHOTO_LIST_CACHE_TTL) {
    return cachedPhotoIds.ids;
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return [];

  const payload = await $fetch<DriveItem[] | { images?: DriveItem[] }>(scriptUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 15000,
  });

  const items = Array.isArray(payload) ? payload : payload?.images || [];
  const ids = items
    .map((item) => item?.id || item?.fileId || item?.file_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  cachedPhotoIds = { at: Date.now(), ids };
  return ids;
}

// Facebook downloads the image itself, so this must be a public URL.
// "=w1080-h1080" makes Google serve a resized copy (~1MB instead of ~2MB).
function toImageUrl(id: string) {
  return `https://lh3.googleusercontent.com/d/${id}=w1080-h1080`;
}

/**
 * Returns a public image URL for a random Drive photo this user hasn't
 * been sent recently, or null if no photos are available.
 */
export async function pickDrivePhoto(senderId: string): Promise<string | null> {
  const ids = await getPhotoIds().catch((err) => {
    console.error('Drive photo list error:', err?.message);
    return [] as string[];
  });
  if (ids.length === 0) return null;

  const storage = useStorage('chat');
  const recentKey = `photos:${senderId}`;
  const recent = (await storage.getItem<string[]>(recentKey)) || [];

  const unseen = ids.filter((id) => !recent.includes(id));
  const pool = unseen.length > 0 ? unseen : ids;
  const id = pool[Math.floor(Math.random() * pool.length)];

  await storage.setItem(recentKey, [...recent, id].slice(-RECENT_PHOTOS_PER_USER));
  return toImageUrl(id);
}
