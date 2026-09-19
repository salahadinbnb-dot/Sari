// Shared media-extraction helpers used by the platform fetch functions.

export interface ExtractedMedia {
  videoUrl: string | null;
  thumbnailUrl?: string | null;
  caption?: string | null;
  duration?: number | null;
}

/** fetch() with a hard timeout so one hanging provider can't eat the whole request. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best-effort walk of the many different JSON shapes RapidAPI downloaders return. */
export function pickVideoFromAny(data: any, depth = 0): ExtractedMedia {
  let videoUrl: string | null = null;
  let thumbnailUrl: string | null = null;
  let caption: string | null = null;
  let duration: number | null = null;

  if (!data || typeof data !== 'object' || depth > 4) return { videoUrl: null };

  const isVideoUrl = (u: unknown) =>
    typeof u === 'string' && /^https?:\/\//.test(u) && !/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u);

  if (typeof data.media === 'string' && isVideoUrl(data.media)) {
    videoUrl = data.media;
    thumbnailUrl = data.thumbnail || data.thumb || null;
    caption = data.title || data.caption || null;
  } else if (Array.isArray(data) && data.length > 0) {
    const videoItem =
      data.find((i: any) => i?.type === 'video' || /\.mp4/i.test(i?.url || i?.video_url || i?.media || '')) ||
      data[0];
    videoUrl = videoItem?.url || videoItem?.video_url || videoItem?.media || null;
    thumbnailUrl = videoItem?.thumbnail || videoItem?.cover || null;
  } else if (Array.isArray(data.medias) && data.medias.length > 0) {
    // auto-download-all-in-one shape
    const vids = data.medias.filter((m: any) => (m?.type === 'video' || /mp4/i.test(m?.extension || '')) && isVideoUrl(m?.url));
    const best = vids.sort((a: any, b: any) => (b?.quality === 'hd' ? 1 : 0) - (a?.quality === 'hd' ? 1 : 0))[0] || data.medias[0];
    videoUrl = best?.url || null;
    thumbnailUrl = data.thumbnail || data.picture || null;
    caption = data.title || null;
    duration = typeof data.duration === 'number' ? data.duration : null;
  } else if (data.links && Array.isArray(data.links)) {
    // social-media-video-downloader shape
    const v =
      data.links.find((l: any) => /mp4/i.test(l?.quality || l?.type || l?.link || l?.url || '') && isVideoUrl(l?.link || l?.url)) ||
      data.links.find((l: any) => isVideoUrl(l?.link || l?.url));
    videoUrl = v?.link || v?.url || null;
    thumbnailUrl = data.picture || data.thumbnail || null;
    caption = data.title || data.caption || null;
  } else if (data.result && Array.isArray(data.result)) {
    const v = data.result.find((i: any) => i?.type === 'video') || data.result[0];
    videoUrl = v?.url || v?.video_url || v?.media || null;
    thumbnailUrl = v?.thumbnail || v?.cover || null;
  } else if (isVideoUrl(data.video_url)) {
    videoUrl = data.video_url;
    thumbnailUrl = data.thumbnail_url || data.display_url || null;
  } else if (isVideoUrl(data.url)) {
    videoUrl = data.url;
    thumbnailUrl = data.thumbnail || data.cover || null;
  } else if (typeof data.video === 'string' && isVideoUrl(data.video)) {
    videoUrl = data.video;
    thumbnailUrl = data.thumbnail || data.image || null;
  } else if (data.data) {
    return pickVideoFromAny(data.data, depth + 1);
  } else if (data.result) {
    return pickVideoFromAny(data.result, depth + 1);
  }

  return { videoUrl, thumbnailUrl, caption, duration };
}

/** Confirm a candidate URL actually resolves before handing it to the client. */
export async function urlResolves(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } },
      timeoutMs,
    );
    if (res.ok) return true;
    // Some CDNs reject HEAD — retry with a 1-byte ranged GET.
    const res2 = await fetchWithTimeout(
      url,
      { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1' } },
      timeoutMs,
    );
    await res2.body?.cancel();
    return res2.ok || res2.status === 206;
  } catch {
    return false;
  }
}

/** Generic RapidAPI GET provider with timeout + one backoff retry on 429/5xx. */
export async function tryRapidProvider(
  name: string,
  host: string,
  endpoint: string,
  apiKey: string,
): Promise<ExtractedMedia | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(1500);
      console.log(`[${name}] trying (attempt ${attempt + 1})`);
      const res = await fetchWithTimeout(
        endpoint,
        { method: 'GET', headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': host } },
        8000,
      );
      if (!res.ok) {
        const body = await res.text();
        console.warn(`[${name}] status ${res.status}: ${body.substring(0, 160)}`);
        if (res.status === 429 || res.status >= 500) continue;
        return null;
      }
      const data = await res.json().catch(() => null);
      if (!data) return null;
      if (data.error && !pickVideoFromAny(data).videoUrl) {
        console.warn(`[${name}] upstream error:`, String(data.error).substring(0, 160));
        return null;
      }
      const extracted = pickVideoFromAny(data);
      if (extracted.videoUrl) {
        console.log(`[${name}] ✓ extracted video URL`);
        return extracted;
      }
      console.log(`[${name}] no video in response:`, JSON.stringify(data).substring(0, 200));
      return null;
    } catch (e) {
      console.warn(`[${name}] threw:`, (e as Error).message);
    }
  }
  return null;
}
