import { describe, expect, it } from "vitest";
import { cuesToCaptions, parseCaptionTrack, parseTtml, parseVtt } from "./youtubeMirrors";

const ROLLING_VTT = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:02.500
<c>hello</c> everyone welcome

00:00:02.500 --> 00:00:05.000
hello everyone welcome to the show

00:00:05.000 --> 00:00:07.000
to the show

00:00:07.000 --> 00:01:09.250
today we talk about &amp; things.
`;

describe("parseVtt", () => {
  it("strips tags, entities and YouTube's rolling duplicates", () => {
    expect(parseVtt(ROLLING_VTT)).toEqual([
      { start: 0, text: "hello everyone welcome" },
      { start: 2.5, text: "to the show" },
      { start: 7, text: "today we talk about & things." },
    ]);
  });
});

describe("cuesToCaptions", () => {
  it("builds transcript and timestamped lines", () => {
    const out = cuesToCaptions([
      { start: 0, text: "First line." },
      { start: 65, text: "Second line" },
    ]);
    expect(out).toEqual({
      transcript: "First line.\n\nSecond line",
      timestampedTranscript: "[0:00] First line.\n[1:05] Second line",
    });
    expect(cuesToCaptions([])).toBeNull();
  });
});

const TTML = `<?xml version="1.0" encoding="utf-8" ?>
<tt xml:lang="en" xmlns="http://www.w3.org/ns/ttml"><body><div>
<p begin="00:00:00.000" end="00:00:02.000" style="s2">We&#39;re no strangers<br/>to love</p>
<p begin="00:00:02.000" end="00:00:04.500" style="s2">You know the rules &amp; so do I</p>
<p begin="00:01:04.500" end="00:01:06.000" style="s2">You know the rules &amp; so do I</p>
</div></body></tt>`;

describe("parseTtml", () => {
  it("reads begin times, joins line breaks and drops repeats", () => {
    expect(parseTtml(TTML)).toEqual([
      { start: 0, text: "We're no strangers to love" },
      { start: 2, text: "You know the rules & so do I" },
    ]);
  });

  it("is picked automatically by parseCaptionTrack", () => {
    expect(parseCaptionTrack(TTML).length).toBe(2);
    expect(parseCaptionTrack(ROLLING_VTT).length).toBe(3);
  });
});
