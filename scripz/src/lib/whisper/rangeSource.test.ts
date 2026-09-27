import { describe, expect, it, vi } from "vitest";
import { createRangeReader } from "./rangeSource";

describe("transcription range reads", () => {
  it("probes one byte, not the full video", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1]), {
      status: 206, headers: { "Content-Range": "bytes 0-0/1000000000" },
    }));
    const reader = createRangeReader("https://example.com/video.mp4", undefined, fetcher);
    expect(await reader.getSize()).toBe(1000000000);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Range")).toBe("bytes=0-0");
    await reader.getSize();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cancels a host that ignores Range before buffering its 1 GB video", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({ cancel });
    const fetcher = vi.fn(async () => new Response(body, { status: 200,
      headers: { "Content-Length": "1000000000" } }));
    await expect(createRangeReader("https://example.com/video.mp4", undefined, fetcher).getSize())
      .rejects.toThrow("full video was not downloaded");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("reads only the requested audio bytes", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([2, 3]), {
      status: 206, headers: { "Content-Range": "bytes 12-13/1000" },
    }));
    expect(await createRangeReader("https://example.com/v.mp4", undefined, fetcher).read(12, 14))
      .toEqual(new Uint8Array([2, 3]));
  });

  it.each([
    ["bytes 5-6/1000", [1, 2]],
    ["bytes 0-1/1000", [1]],
    ["bytes 0-1/1000", [1, 2, 3]],
  ])("rejects incorrect, short and oversized ranges", async (range, data) => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array(data as number[]), {
      status: 206, headers: { "Content-Range": range as string },
    }));
    await expect(createRangeReader("https://example.com/v.mp4", undefined, fetcher).read(0, 2)).rejects.toThrow();
  });

  it("does not fetch after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    await expect(createRangeReader("https://example.com/v.mp4", controller.signal, fetcher).getSize()).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("coalesces tiny audio packets into bounded 64 KB reads", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const range = new Headers(init?.headers).get("Range")!;
      const [, a, b] = range.match(/bytes=(\d+)-(\d+)/)!;
      return new Response(new Uint8Array(Number(b) - Number(a) + 1), {
        status: 206, headers: { "Content-Range": `bytes ${a}-${b}/1000000000` },
      });
    });
    const reader = createRangeReader("https://example.com/video.mp4", undefined, fetcher);
    await reader.getSize();
    expect((await reader.read(100, 200)).length).toBe(100);
    expect((await reader.read(200, 400)).length).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get("Range")).toBe("bytes=0-65535");
  });

  it("supports X CDN CORS when Content-Range is not exposed", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      if (init?.method === "HEAD") return new Response(null, {
        status: 200, headers: { "Content-Length": "1000000000" },
      });
      const [, a, b] = new Headers(init?.headers).get("Range")!.match(/bytes=(\d+)-(\d+)/)!;
      const length = Number(b) - Number(a) + 1;
      return new Response(new Uint8Array(length), {
        status: 206, headers: { "Content-Length": String(length) },
      });
    });
    const reader = createRangeReader("https://video.twimg.com/video.mp4", undefined, fetcher);
    expect(await reader.getSize()).toBe(1000000000);
    expect((await reader.read(100, 200)).length).toBe(100);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "HEAD")).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects a 206 response with an oversized Content-Length before buffering", async () => {
    const cancel = vi.fn();
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ cancel }), {
      status: 206, headers: { "Content-Range": "bytes 0-0/1000000000", "Content-Length": "1000000000" },
    }));
    await expect(createRangeReader("https://example.com/video.mp4", undefined, fetcher).getSize()).rejects.toThrow();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
