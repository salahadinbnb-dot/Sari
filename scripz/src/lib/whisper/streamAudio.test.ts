import { afterEach, describe, expect, it, vi } from "vitest";
import { streamAudio } from "./streamAudio";

const mock = vi.hoisted(() => ({
  dispose: vi.fn(),
  intervals: [] as number[][],
  duration: 65,
  decodable: true,
  hasTrack: true,
}));
vi.mock("mediabunny", () => ({
  ALL_FORMATS: [],
  CustomSource: class { constructor(public options: unknown) {} },
  Input: class {
    getPrimaryAudioTrack() {
      return Promise.resolve(mock.hasTrack ? {
        canDecode: async () => mock.decodable,
        computeDuration: async () => mock.duration,
      } : null);
    }
    dispose() { mock.dispose(); }
  },
  AudioBufferSink: class {
    async *buffers(start: number, end: number) {
      mock.intervals.push([start, end]);
      // A silent interval isolates sequencing from the browser's audio decoder.
      yield* [];
    }
  },
}));

function audioContext() {
  vi.stubGlobal("OfflineAudioContext", class {
    constructor(_channels: number, private length: number) {}
    async startRendering() { return { getChannelData: () => new Float32Array(this.length) }; }
  });
}
afterEach(() => {
  vi.unstubAllGlobals();
  mock.dispose.mockClear();
  mock.intervals.length = 0;
  mock.duration = 65;
  mock.decodable = mock.hasTrack = true;
});

describe("transcript-first audio streaming", () => {
  it("yields the first 30 seconds before requesting the rest", async () => {
    audioContext();
    const parts = streamAudio("https://example.com/video.mp4");
    const first = await parts.next();
    expect(first.value).toMatchObject({ start: 0, end: 30, duration: 65 });
    expect(first.value?.audio.length).toBe(30 * 16000);
    expect(mock.intervals).toEqual([[0, 30]]);
    await parts.next();
    expect(mock.intervals).toEqual([[0, 30], [30, 60]]);
    const last = await parts.next();
    expect(last.value).toMatchObject({ start: 60, end: 65 });
    expect(last.value?.audio.length).toBe(5 * 16000);
    expect((await parts.next()).done).toBe(true);
    expect(mock.dispose).toHaveBeenCalledTimes(1);
  });

  it("cancels without reading the next part and releases the decoder", async () => {
    audioContext();
    const controller = new AbortController();
    const parts = streamAudio("https://example.com/video.mp4", controller.signal);
    await parts.next();
    controller.abort();
    await expect(parts.next()).rejects.toThrow();
    expect(mock.intervals).toEqual([[0, 30]]);
    expect(mock.dispose).toHaveBeenCalledTimes(1);
  });

  it("releases the decoder when the consumer stops early", async () => {
    audioContext();
    const parts = streamAudio("https://example.com/video.mp4");
    await parts.next();
    await parts.return(undefined);
    expect(mock.dispose).toHaveBeenCalledTimes(1);
  });

  it.each(["missing", "unsupported", "duration"])("cleans up after %s audio", async (problem) => {
    if (problem === "missing") mock.hasTrack = false;
    if (problem === "unsupported") mock.decodable = false;
    if (problem === "duration") mock.duration = Infinity;
    await expect(streamAudio("https://example.com/video.mp4").next()).rejects.toThrow();
    expect(mock.dispose).toHaveBeenCalledTimes(1);
    expect(mock.intervals).toEqual([]);
  });
});
