// Engine preferences, kept in localStorage. On-device transcription is free and unlimited;
// the cloud engine is the old metered Supabase function (faster on weak phones).
import { isMobileDevice } from "@/lib/device";

export type ModelChoice = "fastest" | "fast" | "accurate";
export type EngineChoice = "device" | "cloud";

export interface ModelInfo {
  id: string;
  label: string;
  hint: string;
}

export const MODELS: Record<ModelChoice, ModelInfo> = {
  fastest: {
    id: "onnx-community/whisper-tiny",
    label: "Fastest",
    hint: "Whisper tiny · ~40 MB one-time download · best on phones",
  },
  fast: {
    id: "onnx-community/whisper-base",
    label: "Balanced",
    hint: "Whisper base · ~75 MB (CPU) / ~200 MB (GPU) · good default on laptops",
  },
  accurate: {
    id: "onnx-community/whisper-small",
    label: "Accurate",
    hint: "Whisper small · ~240 MB (CPU) / ~560 MB (GPU) · desktop with a GPU",
  },
};

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
  { code: "tr", label: "Turkish" },
  { code: "ru", label: "Russian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "id", label: "Indonesian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "fa", label: "Persian" },
  { code: "so", label: "Somali" },
];

export interface EngineSettings {
  engine: EngineChoice;
  model: ModelChoice;
  language: string;
  /** With the on-device engine: use the cloud transcriber only when the browser cannot fetch or decode the media. */
  cloudFallback: boolean;
}

const KEY = "scripz-engine-settings";

function defaults(): EngineSettings {
  return { engine: "device", model: isMobileDevice() ? "fastest" : "fast", language: "en", cloudFallback: true };
}

export function getSettings(): EngineSettings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<EngineSettings>;
    return {
      engine: parsed.engine === "cloud" ? "cloud" : "device",
      model: parsed.model && parsed.model in MODELS ? parsed.model : base.model,
      language: LANGUAGES.some((l) => l.code === parsed.language) ? (parsed.language as string) : base.language,
      cloudFallback: parsed.cloudFallback !== false,
    };
  } catch {
    return base;
  }
}

export function saveSettings(patch: Partial<EngineSettings>): EngineSettings {
  const next = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode or storage disabled — keep going with in-memory defaults */
  }
  return next;
}
