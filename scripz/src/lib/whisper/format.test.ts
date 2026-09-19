import { describe, expect, it } from "vitest";
import { chunksToSrt, formatClock, formatTranscript, normalizeChunks } from "./format";

describe("formatClock", () => {
  it("formats minutes and hours", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65.9)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("normalizeChunks", () => {
  it("drops empty and noise-only chunks and trims text", () => {
    const out = normalizeChunks([
      { start: 0, end: 2, text: "  Hello   there " },
      { start: 2, end: 4, text: " [BLANK_AUDIO] " },
      { start: 4, end: 6, text: "(music)" },
      { start: 6, end: null, text: "" },
      { start: 6, end: 8, text: "and welcome." },
    ]);
    expect(out).toEqual([
      { start: 0, end: 2, text: "Hello there" },
      { start: 6, end: 8, text: "and welcome." },
    ]);
  });
});

describe("formatTranscript", () => {
  it("joins chunks and breaks paragraphs on long pauses", () => {
    const { transcript, timestampedTranscript } = formatTranscript([
      { start: 0, end: 3, text: " First sentence." },
      { start: 3.2, end: 6, text: "Second sentence." },
      { start: 9, end: 12, text: "After a pause." },
    ]);
    expect(transcript).toBe("First sentence. Second sentence.\n\nAfter a pause.");
    expect(timestampedTranscript).toBe("[0:00] First sentence.\n[0:03] Second sentence.\n[0:09] After a pause.");
  });

  it("falls back to plain text when there are no usable chunks", () => {
    expect(formatTranscript([], "  Plain   text ")).toEqual({ transcript: "Plain text", timestampedTranscript: "" });
    expect(formatTranscript([], "[BLANK_AUDIO]").transcript).toBe("");
  });
});

describe("chunksToSrt", () => {
  it("uses real end times and closes open chunks with the next start", () => {
    const srt = chunksToSrt([
      { start: 0, end: 2.5, text: "Hi." },
      { start: 2.5, end: null, text: "Open chunk." },
      { start: 5, end: 7.25, text: "Bye." },
    ]);
    expect(srt).toBe(
      "1\n00:00:00,000 --> 00:00:02,500\nHi.\n\n2\n00:00:02,500 --> 00:00:05,000\nOpen chunk.\n\n3\n00:00:05,000 --> 00:00:07,250\nBye.\n",
    );
  });
});
