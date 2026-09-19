/**
 * Pure helpers for assembling a multi-segment transcript.
 * Kept free of DOM/network so they can be unit-tested deterministically.
 */

export interface SegmentResult {
  index: number;
  text: string | null;
  error?: string;
}

export interface StitchOutcome {
  transcript: string;
  complete: boolean;
  segmentsCompleted: number;
  segmentsTotal: number;
  /** Index of the first segment that failed, or null when everything succeeded. */
  firstMissingIndex: number | null;
  error: string | null;
}

const NO_SPEECH = /^\[no speech[^\]]*\]$/i;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Remove a genuine repeated overlap at the boundary of two consecutive segments.
 * Only trims when the tail of `prev` and the head of `next` match word-for-word
 * (normalized: casing and punctuation ignored, punctuation-only tokens skipped)
 * for at least `minWords` words — never on a loose similarity guess.
 */
export function dedupeBoundary(prev: string, next: string, maxWords = 40, minWords = 3): string {
  const tokenize = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((raw, idx) => ({ raw, idx, norm: normalize(raw) }));

  const nextRaw = next.trim().split(/\s+/).filter(Boolean);
  const prevTokens = tokenize(prev).filter((t) => t.norm);
  const nextTokens = tokenize(next).filter((t) => t.norm);
  if (prevTokens.length < minWords || nextTokens.length < minWords) return next.trim();

  const limit = Math.min(maxWords, prevTokens.length, nextTokens.length);
  for (let n = limit; n >= minWords; n--) {
    const tail = prevTokens.slice(prevTokens.length - n).map((t) => t.norm).join(" ");
    const head = nextTokens.slice(0, n).map((t) => t.norm).join(" ");
    if (tail && tail === head) {
      // Drop everything up to and including the last matched original token.
      const cut = nextTokens[n - 1].idx + 1;
      return nextRaw.slice(cut).join(" ").trim();
    }
  }
  return next.trim();
}

/** Stitch ordered segment results, returning honest completion metadata. */
export function stitchSegments(results: SegmentResult[], segmentsTotal: number): StitchOutcome {
  const ordered = [...results].sort((a, b) => a.index - b.index);

  let firstMissingIndex: number | null = null;
  let failureMessage: string | null = null;
  const present = new Map<number, string>();

  for (let i = 0; i < segmentsTotal; i++) {
    const found = ordered.find((r) => r.index === i);
    if (!found || found.text === null || found.text === undefined) {
      if (firstMissingIndex === null) {
        firstMissingIndex = i;
        failureMessage = found?.error ?? `Segment ${i + 1} of ${segmentsTotal} did not complete.`;
      }
      continue;
    }
    present.set(i, found.text);
  }

  const pieces: string[] = [];
  for (let i = 0; i < segmentsTotal; i++) {
    const raw = present.get(i);
    if (raw === undefined) continue;
    const cleaned = raw.trim();
    if (!cleaned || NO_SPEECH.test(cleaned)) continue;
    if (pieces.length === 0) {
      pieces.push(cleaned);
      continue;
    }
    const deduped = dedupeBoundary(pieces[pieces.length - 1], cleaned);
    if (deduped) pieces.push(deduped);
  }

  const segmentsCompleted = present.size;
  const complete = segmentsCompleted === segmentsTotal && segmentsTotal > 0;

  return {
    transcript: pieces.join("\n\n").trim(),
    complete,
    segmentsCompleted,
    segmentsTotal,
    firstMissingIndex,
    error: complete
      ? null
      : failureMessage ?? `Only ${segmentsCompleted} of ${segmentsTotal} segments completed.`,
  };
}
