import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { groupSegments, isHlsUrl, parseMediaPlaylist, pickMediaPlaylist } from "../_shared/hls.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Hard ceiling for one inline upload to the AI gateway (memory + request-size bound).
const MAX_INLINE_BYTES = 18 * 1024 * 1024;
// Default per-chunk wall time when we cannot infer bitrate from the playlist.
const DEFAULT_GROUP_SECONDS = 240;
const MAX_GROUP_SECONDS = 900;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Download a full resource, refusing (never truncating) anything past the cap. */
async function downloadFull(url: string, budgetBytes: number): Promise<Uint8Array> {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 45000);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('no response body');

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > budgetBytes) {
      await reader.cancel();
      throw new Error('OVER_BUDGET');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function probeSize(url: string): Promise<number | null> {
  try {
    const head = await fetchWithTimeout(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, 10000);
    const len = head.headers.get('content-length');
    if (head.ok && len) return Number(len);
    const ranged = await fetchWithTimeout(
      url,
      { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1' } },
      10000,
    );
    await ranged.body?.cancel();
    const cr = ranged.headers.get('content-range');
    const m = cr?.match(/\/(\d+)$/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT =
  'You are an expert transcriptionist. Transcribe EVERY SINGLE WORD spoken in the media. Do not summarize, do not describe visuals, do not add commentary or headings. Preserve sentence punctuation and add paragraph breaks at natural pauses. If there is no speech at all, respond with exactly "[No speech detected]".';

/** One inline transcription call with bounded backoff on 429/5xx. */
async function transcribeBytes(
  apiKey: string,
  bytes: Uint8Array,
  mimeType: string,
  note: string,
): Promise<string> {
  const base64 = uint8ArrayToBase64(bytes);
  const backoffs = [2000, 5000, 10000];

  let lastError = 'AI gateway error';
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    if (attempt > 0) await sleep(backoffs[attempt - 1]);

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Transcribe this media word-for-word. ${note}` },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429 || res.status >= 500) {
      lastError = res.status === 429 ? 'AI gateway rate limit' : `AI gateway error ${res.status}`;
      await res.text();
      console.warn(`transcribe attempt ${attempt + 1} failed: ${lastError}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      console.error('AI error', res.status, text.slice(0, 300));
      throw new Error(res.status === 402 ? 'AI credits exhausted' : 'Transcription request rejected');
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No transcription generated');
    return content.trim();
  }
  throw new Error(lastError);
}

/** Build an honest work plan: one unit for short media, real time segments for HLS. */
async function buildPlan(sourceUrl: string) {
  if (isHlsUrl(sourceUrl)) {
    const res = await fetchWithTimeout(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 15000);
    if (!res.ok) throw new Error(`Could not read the stream playlist (${res.status})`);
    const body = await res.text();
    const media = pickMediaPlaylist(sourceUrl, body);
    if (!media) throw new Error('Stream playlist contained no playable variant');

    let segments = parseMediaPlaylist(media.url, body);
    if (media.url !== sourceUrl) {
      const mediaRes = await fetchWithTimeout(media.url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 15000);
      if (!mediaRes.ok) throw new Error(`Could not read the stream variant (${mediaRes.status})`);
      segments = parseMediaPlaylist(media.url, await mediaRes.text());
    }
    if (segments.length === 0) throw new Error('Stream playlist contained no media segments');

    const budgetSeconds = media.bandwidth > 0
      ? Math.max(60, Math.min(MAX_GROUP_SECONDS, Math.floor((MAX_INLINE_BYTES * 8 * 0.8) / media.bandwidth)))
      : DEFAULT_GROUP_SECONDS;

    const groups = groupSegments(segments, budgetSeconds);
    const duration = segments.reduce((a, s) => a + (s.duration || 0), 0);
    return {
      kind: 'hls' as const,
      total: groups.length,
      durationSeconds: Math.round(duration),
      mimeType: 'video/mp2t',
      segments: groups,
    };
  }

  const size = await probeSize(sourceUrl);
  if (size !== null && size > MAX_INLINE_BYTES) {
    return {
      kind: 'unsupported' as const,
      total: 0,
      sizeBytes: size,
      reason:
        'This video has no platform captions and its media file is larger than we can transcribe in one pass ' +
        `(${(size / 1024 / 1024).toFixed(0)} MB, limit ${MAX_INLINE_BYTES / 1024 / 1024} MB). ` +
        'Long videos are fully supported when the platform provides captions or a segmented (HLS) stream.',
    };
  }

  return {
    kind: 'single' as const,
    total: 1,
    sizeBytes: size,
    mimeType: 'video/mp4',
    segments: [{ index: 0, start: 0, end: 0, urls: [sourceUrl] }],
  };
}

function offsetNote(start: number, end: number, index: number, total: number): string {
  if (total <= 1) return 'This is the complete media file.';
  const fmt = (s: number) => `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, '0')}s`;
  return `This is part ${index + 1} of ${total} of a longer recording (covering roughly ${fmt(start)}–${fmt(end)}). Transcribe only what you hear in this part; do not add part labels or timestamps.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode: string = body.mode ?? 'auto';
    const sourceUrl: string | undefined = body.transcriptionVideoUrl || body.videoUrl;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) return json({ success: false, error: 'AI service not configured' }, 500);

    // ---- Segment mode: transcribe one independent time segment ----
    if (mode === 'segment') {
      const segment = body.segment as { index: number; start: number; end: number; urls: string[] } | undefined;
      const total: number = body.total ?? 1;
      const mimeType: string = body.mimeType ?? 'video/mp4';
      if (!segment?.urls?.length) return json({ success: false, error: 'Segment is required' }, 400);

      const parts: Uint8Array[] = [];
      let bytes = 0;
      for (const url of segment.urls) {
        try {
          const part = await downloadFull(url, MAX_INLINE_BYTES - bytes);
          bytes += part.byteLength;
          parts.push(part);
        } catch (e) {
          const msg = (e as Error).message;
          return json({
            success: false,
            code: msg === 'OVER_BUDGET' ? 'segment_too_large' : 'segment_download_failed',
            index: segment.index,
            error:
              msg === 'OVER_BUDGET'
                ? 'This part of the stream is larger than we can transcribe in one pass.'
                : `Could not download part ${segment.index + 1}.`,
          });
        }
      }

      const merged = new Uint8Array(bytes);
      let offset = 0;
      for (const p of parts) {
        merged.set(p, offset);
        offset += p.byteLength;
      }

      console.log(`Transcribing segment ${segment.index + 1}/${total} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
      try {
        const text = await transcribeBytes(
          LOVABLE_API_KEY,
          merged,
          mimeType,
          offsetNote(segment.start, segment.end, segment.index, total),
        );
        return json({ success: true, index: segment.index, text });
      } catch (e) {
        return json({
          success: false,
          code: 'segment_transcription_failed',
          index: segment.index,
          error: (e as Error).message,
        });
      }
    }

    if (!sourceUrl) return json({ success: false, error: 'Video URL is required' }, 400);

    // ---- Plan mode: report the real, honest shape of the job ----
    if (mode === 'plan') {
      const plan = await buildPlan(sourceUrl);
      if (plan.kind === 'unsupported') {
        return json({ success: false, code: 'unsupported_long_video', error: plan.reason, plan });
      }
      return json({ success: true, plan });
    }

    // ---- Auto mode (legacy callers, e.g. the Telegram bot): single-pass only ----
    const plan = await buildPlan(sourceUrl);
    if (plan.kind !== 'single') {
      return json({
        success: false,
        code: plan.kind === 'unsupported' ? 'unsupported_long_video' : 'requires_segmented_run',
        error:
          plan.kind === 'unsupported'
            ? (plan as { reason: string }).reason
            : 'This video needs a segmented transcription run. Open it in Scripz to transcribe the full duration.',
      });
    }

    let bytes: Uint8Array;
    try {
      bytes = await downloadFull(sourceUrl, MAX_INLINE_BYTES);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'OVER_BUDGET') {
        return json({
          success: false,
          code: 'unsupported_long_video',
          error: `This media file exceeds the ${MAX_INLINE_BYTES / 1024 / 1024} MB single-pass limit and the source offers no segmented stream.`,
        });
      }
      return json({ success: false, code: 'download_failed', error: 'Could not download the video file.' });
    }

    const transcript = await transcribeBytes(LOVABLE_API_KEY, bytes, 'video/mp4', offsetNote(0, 0, 0, 1));
    return json({ success: true, transcript, complete: true, segmentsCompleted: 1, segmentsTotal: 1 });
  } catch (error) {
    console.error('Error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      500,
    );
  }
});
