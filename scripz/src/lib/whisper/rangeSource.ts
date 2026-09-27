// Never accept a full-file response when transcription only requested a byte range.
export function createRangeReader(url: string, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  let size: number | undefined;
  // AAC packets are tiny. Cache a few bounded pages so decoding one second does
  // not require dozens of network round trips. Never prefetch the rest of a file.
  const pageSize = 64 * 1024;
  const pages = new Map<number, Uint8Array>();
  const read = async (start: number, end: number): Promise<Uint8Array> => {
    signal?.throwIfAborted();
    const response = await fetcher(url, {
      headers: { Range: `bytes=${start}-${end - 1}` },
      credentials: "omit", mode: "cors", referrerPolicy: "no-referrer", signal,
    });
    const rangeHeader = response.headers.get("content-range");
    const range = rangeHeader?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (response.status !== 206 || (rangeHeader !== null && (!range || Number(range[1]) !== start || Number(range[2]) !== end - 1))) {
      await response.body?.cancel();
      throw new Error(`This host did not return the requested audio range (HTTP ${response.status}). The full video was not downloaded.`);
    }
    // Content-Range is not CORS-safelisted. X permits Range requests but does
    // not expose that header; HEAD gives its full Content-Length without a body.
    let total = range ? Number(range[3]) : size;
    if (total === undefined) {
      const head = await fetcher(url, {
        method: "HEAD", credentials: "omit", mode: "cors",
        referrerPolicy: "no-referrer", signal,
      });
      await head.body?.cancel();
      total = head.ok ? Number(head.headers.get("content-length")) : NaN;
    }
    if (!Number.isSafeInteger(total) || total < end) {
      await response.body?.cancel();
      throw new Error("The video host did not provide a usable file size for audio range reads.");
    }
    if (size !== undefined && total !== size) {
      await response.body?.cancel();
      throw new Error("The source video changed while reading its audio. Please retry.");
    }
    size = total;
    const expected = end - start;
    const length = response.headers.get("content-length");
    if (length !== null && Number(length) !== expected) {
      await response.body?.cancel();
      throw new Error("The source ignored the requested byte range.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The source returned no audio data.");
    const result = new Uint8Array(expected);
    let offset = 0;
    try {
      for (;;) {
        signal?.throwIfAborted();
        const { done, value } = await reader.read();
        if (done) break;
        if (offset + value.length > expected) throw new Error("The source ignored the requested byte range.");
        result.set(value, offset);
        offset += value.length;
      }
      if (offset !== expected) throw new Error("Incomplete audio data. Please retry.");
      return result;
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  };
  return {
    async getSize() { if (size === undefined) await read(0, 1); return size!; },
    async read(start: number, end: number) {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end - start > 16 * 1024 * 1024) {
        throw new Error("Invalid or oversized audio metadata range.");
      }
      signal?.throwIfAborted();
      const pageStart = Math.floor(start / pageSize) * pageSize;
      if (size !== undefined && end <= Math.min(pageStart + pageSize, size)) {
        let page = pages.get(pageStart);
        if (!page) {
          page = await read(pageStart, Math.min(pageStart + pageSize, size));
          if (pages.size >= 8) pages.delete(pages.keys().next().value!);
          pages.set(pageStart, page);
        }
        return page.slice(start - pageStart, end - pageStart);
      }
      return read(start, end);
    },
  };
}
