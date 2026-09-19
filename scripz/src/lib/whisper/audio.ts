// Fetches a media file in the browser and decodes its audio track to 16 kHz mono PCM,
// which is what Whisper expects.

export const WHISPER_SAMPLE_RATE = 16000;

export type DownloadProgress = (loadedBytes: number, totalBytes: number | null) => void;

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url);
}

export class MediaFetchError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "MediaFetchError";
  }
}

export async function fetchMediaBytes(url: string, onProgress?: DownloadProgress, signal?: AbortSignal): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new MediaFetchError("The video host does not allow this browser to download the file.");
  }
  if (!res.ok) throw new MediaFetchError(`Media download failed (${res.status}).`, res.status);

  const total = Number(res.headers.get("content-length")) || null;
  if (!res.body) return res.arrayBuffer();

  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.byteLength;
    onProgress?.(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out.buffer;
}

type OfflineCtor = typeof OfflineAudioContext;

function offlineContext(): OfflineCtor {
  const w = window as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  const ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!ctor) throw new Error("This browser cannot decode audio.");
  return ctor;
}

async function resample(data: Float32Array, fromRate: number, toRate: number): Promise<Float32Array> {
  const Ctor = offlineContext();
  const length = Math.ceil((data.length * toRate) / fromRate);
  const ctx = new Ctor(1, length, toRate);
  const buffer = ctx.createBuffer(1, data.length, fromRate);
  buffer.getChannelData(0).set(data);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

/** Decode any container the browser understands (mp4/aac, webm/opus, mp3…) to 16 kHz mono. */
export async function decodeToWhisperPcm(bytes: ArrayBuffer): Promise<{ audio: Float32Array; duration: number }> {
  const Ctor = offlineContext();
  // Decoding on a 16 kHz context makes most browsers resample for us; some refuse that rate,
  // in which case we decode at a standard rate and resample below.
  let ctx: OfflineAudioContext;
  try {
    ctx = new Ctor(1, 1, WHISPER_SAMPLE_RATE);
  } catch {
    ctx = new Ctor(1, 1, 44100);
  }
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(bytes);
  } catch {
    throw new Error("This browser could not decode the audio in this video.");
  }

  let mono: Float32Array;
  if (decoded.numberOfChannels === 1) {
    mono = decoded.getChannelData(0);
  } else {
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
    mono = new Float32Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      let sum = 0;
      for (const ch of channels) sum += ch[i];
      mono[i] = sum / channels.length;
    }
  }

  if (decoded.sampleRate !== WHISPER_SAMPLE_RATE) {
    mono = await resample(mono, decoded.sampleRate, WHISPER_SAMPLE_RATE);
  }

  // Copy out of the AudioBuffer so the PCM can be transferred to the worker.
  const audio = new Float32Array(mono);
  return { audio, duration: audio.length / WHISPER_SAMPLE_RATE };
}
