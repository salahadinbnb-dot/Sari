// Turns Whisper chunks into the three shapes the UI already understands:
// a clean paragraph transcript, "[m:ss] text" lines, and SRT.
import type { WhisperChunk } from "./types";

const NOISE_ONLY = /^[\s[(]*(blank[_ ]audio|music|applause|laughter|noise|inaudible|silence)[\s\])]*$/i;

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function formatSrtTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function cleanChunkText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Drop empty chunks and pure noise markers like "[BLANK_AUDIO]" or "(music)". */
export function normalizeChunks(chunks: WhisperChunk[]): WhisperChunk[] {
  const out: WhisperChunk[] = [];
  for (const c of chunks) {
    const text = cleanChunkText(c.text);
    if (!text || NOISE_ONLY.test(text)) continue;
    const start = Number.isFinite(c.start) ? Math.max(0, c.start) : out.length ? (out[out.length - 1].end ?? out[out.length - 1].start) : 0;
    const end = c.end !== null && Number.isFinite(c.end) && c.end >= start ? c.end : null;
    out.push({ start, end, text });
  }
  return out;
}

export interface FormattedTranscript {
  transcript: string;
  timestampedTranscript: string;
}

/**
 * Build a readable transcript: paragraphs break on pauses longer than `pauseSeconds`
 * or once a paragraph grows past ~500 characters.
 */
export function formatTranscript(rawChunks: WhisperChunk[], fallbackText = "", pauseSeconds = 1.2): FormattedTranscript {
  const chunks = normalizeChunks(rawChunks);
  if (chunks.length === 0) {
    const text = cleanChunkText(fallbackText);
    return { transcript: text && !NOISE_ONLY.test(text) ? text : "", timestampedTranscript: "" };
  }

  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLength = 0;
  let previousEnd: number | null = null;

  for (const c of chunks) {
    const gap = previousEnd === null ? 0 : c.start - previousEnd;
    if (current.length > 0 && (gap > pauseSeconds || currentLength > 500)) {
      paragraphs.push(current.join(" "));
      current = [];
      currentLength = 0;
    }
    current.push(c.text);
    currentLength += c.text.length;
    previousEnd = c.end ?? c.start;
  }
  if (current.length > 0) paragraphs.push(current.join(" "));

  return {
    transcript: paragraphs.join("\n\n"),
    timestampedTranscript: chunks.map((c) => `[${formatClock(c.start)}] ${c.text}`).join("\n"),
  };
}

/** SRT with the model's real start/end times. */
export function chunksToSrt(rawChunks: WhisperChunk[]): string {
  const chunks = normalizeChunks(rawChunks);
  return chunks
    .map((c, i) => {
      const next = chunks[i + 1];
      const end = c.end ?? (next ? next.start : c.start + 3);
      return `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(Math.max(end, c.start + 0.5))}\n${c.text}\n`;
    })
    .join("\n");
}
