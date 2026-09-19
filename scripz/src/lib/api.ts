import { supabase } from "@/integrations/supabase/client";
import type { SourceType } from "@/types/history";
import { whisperEngine, type EngineProgress } from "@/lib/whisper/engine";
import { decodeToWhisperPcm, fetchMediaBytes, isHlsUrl } from "@/lib/whisper/audio";
import { formatTranscript } from "@/lib/whisper/format";
import { getSettings, MODELS } from "@/lib/settings";

export type { SourceType };

export interface InstagramData {
  videoUrl: string;
  transcriptionVideoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  caption?: string;
  shortcode: string;
}

export interface YouTubeData {
  videoId: string;
  thumbnailUrl?: string;
  transcript: string;
  timestampedTranscript?: string;
}

export interface TwitterData {
  videoUrl: string;
  transcriptionVideoUrl?: string;
  thumbnailUrl?: string;
  tweetId: string;
}

export interface FacebookData {
  videoUrl: string;
  thumbnailUrl?: string;
  videoId: string;
}

export interface TranscriptResult {
  transcript: string;
  truncated?: boolean;
}

export function detectSourceType(url: string): SourceType | null {
  if (/instagram\.com\/(reel|p|reels|stories)\//.test(url)) return 'instagram';
  if (/(?:youtube\.com\/(?:watch|shorts|embed)|youtu\.be\/)/.test(url)) return 'youtube';
  if (/(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(url)) return 'twitter';
  if (/(?:facebook\.com\/(reel|watch|share\/(r|v)|[^/]+\/videos)|fb\.watch\/)/.test(url)) return 'facebook';
  return null;
}

export function extractYouTubeId(url: string): string {
  const m = url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

export async function fetchInstagramReel(url: string): Promise<InstagramData> {
  const { data, error } = await supabase.functions.invoke('fetch-instagram', { body: { url } });
  if (error) throw new Error(error.message || 'Failed to fetch Instagram reel');
  if (!data?.success) throw new Error(data?.error || 'Failed to fetch Instagram reel');
  return {
    videoUrl: data.videoUrl,
    thumbnailUrl: data.thumbnailUrl,
    duration: data.duration,
    caption: data.caption,
    shortcode: data.shortcode,
  };
}

/** Error from a Supabase edge function, with the HTTP status and body when available. */
export class EdgeFunctionError extends Error {
  constructor(message: string, public readonly status?: number, public readonly rateLimited = false) {
    super(message);
    this.name = "EdgeFunctionError";
  }
}

async function edgeFunctionError(error: unknown, fallback: string): Promise<EdgeFunctionError> {
  const anyErr = error as { message?: string; context?: Response };
  let status: number | undefined;
  let body: { error?: string; rateLimited?: boolean } | null = null;
  try {
    if (anyErr?.context && typeof anyErr.context.clone === "function") {
      const res = anyErr.context.clone();
      status = res.status;
      body = await res.json().catch(() => null);
    }
  } catch {
    /* no body */
  }
  return new EdgeFunctionError(body?.error || anyErr?.message || fallback, status, Boolean(body?.rateLimited) || status === 429);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchYouTubeTranscript(url: string): Promise<YouTubeData> {
  const { data, error } = await supabase.functions.invoke('fetch-youtube-transcript', { body: { url } });
  if (error) throw await edgeFunctionError(error, 'Failed to fetch YouTube transcript');
  if (!data?.success) throw new Error(data?.error || 'Failed to fetch YouTube transcript');
  return {
    videoId: data.videoId,
    thumbnailUrl: data.thumbnailUrl,
    transcript: data.transcript,
    timestampedTranscript: data.timestampedTranscript || '',
  };
}

/**
 * Captions from the primary service, retrying when it is rate-limited.
 * Resolves to null when the video simply has no captions there (so other routes can run).
 */
export async function fetchYouTubeTranscriptWithRetry(
  url: string,
  onStatus?: (detail: string) => void,
): Promise<YouTubeData | null> {
  const delays = [2500, 5000, 8000];
  for (let attempt = 0; ; attempt++) {
    try {
      const yt = await fetchYouTubeTranscript(url);
      return yt.transcript && yt.transcript.trim() ? yt : null;
    } catch (e) {
      const rateLimited = e instanceof EdgeFunctionError && e.rateLimited;
      if (rateLimited && attempt < delays.length) {
        onStatus?.(`Captions service is busy — retrying in ${Math.round(delays[attempt] / 1000)}s…`);
        await sleep(delays[attempt]);
        continue;
      }
      console.warn("Primary captions service failed:", e);
      return null;
    }
  }
}

export async function downloadYouTubeVideo(videoUrl: string): Promise<{ downloadUrl: string; title?: string }> {
  const { data, error } = await supabase.functions.invoke('download-youtube-video', { body: { videoUrl } });
  if (error) throw new Error(error.message || 'Failed to resolve YouTube video');
  if (!data?.success || !data.downloadUrl) throw new Error(data?.error || 'Failed to resolve YouTube video');
  return { downloadUrl: data.downloadUrl, title: data.title };
}

export async function fetchTwitterVideo(url: string): Promise<TwitterData> {
  const { data, error } = await supabase.functions.invoke('fetch-twitter-video', { body: { url } });
  if (error) throw new Error(error.message || 'Failed to fetch X video');
  if (!data?.success) throw new Error(data?.error || 'Failed to fetch X video');
  return {
    videoUrl: data.videoUrl,
    transcriptionVideoUrl: data.transcriptionVideoUrl,
    thumbnailUrl: data.thumbnailUrl,
    tweetId: data.tweetId,
  };
}

export async function fetchFacebookReel(url: string): Promise<FacebookData> {
  const { data, error } = await supabase.functions.invoke('fetch-facebook', { body: { url } });
  if (error) throw new Error(error.message || 'Failed to fetch Facebook reel');
  if (!data?.success) throw new Error(data?.error || 'Failed to fetch Facebook reel');
  return {
    videoUrl: data.videoUrl,
    thumbnailUrl: data.thumbnailUrl,
    videoId: data.videoId,
  };
}

/** Legacy cloud transcriber (Supabase edge function). Metered — only used as a fallback now. */
export async function transcribeVideo(videoUrl: string, transcriptionVideoUrl?: string): Promise<TranscriptResult> {
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: { videoUrl, transcriptionVideoUrl },
  });
  if (error) throw new Error(error.message || 'Failed to transcribe video');
  if (!data?.success) throw new Error(data?.error || 'Failed to transcribe video');
  return { transcript: data.transcript, truncated: data.truncated };
}

// ---------------------------------------------------------------------------
// On-device transcription (free, unlimited): fetch the media in the browser,
// decode the audio, run Whisper locally. The cloud function is used only when
// the visitor chose it or when the browser cannot fetch/decode the file.
// ---------------------------------------------------------------------------

export type TranscribeEngine = "device" | "cloud";

export interface TranscribeProgress {
  phase: "model" | "download" | "decode" | "transcribe" | "cloud";
  /** 0..1 for the current phase, or null when unknown. */
  fraction: number | null;
  detail: string;
  /** Secondary line, e.g. the one-time model download running alongside the video download. */
  sub?: string;
  /** Rolling preview of the transcript while it is being generated. */
  live?: string;
}

export interface MediaTranscript {
  transcript: string;
  timestampedTranscript: string;
  engine: TranscribeEngine;
  durationSeconds?: number;
}

export interface TranscribeCallbacks {
  onProgress?: (p: TranscribeProgress) => void;
  signal?: AbortSignal;
}

const fmtMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Merges media-side progress with the model download running in parallel. */
function progressChannel(onProgress?: (p: TranscribeProgress) => void) {
  let primary: TranscribeProgress = { phase: "download", fraction: null, detail: "Preparing…" };
  let modelLine: string | undefined;
  let modelReady = false;
  const emit = () => onProgress?.({ ...primary, sub: modelReady ? undefined : modelLine });
  return {
    set(p: TranscribeProgress) {
      primary = p;
      emit();
    },
    onEngine(p: EngineProgress) {
      if (p.phase === "model") {
        modelReady = p.fraction === 1 && /ready/i.test(p.detail);
        modelLine = modelReady ? undefined : p.detail;
      } else {
        primary = { phase: "transcribe", fraction: p.fraction, detail: p.detail, live: p.live };
      }
      emit();
    },
  };
}

async function whisperFromBytes(
  bytes: ArrayBuffer,
  model: string,
  language: string,
  channel: ReturnType<typeof progressChannel>,
  signal?: AbortSignal,
): Promise<MediaTranscript> {
  channel.set({ phase: "decode", fraction: null, detail: "Extracting the audio track…" });
  const { audio, duration } = await decodeToWhisperPcm(bytes);
  if (signal?.aborted) throw new Error("Cancelled");

  channel.set({ phase: "transcribe", fraction: 0, detail: "Transcribing on your device…" });
  const result = await whisperEngine.transcribe(audio, { model, language }, channel.onEngine);
  const formatted = formatTranscript(result.chunks, result.text);
  return {
    transcript: formatted.transcript || "[No speech detected]",
    timestampedTranscript: formatted.timestampedTranscript,
    engine: "device",
    durationSeconds: duration,
  };
}

async function cloudTranscript(videoUrl: string, transcriptionVideoUrl: string | undefined, channel: ReturnType<typeof progressChannel>) {
  channel.set({ phase: "cloud", fraction: null, detail: "Transcribing in the cloud…" });
  const cloud = await transcribeVideo(videoUrl, transcriptionVideoUrl);
  return { transcript: cloud.transcript, timestampedTranscript: "", engine: "cloud" as const };
}

export async function transcribeMedia(
  videoUrl: string,
  transcriptionVideoUrl: string | undefined,
  opts: TranscribeCallbacks = {},
): Promise<MediaTranscript> {
  const settings = getSettings();
  const channel = progressChannel(opts.onProgress);
  if (settings.engine === "cloud") return cloudTranscript(videoUrl, transcriptionVideoUrl, channel);

  const source = transcriptionVideoUrl || videoUrl;
  const model = MODELS[settings.model].id;

  let deviceError: unknown = null;
  try {
    if (isHlsUrl(source)) throw new Error("Streamed (HLS) sources need the cloud transcriber.");

    // Warm the model up while the video downloads.
    void whisperEngine.preload(model, channel.onEngine);
    channel.set({ phase: "download", fraction: null, detail: "Downloading the video…" });

    const bytes = await fetchMediaBytes(
      source,
      (loaded, total) =>
        channel.set({
          phase: "download",
          fraction: total ? loaded / total : null,
          detail: total ? `Downloading the video · ${fmtMb(loaded)} of ${fmtMb(total)}` : `Downloading the video · ${fmtMb(loaded)}`,
        }),
      opts.signal,
    );
    if (opts.signal?.aborted) throw new Error("Cancelled");
    return await whisperFromBytes(bytes, model, settings.language, channel, opts.signal);
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    deviceError = e;
  }

  if (!settings.cloudFallback) {
    throw deviceError instanceof Error ? deviceError : new Error("On-device transcription failed.");
  }
  console.warn("On-device transcription unavailable, using the cloud transcriber:", deviceError);
  channel.set({ phase: "cloud", fraction: null, detail: "This video can't be processed in the browser — using the cloud transcriber…" });
  return cloudTranscript(videoUrl, transcriptionVideoUrl, channel);
}

/** A video/audio file the visitor picked. Always on-device (the cloud function cannot take uploads). */
export async function transcribeLocalFile(file: File, opts: TranscribeCallbacks = {}): Promise<MediaTranscript> {
  const settings = getSettings();
  const channel = progressChannel(opts.onProgress);
  const model = MODELS[settings.model].id;
  void whisperEngine.preload(model, channel.onEngine);
  channel.set({ phase: "download", fraction: null, detail: `Reading ${file.name}…` });
  const bytes = await file.arrayBuffer();
  if (opts.signal?.aborted) throw new Error("Cancelled");
  return whisperFromBytes(bytes, model, settings.language, channel, opts.signal);
}
