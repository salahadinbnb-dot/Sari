import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractFacebookId(url: string): string {
  // Try to extract reel id, video id, or post id from various FB URL shapes
  const patterns = [
    /facebook\.com\/reel\/(\d+)/i,
    /facebook\.com\/[^/]+\/videos\/(\d+)/i,
    /facebook\.com\/watch\/?\?v=(\d+)/i,
    /facebook\.com\/share\/r\/([A-Za-z0-9_-]+)/i,
    /facebook\.com\/share\/v\/([A-Za-z0-9_-]+)/i,
    /fb\.watch\/([A-Za-z0-9_-]+)/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return url;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching Facebook reel:', url);

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RAPIDAPI_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractFacebookId(url);

    // Try cobalt.tools first (free, reliable, no subscription)
    const cobaltInstances = ['https://api.cobalt.tools', 'https://cobalt-api.kwiatekmiki.com', 'https://co.wuk.sh'];
    for (const base of cobaltInstances) {
      try {
        const r = await fetch(base + '/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          body: JSON.stringify({ url, videoQuality: '720', filenameStyle: 'basic' }),
        });
        if (!r.ok) { await r.text(); continue; }
        const d = await r.json();
        const vurl = d.url || d.tunnel || d.picker?.find((p: any) => p.type === 'video')?.url;
        if (vurl && (d.status === 'tunnel' || d.status === 'redirect' || d.status === 'stream' || d.picker)) {
          console.log('facebook: cobalt success via', base);
          return new Response(
            JSON.stringify({ success: true, videoUrl: vurl, thumbnailUrl: null, videoId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) { console.log('cobalt fb error:', e); }
    }

    // Fallback: RapidAPI facebook downloader
    const apiUrl = `https://facebook-reel-and-video-downloader.p.rapidapi.com/app/main.php?url=${encodeURIComponent(url)}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'facebook-reel-and-video-downloader.p.rapidapi.com',
      },
    });

    console.log('Facebook RapidAPI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Facebook RapidAPI error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Could not fetch Facebook video. Make sure the reel/video is public.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    let videoUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    if (data.links && typeof data.links === 'object') {
      videoUrl = data.links['Download High Quality']
        || data.links['Download Low Quality']
        || data.links.hd
        || data.links.sd
        || Object.values(data.links)[0] as string;
      thumbnailUrl = data.thumbnail || data.picture || null;
    } else if (data.video_hd || data.video_sd) {
      videoUrl = data.video_hd || data.video_sd;
      thumbnailUrl = data.thumbnail || data.picture || null;
    } else if (data.url) {
      videoUrl = data.url;
      thumbnailUrl = data.thumbnail || null;
    } else if (Array.isArray(data) && data.length > 0) {
      videoUrl = data[0].url || data[0].video || null;
      thumbnailUrl = data[0].thumbnail || null;
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'No video found in this Facebook URL. Make sure it is a public reel or video.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl,
        thumbnailUrl,
        videoId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-facebook function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
