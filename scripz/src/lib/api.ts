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

export async function fetchYouTubeTranscript(url: string): Promise<YouTubeData> {
  const { data, error } = await supabase.functions.invoke('fetch-youtube-transcript', { body: { url } });
  if (error) throw new Error(error.message || 'Failed to fetch YouTube transcript');
  if (!data?.success) throw new Error(data?.error || 'Failed to fetch YouTube transcript');
  return {
    videoId: data.videoId,
    thumbnailUrl: data.thumbnailUrl,
    transcript: data.transcript,
    timestampedTranscript: data.timestampedTranscript || '',
  };
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
// decode the audio, run Whisper locally. Falls back to the cloud function only
// when the browser cannot fetch or decode the file.
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

const fmtMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export async function transcribeMedia(
  videoUrl: string,
  transcriptionVideoUrl: string | undefined,
  opts: { onProgress?: (p: TranscribeProgress) => void; signal?: AbortSignal } = {},
): Promise<MediaTranscript> {
  const settings = getSettings();
  const source = transcriptionVideoUrl || videoUrl;
  const model = MODELS[settings.model].id;

  let primary: TranscribeProgress = { phase: "download", fraction: null, detail: "Downloading the video…" };
  let modelLine: string | undefined;
  let modelReady = false;
  const emit = () => opts.onProgress?.({ ...primary, sub: modelReady ? undefined : modelLine });
  const onEngine = (p: EngineProgress) => {
    if (p.phase === "model") {
      modelReady = p.fraction === 1 && /ready/i.test(p.detail);
      modelLine = modelReady ? undefined : p.detail;
    } else {
      primary = { phase: "transcribe", fraction: p.fraction, detail: p.detail, live: p.live };
    }
    emit();
  };

  let deviceError: unknown = null;
  try {
    if (isHlsUrl(source)) throw new Error("Streamed (HLS) sources need the cloud transcriber.");

    // Warm the model up while the video downloads.
    void whisperEngine.preload(model, onEngine);
    emit();

    const bytes = await fetchMediaBytes(
      source,
      (loaded, total) => {
        primary = {
          phase: "download",
          fraction: total ? loaded / total : null,
          detail: total ? `Downloading the video · ${fmtMb(loaded)} of ${fmtMb(total)}` : `Downloading the video · ${fmtMb(loaded)}`,
        };
        emit();
      },
      opts.signal,
    );
    if (opts.signal?.aborted) throw new Error("Cancelled");

    primary = { phase: "decode", fraction: null, detail: "Extracting the audio track…" };
    emit();
    const { audio, duration } = await decodeToWhisperPcm(bytes);
    if (opts.signal?.aborted) throw new Error("Cancelled");

    primary = { phase: "transcribe", fraction: 0, detail: "Transcribing on your device…" };
    emit();
    const result = await whisperEngine.transcribe(audio, { model, language: settings.language }, onEngine);
    const formatted = formatTranscript(result.chunks, result.text);
    return {
      transcript: formatted.transcript || "[No speech detected]",
      timestampedTranscript: formatted.timestampedTranscript,
      engine: "device",
      durationSeconds: duration,
    };
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    deviceError = e;
  }

  if (!settings.cloudFallback) {
    throw deviceError instanceof Error ? deviceError : new Error("On-device transcription failed.");
  }

  console.warn("On-device transcription unavailable, using the cloud transcriber:", deviceError);
  opts.onProgress?.({
    phase: "cloud",
    fraction: null,
    detail: "This video can't be processed in the browser — using the cloud transcriber…",
  });
  const cloud = await transcribeVideo(videoUrl, transcriptionVideoUrl);
  return { transcript: cloud.transcript, timestampedTranscript: "", engine: "cloud" };
}
