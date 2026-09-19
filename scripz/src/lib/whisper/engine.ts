// Main-thread handle for the Whisper worker. Detects WebGPU, falls back to WebAssembly,
// and turns worker messages into promises + progress callbacks.
import type { TranscribeOptions, WhisperDevice, WhisperResult, WorkerInbound, WorkerOutbound } from "./types";

export interface EngineProgress {
  phase: "model" | "transcribe";
  /** 0..1, or null when unknown. */
  fraction: number | null;
  detail: string;
  /** Rolling preview of the text produced so far. */
  live?: string;
}

type ProgressListener = (p: EngineProgress) => void;

interface PendingJob {
  resolve: (r: WhisperResult) => void;
  reject: (e: Error) => void;
  onProgress?: ProgressListener;
}

const formatMb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;

export function describeModelProgress(msg: Extract<WorkerOutbound, { type: "model-progress" }>): EngineProgress {
  if (msg.fraction === null || msg.totalBytes === 0) {
    return { phase: "model", fraction: null, detail: "Loading the speech model…" };
  }
  return {
    phase: "model",
    fraction: msg.fraction,
    detail: `Downloading the speech model (one-time) · ${formatMb(msg.loadedBytes)} of ${formatMb(msg.totalBytes)}`,
  };
}

class WhisperEngine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingJob>();
  private loadListeners = new Set<ProgressListener>();
  private devicePromise: Promise<WhisperDevice> | null = null;
  private forcedDevice: WhisperDevice | null = null;

  /** Resolve the best available backend once and remember it. */
  resolveDevice(): Promise<WhisperDevice> {
    if (this.forcedDevice) return Promise.resolve(this.forcedDevice);
    if (!this.devicePromise) {
      this.devicePromise = (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gpu = (navigator as any).gpu;
          if (gpu && (await gpu.requestAdapter())) return "webgpu";
        } catch {
          /* WebGPU unavailable */
        }
        return "wasm";
      })();
    }
    return this.devicePromise;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerOutbound>) => this.handle(event.data);
    worker.onerror = (event) => {
      const error = new Error(event.message || "The transcription worker crashed.");
      for (const job of this.pending.values()) job.reject(error);
      this.pending.clear();
      this.loadListeners.clear();
      this.worker = null;
      worker.terminate();
    };
    this.worker = worker;
    return worker;
  }

  private send(msg: WorkerInbound, transfer: Transferable[] = []) {
    this.ensureWorker().postMessage(msg, transfer);
  }

  private handle(msg: WorkerOutbound) {
    switch (msg.type) {
      case "model-progress": {
        const progress = describeModelProgress(msg);
        for (const l of this.loadListeners) l(progress);
        for (const job of this.pending.values()) job.onProgress?.(progress);
        return;
      }
      case "model-ready": {
        const ready: EngineProgress = { phase: "model", fraction: 1, detail: "Speech model ready" };
        for (const l of this.loadListeners) l(ready);
        for (const job of this.pending.values()) job.onProgress?.(ready);
        this.loadListeners.clear();
        return;
      }
      case "model-error": {
        const failed: EngineProgress = { phase: "model", fraction: null, detail: `Speech model failed to load: ${msg.message}` };
        for (const l of this.loadListeners) l(failed);
        this.loadListeners.clear();
        return;
      }
      case "progress": {
        const job = this.pending.get(msg.id);
        job?.onProgress?.({
          phase: "transcribe",
          fraction: msg.fraction,
          detail: `Transcribing on your device · ${Math.round(msg.fraction * 100)}%`,
          live: msg.live,
        });
        return;
      }
      case "result": {
        const job = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        job?.resolve(msg.result);
        return;
      }
      case "error": {
        const job = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        job?.reject(new Error(msg.message));
        return;
      }
    }
  }

  /** Start downloading/compiling the model early (e.g. while the video is still being fetched). */
  async preload(model: string, onProgress?: ProgressListener) {
    const device = await this.resolveDevice();
    if (onProgress) this.loadListeners.add(onProgress);
    this.send({ type: "load", model, device });
  }

  private run(audio: Float32Array, opts: TranscribeOptions, onProgress?: ProgressListener): Promise<WhisperResult> {
    return new Promise<WhisperResult>((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, onProgress });
      // Copy so the caller keeps its buffer; the copy is transferred to the worker.
      const payload = new Float32Array(audio);
      this.send({ type: "transcribe", id, audio: payload, ...opts }, [payload.buffer]);
    });
  }

  async transcribe(
    audio: Float32Array,
    opts: { model: string; language: string },
    onProgress?: ProgressListener,
  ): Promise<WhisperResult> {
    const device = await this.resolveDevice();
    try {
      return await this.run(audio, { ...opts, device }, onProgress);
    } catch (e) {
      if (device !== "webgpu") throw e;
      // WebGPU can fail on some drivers — retry once on the WebAssembly backend.
      console.warn("WebGPU transcription failed, retrying on WebAssembly:", e);
      this.forcedDevice = "wasm";
      this.terminate();
      onProgress?.({ phase: "model", fraction: null, detail: "Switching to the CPU engine…" });
      return this.run(audio, { ...opts, device: "wasm" }, onProgress);
    }
  }

  /** Stop everything (also frees the model from memory). */
  terminate() {
    const error = new Error("Transcription cancelled.");
    for (const job of this.pending.values()) job.reject(error);
    this.pending.clear();
    this.loadListeners.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}

export const whisperEngine = new WhisperEngine();
