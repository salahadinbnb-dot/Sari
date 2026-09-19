/// <reference lib="webworker" />
// Runs Whisper entirely inside the browser (WebGPU when available, WebAssembly otherwise).
// Nothing leaves the device: no API keys, no usage limits, no cloud credits.
import { env, pipeline, WhisperTextStreamer, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { WhisperChunk, WhisperDevice, WorkerInbound, WorkerOutbound } from "./types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

env.allowLocalModels = false;
env.useBrowserCache = true;
// The ONNX Runtime WebAssembly binaries are copied into public/ort/ at build time (scripts/copy-ort-wasm.mjs).
env.backends.onnx.wasm!.wasmPaths = `${ctx.location.origin}${import.meta.env.BASE_URL}ort/`;

const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;
const SAMPLE_RATE = 16000;

const post = (msg: WorkerOutbound) => ctx.postMessage(msg);

type Loaded = { key: string; promise: Promise<AutomaticSpeechRecognitionPipeline> };
let loaded: Loaded | null = null;

function dtypeFor(device: WhisperDevice) {
  // Mirrors the transformers.js Whisper demos: WebGPU wants an fp32 encoder + 4-bit decoder,
  // the WebAssembly (CPU) path is fastest with 8-bit weights everywhere.
  return device === "webgpu"
    ? ({ encoder_model: "fp32", decoder_model_merged: "q4" } as const)
    : ({ encoder_model: "q8", decoder_model_merged: "q8" } as const);
}

async function getPipeline(model: string, device: WhisperDevice): Promise<AutomaticSpeechRecognitionPipeline> {
  const key = `${model}::${device}`;
  if (loaded?.key === key) return loaded.promise;

  if (loaded) {
    const previous = loaded;
    loaded = null;
    try {
      await (await previous.promise).dispose();
    } catch {
      /* ignore — the old session may never have finished loading */
    }
  }

  const files = new Map<string, { loaded: number; total: number }>();
  const promise = pipeline("automatic-speech-recognition", model, {
    device,
    dtype: dtypeFor(device),
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.file && p.status === "progress") {
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      } else if (p.file && p.status === "done") {
        const f = files.get(p.file);
        if (f) f.loaded = f.total;
      }
      let loadedBytes = 0;
      let totalBytes = 0;
      for (const f of files.values()) {
        loadedBytes += f.loaded;
        totalBytes += f.total;
      }
      post({
        type: "model-progress",
        status: p.status,
        file: p.file,
        fraction: totalBytes > 0 ? Math.min(1, loadedBytes / totalBytes) : null,
        loadedBytes,
        totalBytes,
      });
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;

  loaded = { key, promise };
  try {
    await promise;
  } catch (e) {
    if (loaded?.key === key) loaded = null;
    throw e;
  }
  return promise;
}

async function load(model: string, device: WhisperDevice) {
  try {
    await getPipeline(model, device);
    post({ type: "model-ready", model, device });
  } catch (e) {
    post({ type: "model-error", message: describe(e) });
  }
}

async function transcribe(msg: Extract<WorkerInbound, { type: "transcribe" }>) {
  const { id, model, device, language, audio } = msg;
  try {
    const pipe = await getPipeline(model, device);
    post({ type: "model-ready", model, device });

    const duration = audio.length / SAMPLE_RATE;
    const jump = CHUNK_LENGTH_S - 2 * STRIDE_LENGTH_S;
    const totalWindows = duration <= CHUNK_LENGTH_S ? 1 : Math.ceil((duration - CHUNK_LENGTH_S) / jump) + 1;
    let windowsDone = 0;
    let live = "";
    let lastPost = 0;

    const report = (fraction: number, force = false) => {
      const now = Date.now();
      if (!force && now - lastPost < 150) return;
      lastPost = now;
      post({ type: "progress", id, fraction: Math.max(0, Math.min(0.99, fraction)), live: live.slice(-360) });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyPipe = pipe as any;
    const time_precision =
      anyPipe.processor.feature_extractor.config.chunk_length / anyPipe.model.config.max_source_positions;

    const streamer = new WhisperTextStreamer(anyPipe.tokenizer, {
      skip_prompt: true,
      time_precision,
      on_chunk_start: (t: number) => report((windowsDone + Math.min(1, t / CHUNK_LENGTH_S)) / totalWindows),
      callback_function: (text: string) => {
        live += text;
        report((windowsDone + 0.5) / totalWindows);
      },
      on_finalize: () => {
        windowsDone += 1;
        report(windowsDone / totalWindows, true);
      },
    });

    const output = await pipe(audio, {
      chunk_length_s: CHUNK_LENGTH_S,
      stride_length_s: STRIDE_LENGTH_S,
      return_timestamps: true,
      force_full_sequences: false,
      language,
      task: "transcribe",
      streamer,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const single = Array.isArray(output) ? output[0] : output;
    const chunks: WhisperChunk[] = (single.chunks ?? []).map((c) => ({
      start: Number(c.timestamp[0] ?? 0),
      end: c.timestamp[1] === null || c.timestamp[1] === undefined ? null : Number(c.timestamp[1]),
      text: c.text,
    }));

    post({ type: "result", id, result: { text: single.text ?? "", chunks } });
  } catch (e) {
    post({ type: "error", id, message: describe(e) });
  }
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

ctx.onmessage = (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;
  if (msg.type === "load") void load(msg.model, msg.device);
  else if (msg.type === "transcribe") void transcribe(msg);
};
