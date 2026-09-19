import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ExtractedMedia, tryRapidProvider, urlResolves } from "../_shared/media.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    console.log('Fetching Instagram reel:', url);

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RapidAPI key not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shortcodeMatch = url.match(/(?:reel|p|reels|stories\/[A-Za-z0-9._]+)\/([A-Za-z0-9_-]+)/);
    if (!shortcodeMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid Instagram URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const shortcode = shortcodeMatch[1];
    console.log('Extracted shortcode:', shortcode);

    const encoded = encodeURIComponent(url);

    // Most reliable general-purpose downloaders first, then Instagram-specific scrapers.
    const providers = [
      {
        name: 'auto-download-all-in-one',
        host: 'auto-download-all-in-one-big.p.rapidapi.com',
        endpoint: `https://auto-download-all-in-one-big.p.rapidapi.com/v1/social/autolink?url=${encoded}`,
      },
      {
        name: 'social-media-video-downloader',
        host: 'social-media-video-downloader.p.rapidapi.com',
        endpoint: `https://social-media-video-downloader.p.rapidapi.com/smvd/get/all?url=${encoded}`,
      },
      {
        name: 'instagram-story-downloader',
        host: 'instagram-story-downloader-media-downloader.p.rapidapi.com',
        endpoint: `https://instagram-story-downloader-media-downloader.p.rapidapi.com/index?url=${encoded}`,
      },
      {
        name: 'instagram-scraper-api2',
        host: 'instagram-scraper-api2.p.rapidapi.com',
        endpoint: `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=${encoded}&include_insights=true`,
      },
      {
        name: 'instagram-bulk-scraper',
        host: 'instagram-bulk-scraper-latest.p.rapidapi.com',
        endpoint: `https://instagram-bulk-scraper-latest.p.rapidapi.com/media_info_v2?shortcode=${shortcode}`,
      },
    ];

    let extracted: ExtractedMedia | null = null;
    for (const p of providers) {
      const candidate = await tryRapidProvider(p.name, p.host, p.endpoint, rapidApiKey);
      if (!candidate?.videoUrl) continue;
      if (!(await urlResolves(candidate.videoUrl))) {
        console.log(`[${p.name}] extracted URL did not resolve — trying next provider`);
        continue;
      }
      console.log(`Instagram video resolved via ${p.name}`);
      extracted = candidate;
      break;
    }

    if (!extracted?.videoUrl) {
      console.log('All Instagram providers exhausted for', shortcode);
      return new Response(
        JSON.stringify({
          success: false,
          fallback: true,
          code: 'INSTAGRAM_EXTRACTION_UNAVAILABLE',
          error: 'Could not extract video from this Instagram post. The post may be private, region-locked, or all our providers are temporarily unavailable. Please try again in a moment.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        videoUrl: extracted.videoUrl,
        thumbnailUrl: extracted.thumbnailUrl,
        duration: extracted.duration,
        caption: extracted.caption,
        shortcode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-instagram function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
