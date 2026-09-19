import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchWithTimeout, pickVideoFromAny, tryRapidProvider, urlResolves } from "../_shared/media.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface Found { videoUrl: string; thumbnailUrl: string | null; via: string }

function extractTweetId(url: string): string | null {
  const patterns = [/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/, /^(\d+)$/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractUsername(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\//);
  return match ? match[1] : null;
}

async function tryFxTwitter(username: string, tweetId: string): Promise<Found | null> {
  try {
    const resp = await fetchWithTimeout(
      `https://api.fxtwitter.com/${username}/status/${tweetId}`,
      { headers: { 'User-Agent': UA } },
      8000,
    );
    if (!resp.ok) {
      console.log(`fxtwitter(${username}):`, resp.status);
      await resp.text();
      return null;
    }
    const data = await resp.json();
    const tweet = data.tweet;
    if (!tweet) return null;

    let videoUrl: string | null = null;
    let thumbnailUrl: string | null = tweet.media?.photos?.[0]?.url || null;

    if (tweet.media?.videos?.length > 0) {
      videoUrl = tweet.media.videos[0].url;
      thumbnailUrl = tweet.media.videos[0].thumbnail_url || thumbnailUrl;
    } else if (tweet.media?.all) {
      const vm = tweet.media.all.find((m: any) => m.type === 'video' || m.type === 'gif');
      if (vm) {
        videoUrl = vm.url;
        thumbnailUrl = vm.thumbnail_url || thumbnailUrl;
      }
    }

    if (videoUrl) return { videoUrl, thumbnailUrl, via: `fxtwitter/${username}` };
    return null;
  } catch (e) {
    console.log('fxtwitter error:', (e as Error).message);
    return null;
  }
}

async function tryVxTwitter(username: string, tweetId: string): Promise<Found | null> {
  try {
    const resp = await fetchWithTimeout(
      `https://api.vxtwitter.com/${username}/status/${tweetId}`,
      { headers: { 'User-Agent': UA } },
      8000,
    );
    if (!resp.ok) {
      console.log(`vxtwitter(${username}):`, resp.status);
      await resp.text();
      return null;
    }
    const data = await resp.json();

    if (data.media_extended) {
      const vm = data.media_extended.find((m: any) => m.type === 'video' || m.type === 'animated_gif');
      if (vm?.url) return { videoUrl: vm.url, thumbnailUrl: vm.thumbnail_url || null, via: `vxtwitter/${username}` };
    }
    if (data.mediaURLs?.length > 0) {
      const vidUrl = data.mediaURLs.find((u: string) => u.includes('.mp4'));
      if (vidUrl) return { videoUrl: vidUrl, thumbnailUrl: null, via: `vxtwitter/${username}-mediaURLs` };
    }
    return null;
  } catch (e) {
    console.log('vxtwitter error:', (e as Error).message);
    return null;
  }
}

/** Community cobalt instance only — the official api.cobalt.tools now requires API-key auth. */
async function tryCobalt(mediaUrl: string): Promise<Found | null> {
  const base = 'https://cobalt-api.kwiatekmiki.com';
  try {
    const resp = await fetchWithTimeout(
      base + '/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ url: mediaUrl, videoQuality: '720', filenameStyle: 'basic' }),
      },
      8000,
    );
    if (!resp.ok) {
      console.log('cobalt:', resp.status);
      await resp.text();
      return null;
    }
    const data = await resp.json();
    const url = data.url || data.tunnel;
    if (url && ['tunnel', 'redirect', 'stream'].includes(data.status)) {
      return { videoUrl: url, thumbnailUrl: null, via: 'cobalt' };
    }
    if (data.picker?.length) {
      const item = data.picker.find((p: any) => p.type === 'video') || data.picker[0];
      if (item?.url) return { videoUrl: item.url, thumbnailUrl: item.thumb || null, via: 'cobalt-picker' };
    }
  } catch (e) {
    console.log('cobalt error:', (e as Error).message);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Twitter/X URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tweetId = extractTweetId(url);
    if (!tweetId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Twitter/X URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const username = extractUsername(url) || 'i';
    console.log('Fetching tweet:', tweetId, 'user:', username);

    const encoded = encodeURIComponent(url);
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');

    const attempts: Array<() => Promise<Found | null>> = [
      () => tryFxTwitter(username, tweetId),
      () => tryVxTwitter(username, tweetId),
      // Retry the mirror APIs with the anonymous "i" username handle
      () => (username !== 'i' ? tryFxTwitter('i', tweetId) : Promise.resolve(null)),
      () => (username !== 'i' ? tryVxTwitter('i', tweetId) : Promise.resolve(null)),
    ];

    if (rapidApiKey) {
      attempts.push(async () => {
        const r = await tryRapidProvider(
          'auto-download-all-in-one',
          'auto-download-all-in-one-big.p.rapidapi.com',
          `https://auto-download-all-in-one-big.p.rapidapi.com/v1/social/autolink?url=${encoded}`,
          rapidApiKey,
        );
        return r?.videoUrl ? { videoUrl: r.videoUrl, thumbnailUrl: r.thumbnailUrl ?? null, via: 'rapid-autolink' } : null;
      });
      attempts.push(async () => {
        const r = await tryRapidProvider(
          'social-media-video-downloader',
          'social-media-video-downloader.p.rapidapi.com',
          `https://social-media-video-downloader.p.rapidapi.com/smvd/get/all?url=${encoded}`,
          rapidApiKey,
        );
        return r?.videoUrl ? { videoUrl: r.videoUrl, thumbnailUrl: r.thumbnailUrl ?? null, via: 'rapid-smvd' } : null;
      });
    }

    // Absolute last resort
    attempts.push(() => tryCobalt(url));

    let result: Found | null = null;
    for (const attempt of attempts) {
      const candidate = await attempt();
      if (!candidate?.videoUrl) continue;
      const ok = await urlResolves(candidate.videoUrl);
      if (!ok) {
        console.log(`[${candidate.via}] URL did not resolve, continuing`);
        continue;
      }
      result = candidate;
      break;
    }

    if (!result) {
      console.log('All twitter providers exhausted for', tweetId);
      return new Response(
        JSON.stringify({
          success: false,
          code: 'TWITTER_EXTRACTION_UNAVAILABLE',
          error: 'Could not fetch this video. The tweet may be deleted, private, or contain no video.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Twitter video resolved via', result.via);

    // Prefer a lower-resolution variant for transcription (smaller download)
    let transcriptionVideoUrl = result.videoUrl;
    const resMatch = result.videoUrl.match(/(\/vid\/avc1\/)(\d+x\d+)(\/)/);
    if (resMatch) {
      for (const res of ['640x360', '320x180']) {
        const testUrl = result.videoUrl.replace(resMatch[0], `${resMatch[1]}${res}${resMatch[3]}`);
        if (await urlResolves(testUrl, 4000)) {
          transcriptionVideoUrl = testUrl;
          console.log('Lower quality variant:', res);
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: result.videoUrl,
        transcriptionVideoUrl,
        thumbnailUrl: result.thumbnailUrl,
        tweetId,
        provider: result.via,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Twitter video'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
