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

async function getDownloadFromPage(videoId: string): Promise<{ downloadUrl: string; title: string } | null> {
  // Fetch the YouTube watch page as a regular browser would
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    console.error(`Page fetch failed: ${response.status}`);
    return null;
  }

  const html = await response.text();

  // Extract ytInitialPlayerResponse from the page HTML
  const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s)
    || html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);

  if (!playerMatch) {
    console.error('Could not find ytInitialPlayerResponse in page HTML');
    return null;
  }

  let playerData;
  try {
    playerData = JSON.parse(playerMatch[1]);
  } catch (e) {
    console.error('Failed to parse player response JSON');
    return null;
  }

  if (playerData.playabilityStatus?.status !== 'OK') {
    console.log(`Page player status: ${playerData.playabilityStatus?.status} - ${playerData.playabilityStatus?.reason}`);
    return null;
  }

  const streamingData = playerData.streamingData;
  if (!streamingData) {
    console.log('No streaming data in page response');
    return null;
  }

  const title = playerData.videoDetails?.title || `youtube-${videoId}`;

  // Progressive formats (video+audio)
  if (streamingData.formats?.length > 0) {
    const mp4 = streamingData.formats
      .filter((f: any) => f.mimeType?.startsWith('video/mp4') && f.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    if (mp4.length > 0) {
      return { downloadUrl: mp4[0].url, title };
    }
  }

  // Adaptive formats (video only fallback)
  if (streamingData.adaptiveFormats?.length > 0) {
    const mp4 = streamingData.adaptiveFormats
      .filter((f: any) => f.mimeType?.startsWith('video/mp4') && f.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    if (mp4.length > 0) {
      return { downloadUrl: mp4[0].url, title };
    }
  }

  // Some formats use signatureCipher instead of url - these require decryption
  // which is complex, so we skip them
  console.log('No direct URL formats found (may need signature decryption)');
  return null;
}

async function getDownloadFromInnertube(videoId: string): Promise<{ downloadUrl: string; title: string } | null> {
  // Fallback: try innertube API with ANDROID client
  const response = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 12)',
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.09.37',
          androidSdkVersion: 30,
          hl: 'en',
          gl: 'US',
        },
      },
    }),
  });

  if (!response.ok) {
    await response.text();
    return null;
  }

  const data = await response.json();
  if (data.playabilityStatus?.status !== 'OK' || !data.streamingData) return null;

  const title = data.videoDetails?.title || `youtube-${videoId}`;
  const sd = data.streamingData;

  if (sd.formats?.length > 0) {
    const mp4 = sd.formats
      .filter((f: any) => f.mimeType?.startsWith('video/mp4') && f.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    if (mp4.length > 0) return { downloadUrl: mp4[0].url, title };
  }

  if (sd.adaptiveFormats?.length > 0) {
    const mp4 = sd.adaptiveFormats
      .filter((f: any) => f.mimeType?.startsWith('video/mp4') && f.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
    if (mp4.length > 0) return { downloadUrl: mp4[0].url, title };
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl } = await req.json();

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Video URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching download for:', videoId);

    // Strategy 1: Scrape the watch page (most reliable)
    console.log('Trying page scrape...');
    let result = await getDownloadFromPage(videoId);

    // Strategy 2: Innertube API fallback
    if (!result) {
      console.log('Trying innertube API...');
      result = await getDownloadFromInnertube(videoId);
    }

    if (result) {
      console.log(`Download found: ${result.title}`);
      return new Response(
        JSON.stringify({ success: true, downloadUrl: result.downloadUrl, title: result.title }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Could not get a download link. The video may be restricted or require sign-in.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
