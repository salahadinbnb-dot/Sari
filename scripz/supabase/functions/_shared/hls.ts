// HLS playlist helpers — the only route that yields genuinely independent,
// time-aligned media chunks (each .ts/.m4s segment is its own decodable unit).
// We never treat arbitrary byte ranges of a progressive MP4 as a time chunk.

export interface HlsSegment {
  url: string;
  duration: number;
}

export interface SegmentGroup {
  index: number;
  start: number;
  end: number;
  urls: string[];
}

function resolve(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url);
}

/** Returns the media playlist: either the input, or the lowest-bandwidth variant of a master playlist. */
export function pickMediaPlaylist(playlistUrl: string, body: string): { url: string; bandwidth: number } | null {
  if (!/#EXT-X-STREAM-INF/i.test(body)) return { url: playlistUrl, bandwidth: 0 }; // already a media playlist
  const lines = body.split(/\r?\n/);
  const variants: { bandwidth: number; url: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
    const bw = Number(line.match(/BANDWIDTH=(\d+)/i)?.[1] ?? 0);
    const next = (lines[i + 1] ?? '').trim();
    if (next && !next.startsWith('#')) variants.push({ bandwidth: bw, url: resolve(playlistUrl, next) });
  }
  if (variants.length === 0) return null;
  // Lowest bitrate: smallest download, identical speech content.
  variants.sort((a, b) => a.bandwidth - b.bandwidth);
  return variants[0];
}

export function parseMediaPlaylist(playlistUrl: string, body: string): HlsSegment[] {
  const lines = body.split(/\r?\n/);
  const segments: HlsSegment[] = [];
  let duration = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      duration = parseFloat(line.slice(8).split(',')[0]) || 0;
      continue;
    }
    if (line.startsWith('#')) continue;
    segments.push({ url: resolve(playlistUrl, line), duration });
    duration = 0;
  }
  return segments;
}

/** Group consecutive segments into batches that stay under the inline-upload budget. */
export function groupSegments(segments: HlsSegment[], maxSecondsPerGroup: number): SegmentGroup[] {
  const groups: SegmentGroup[] = [];
  let current: HlsSegment[] = [];
  let start = 0;
  let elapsed = 0;

  const flush = () => {
    if (current.length === 0) return;
    groups.push({ index: groups.length, start, end: start + elapsed, urls: current.map((s) => s.url) });
    start += elapsed;
    elapsed = 0;
    current = [];
  };

  for (const seg of segments) {
    if (current.length > 0 && elapsed + seg.duration > maxSecondsPerGroup) flush();
    current.push(seg);
    elapsed += seg.duration || 0;
  }
  flush();
  return groups;
}
