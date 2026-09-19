import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TELEGRAM_GATEWAY = 'https://connector-gateway.lovable.dev/telegram';

async function deriveTelegramWebhookSecret(telegramApiKey: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-webhook:${telegramApiKey}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function detectSourceType(url: string): 'instagram' | 'youtube' | 'twitter' | 'facebook' | null {
  if (/instagram\.com\/(reel|p|reels|stories)\//.test(url)) return 'instagram';
  if (/(?:youtube\.com\/(?:watch|shorts|embed)|youtu\.be\/)/.test(url)) return 'youtube';
  if (/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url)) return 'twitter';
  if (/(?:facebook\.com\/(reel|watch|share\/(r|v)|[^/]+\/videos)|fb\.watch\/)/.test(url)) return 'facebook';
  return null;
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

async function tg(method: string, body: any, telegramKey: string, lovableKey: string) {
  const r = await fetch(`${TELEGRAM_GATEWAY}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function tgSendDocument(chatId: number, filename: string, content: Uint8Array, mime: string, caption: string | undefined, telegramKey: string, lovableKey: string) {
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  if (caption) fd.append('caption', caption);
  fd.append('document', new Blob([content], { type: mime }), filename);
  const r = await fetch(`${TELEGRAM_GATEWAY}/sendDocument`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
    },
    body: fd,
  });
  return r.json();
}

async function tgSendVideoFromUrl(chatId: number, videoUrl: string, telegramKey: string, lovableKey: string) {
  return tg('sendVideo', { chat_id: chatId, video: videoUrl, supports_streaming: true }, telegramKey, lovableKey);
}

function buildSrt(transcript: string): string {
  // Naive SRT: split into ~10-word chunks, 3s each starting at 0
  const words = transcript.replace(/\s+/g, ' ').trim().split(' ');
  const chunkSize = 10;
  const dur = 3;
  let srt = '';
  let idx = 1;
  for (let i = 0; i < words.length; i += chunkSize) {
    const start = (idx - 1) * dur;
    const end = idx * dur;
    const fmt = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = (s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec},000`;
    };
    srt += `${idx}\n${fmt(start)} --> ${fmt(end)}\n${words.slice(i, i + chunkSize).join(' ')}\n\n`;
    idx++;
  }
  return srt;
}

async function invokeFn(name: string, body: any) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${name}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function processUrl(chatId: number, url: string, telegramKey: string, lovableKey: string) {
  const source = detectSourceType(url);
  if (!source) {
    await tg('sendMessage', { chat_id: chatId, text: '❌ Send a valid Instagram, YouTube, Twitter/X, or Facebook URL.' }, telegramKey, lovableKey);
    return;
  }

  await tg('sendMessage', { chat_id: chatId, text: `⏳ Unpacking ${source} link...` }, telegramKey, lovableKey);

  try {
    let videoUrl = '';
    let transcript = '';

    if (source === 'youtube') {
      const yt = await invokeFn('fetch-youtube-transcript', { url });
      if (!yt.success) throw new Error(yt.error || 'YouTube fetch failed');
      transcript = yt.transcript;
      videoUrl = `https://www.youtube.com/watch?v=${yt.videoId}`;
    } else {
      const fnName = source === 'instagram' ? 'fetch-instagram' : source === 'twitter' ? 'fetch-twitter-video' : 'fetch-facebook';
      const fetched = await invokeFn(fnName, { url });
      if (!fetched.success) throw new Error(fetched.error || `${source} fetch failed`);
      videoUrl = fetched.videoUrl;
      const t = await invokeFn('transcribe-audio', { videoUrl });
      if (!t.success) throw new Error(t.error || 'Transcription failed');
      transcript = t.transcript;
    }

    // 1. Send transcript (chunked if long)
    const maxLen = 3800;
    if (transcript.length <= maxLen) {
      await tg('sendMessage', { chat_id: chatId, text: `📝 *Transcript*\n\n${transcript}`, parse_mode: 'Markdown' }, telegramKey, lovableKey);
    } else {
      for (let i = 0; i < transcript.length; i += maxLen) {
        await tg('sendMessage', { chat_id: chatId, text: transcript.slice(i, i + maxLen) }, telegramKey, lovableKey);
      }
    }

    // 2. Send SRT subtitle file
    const srt = buildSrt(transcript);
    await tgSendDocument(chatId, 'subtitles.srt', new TextEncoder().encode(srt), 'application/x-subrip', '🎬 Subtitles (.srt)', telegramKey, lovableKey);

    // 3. Send video (Telegram bot upload limit ~50MB; use URL so Telegram fetches it)
    if (source === 'youtube') {
      await tg('sendMessage', { chat_id: chatId, text: `🎥 Video: ${videoUrl}` }, telegramKey, lovableKey);
    } else {
      const vid = await tgSendVideoFromUrl(chatId, videoUrl, telegramKey, lovableKey);
      if (!vid.ok) {
        await tg('sendMessage', { chat_id: chatId, text: `🎥 Video link: ${videoUrl}` }, telegramKey, lovableKey);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    await tg('sendMessage', { chat_id: chatId, text: `❌ Error: ${msg}` }, telegramKey, lovableKey);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!TELEGRAM_API_KEY || !LOVABLE_API_KEY) {
    return new Response('Missing config', { status: 500 });
  }

  const expected = await deriveTelegramWebhookSecret(TELEGRAM_API_KEY);
  const actual = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!safeEqual(actual, expected)) return new Response('Unauthorized', { status: 401 });

  let update: any;
  try { update = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  const text: string = message?.text ?? '';

  if (!chatId) return new Response(JSON.stringify({ ok: true }));

  // Idempotency: store update_id
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await supabase.from('telegram_updates').insert({ update_id: update.update_id });
    if (error && !error.message.includes('duplicate')) console.warn('insert err', error.message);
    if (error?.message.includes('duplicate')) return new Response(JSON.stringify({ ok: true }));
  } catch (e) { console.warn('idempotency check failed', e); }

  if (text === '/start' || text === '/help') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: '👋 *ReelGrab Studio Bot*\n\nSend me an Instagram, YouTube, Twitter/X, or Facebook link and I will reply with:\n\n📝 Full transcript\n🎬 Subtitle file (.srt)\n🎥 Original video\n\nGo on, paste a link!',
      parse_mode: 'Markdown',
    }, TELEGRAM_API_KEY, LOVABLE_API_KEY);
    return new Response(JSON.stringify({ ok: true }));
  }

  const url = extractUrl(text);
  if (!url) {
    await tg('sendMessage', { chat_id: chatId, text: 'Send me a reel/video link to unpack 🎬' }, TELEGRAM_API_KEY, LOVABLE_API_KEY);
    return new Response(JSON.stringify({ ok: true }));
  }

  // Process in background so Telegram doesn't time out
  // @ts-ignore EdgeRuntime
  if (typeof EdgeRuntime !== 'undefined') {
    // @ts-ignore
    EdgeRuntime.waitUntil(processUrl(chatId, url, TELEGRAM_API_KEY, LOVABLE_API_KEY));
  } else {
    processUrl(chatId, url, TELEGRAM_API_KEY, LOVABLE_API_KEY);
  }

  return new Response(JSON.stringify({ ok: true }));
});
