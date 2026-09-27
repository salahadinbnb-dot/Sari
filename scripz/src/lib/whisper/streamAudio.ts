import { createRangeReader } from "./rangeSource";

const SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 30;

export interface AudioPart { audio: Float32Array; start: number; end: number; duration: number }

/** Read ONLY audio-track packets and yield the first 30 seconds before reading the rest. */
export async function* streamAudio(url: string, signal?: AbortSignal): AsyncGenerator<AudioPart> {
  signal?.throwIfAborted();
  const lib = await import("mediabunny");
  signal?.throwIfAborted();
  const controller = new AbortController();
  const stop = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", stop, { once: true });
  const input = new lib.Input({
    formats: lib.ALL_FORMATS,
    source: new lib.CustomSource({
      ...createRangeReader(url, controller.signal),
      maxCacheSize: 4 * 1024 * 1024,
      prefetchProfile: "none",
    }),
  });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("This video has no audio track.");
    if (!(await track.canDecode())) throw new Error("This browser cannot decode this audio codec. Try Chrome or the cloud engine.");
    const duration = await track.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not determine the audio duration.");
    const sink = new lib.AudioBufferSink(track);
    for (let start = 0; start < duration; start += CHUNK_SECONDS) {
      signal?.throwIfAborted();
      const end = Math.min(start + CHUNK_SECONDS, duration);
      const context = new OfflineAudioContext(1, Math.ceil((end - start) * SAMPLE_RATE), SAMPLE_RATE);
      for await (const { buffer, timestamp } of sink.buffers(start, end)) {
        signal?.throwIfAborted();
        const from = Math.max(start, timestamp);
        const to = Math.min(end, timestamp + buffer.duration);
        if (to <= from) continue;
        // Explicit average of all channels, not speaker-layout dependent downmixing.
        const mono = context.createBuffer(1, buffer.length, buffer.sampleRate);
        const samples = mono.getChannelData(0);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const channel = buffer.getChannelData(c);
          for (let i = 0; i < samples.length; i++) samples[i] += channel[i] / buffer.numberOfChannels;
        }
        const source = context.createBufferSource();
        source.buffer = mono;
        source.connect(context.destination);
        source.start(from - start, from - timestamp, to - from);
      }
      const rendered = await context.startRendering();
      signal?.throwIfAborted();
      yield { audio: new Float32Array(rendered.getChannelData(0)), start, end, duration };
      // The caller transcribes this chunk before requesting another: natural backpressure.
    }
  } finally {
    signal?.removeEventListener("abort", stop);
    controller.abort();
    input.dispose();
  }
}

