import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

class RateLimitError extends Error {
  constructor() { super('Transcript service is rate-limited. Please wait a moment and try again.'); }
}

async function rapidFetch(url: string, key: string): Promise<Response> {
  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'youtube-captions.p.rapidapi.com' },
    });
    if (res.ok) return res;
    lastStatus = res.status;
    lastBody = await res.text();
    console.error('RapidAPI error:', res.status, lastBody);
    if (res.status === 403 || res.status === 401) throw new Error('Invalid API key or subscription required');
    if (res.status !== 429) break;
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (lastStatus === 429) throw new RateLimitError();
  throw new Error('Failed to fetch transcript from API');
}

async function fetchTranscriptWithTimestamps(videoId: string): Promise<{ segments: TranscriptSegment[]; plainText: string; timestampedText: string }> {
  const rapidApiKey = Deno.env.get('YOUTUBE_RAPIDAPI_KEY');
  if (!rapidApiKey) {
    throw new Error('YouTube API key not configured');
  }

  console.log('Fetching transcript with timestamps for:', videoId);

  const response = await rapidFetch(`https://youtube-captions.p.rapidapi.com/transcript?videoId=${videoId}`, rapidApiKey);

  const responseText = await response.text();
  console.log('Response length:', responseText.length);

  if (!responseText || responseText.trim().length === 0) {
    throw new Error('No transcript content found');
  }

  let segments: TranscriptSegment[] = [];

  try {
    const jsonData = JSON.parse(responseText);

    if (jsonData.error) {
      throw new Error(jsonData.error || 'No transcript available');
    }

    // Parse segments array - common format: [{text, start, duration}]
    if (Array.isArray(jsonData)) {
      segments = jsonData.map((seg: any) => ({
        text: (seg.text || seg.content || '').trim(),
        start: parseFloat(seg.start || seg.offset || 0),
        duration: parseFloat(seg.duration || seg.dur || 0),
      })).filter((s: TranscriptSegment) => s.text.length > 0);
    } else if (jsonData.data && Array.isArray(jsonData.data)) {
      segments = jsonData.data.map((seg: any) => ({
        text: (seg.text || seg.content || '').trim(),
        start: parseFloat(seg.start || seg.offset || 0),
        duration: parseFloat(seg.duration || seg.dur || 0),
      })).filter((s: TranscriptSegment) => s.text.length > 0);
    } else if (jsonData.transcript && Array.isArray(jsonData.transcript)) {
      segments = jsonData.transcript.map((seg: any) => ({
        text: (seg.text || seg.content || '').trim(),
        start: parseFloat(seg.start || seg.offset || 0),
        duration: parseFloat(seg.duration || seg.dur || 0),
      })).filter((s: TranscriptSegment) => s.text.length > 0);
    }
  } catch (parseError) {
    console.error('Parse error, falling back to fulltext');
  }

  // If no segments parsed, fall back to fulltext endpoint
  if (segments.length === 0) {
    console.log('No segments found, falling back to fulltext endpoint');
    const ftResponse = await rapidFetch(`https://youtube-captions.p.rapidapi.com/transcript/fulltext?videoId=${videoId}`, rapidApiKey);

    const ftText = await ftResponse.text();
    let plainText = '';

    try {
      const ftJson = JSON.parse(ftText);
      if (ftJson.data?.transcript) plainText = ftJson.data.transcript;
      else if (ftJson.transcript) plainText = ftJson.transcript;
      else if (typeof ftJson === 'string') plainText = ftJson;
    } catch {
      plainText = ftText;
    }

    plainText = cleanTranscript(plainText);
    return { segments: [], plainText, timestampedText: plainText };
  }

  // Clean segment text
  segments = segments.map(s => ({
    ...s,
    text: s.text
      .replace(/♪/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim(),
  })).filter(s => s.text.length > 0);

  // Normalize timestamps: some providers return start/duration in milliseconds.
  // Heuristic: if max start exceeds 24h in "seconds" it must be ms; also if durations
  // are integers >= 100 and starts are integers, treat as ms.
  const maxStart = segments.reduce((m, s) => Math.max(m, s.start), 0);
  const allIntegerStarts = segments.every(s => Number.isInteger(s.start));
  const allIntegerDurs = segments.every(s => Number.isInteger(s.duration));
  const looksLikeMs = maxStart > 86400 || (allIntegerStarts && allIntegerDurs && maxStart > 600 && segments.some(s => s.duration >= 100));
  if (looksLikeMs) {
    console.log('Detected millisecond timestamps, normalizing to seconds');
    segments = segments.map(s => ({ ...s, start: s.start / 1000, duration: s.duration / 1000 }));
  }

  // Build plain text
  const plainText = cleanTranscript(segments.map(s => s.text).join(' '));

  // Build timestamped text
  const timestampedText = segments
    .map(s => `[${formatTimestamp(s.start)}] ${s.text}`)
    .join('\n');

  return { segments, plainText, timestampedText };
}

function cleanTranscript(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/♪/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .replace(/([.!?])\s+/g, '$1\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'YouTube URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid YouTube URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing video:', videoId);

    const { plainText, timestampedText, segments } = await fetchTranscriptWithTimestamps(videoId);

    console.log('Transcript fetched, segments:', segments.length, 'plain length:', plainText.length);

    return new Response(
      JSON.stringify({
        success: true,
        transcript: plainText,
        timestampedTranscript: timestampedText,
        segments,
        videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const isRate = error instanceof RateLimitError;
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transcript',
        rateLimited: isRate,
      }),
      { status: isRate ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
