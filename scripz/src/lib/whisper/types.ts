export type WhisperDevice = "webgpu" | "wasm";

export interface WhisperChunk {
  /** Start time in seconds. */
  start: number;
  /** End time in seconds, or null when the model did not close the segment. */
  end: number | null;
  text: string;
}

export interface WhisperResult {
  text: string;
  chunks: WhisperChunk[];
}

export interface TranscribeOptions {
  model: string;
  device: WhisperDevice;
  /** Whisper language code, e.g. "en". */
  language: string;
}

/** Messages sent from the page to the worker. */
export type WorkerInbound =
  | { type: "load"; model: string; device: WhisperDevice }
  | { type: "transcribe"; id: number; model: string; device: WhisperDevice; language: string; audio: Float32Array };

/** Messages sent from the worker back to the page. */
export type WorkerOutbound =
  | {
      type: "model-progress";
      status: string;
      file?: string;
      /** 0..1 across every model file, or null when sizes are not known yet. */
      fraction: number | null;
      loadedBytes: number;
      totalBytes: number;
    }
  | { type: "model-ready"; model: string; device: WhisperDevice }
  | { type: "model-error"; message: string }
  | { type: "progress"; id: number; fraction: number; live: string }
  | { type: "result"; id: number; result: WhisperResult }
  | { type: "error"; id: number; message: string };
