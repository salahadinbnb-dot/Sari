// Engine preferences, kept in localStorage. Everything here is free and runs on the visitor's device.

export type ModelChoice = "fast" | "accurate";

export interface ModelInfo {
  id: string;
  label: string;
  hint: string;
}

export const MODELS: Record<ModelChoice, ModelInfo> = {
  fast: {
    id: "onnx-community/whisper-base",
    label: "Fast",
    hint: "Whisper base · ~75 MB (CPU) / ~200 MB (WebGPU) one-time download",
  },
  accurate: {
    id: "onnx-community/whisper-small",
    label: "Accurate",
    hint: "Whisper small · ~240 MB (CPU) / ~560 MB (WebGPU), best with WebGPU",
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
  model: ModelChoice;
  language: string;
  /** Use the cloud transcriber only when the browser cannot fetch or decode the media. */
  cloudFallback: boolean;
}

const KEY = "scripz-engine-settings";

const DEFAULTS: EngineSettings = { model: "fast", language: "en", cloudFallback: true };

export function getSettings(): EngineSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<EngineSettings>;
    return {
      model: parsed.model === "accurate" ? "accurate" : "fast",
      language: LANGUAGES.some((l) => l.code === parsed.language) ? (parsed.language as string) : DEFAULTS.language,
      cloudFallback: parsed.cloudFallback !== false,
    };
  } catch {
    return { ...DEFAULTS };
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
