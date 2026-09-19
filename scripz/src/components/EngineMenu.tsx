import { useEffect, useState } from "react";
import { ChevronDown, Cpu, ShieldCheck, Zap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSettings, LANGUAGES, MODELS, saveSettings, type EngineSettings, type ModelChoice } from "@/lib/settings";
import { whisperEngine } from "@/lib/whisper/engine";
import type { WhisperDevice } from "@/lib/whisper/types";

/** Small control in the nav: shows that transcription runs on-device and lets the user tune it. */
export function EngineMenu() {
  const [settings, setSettings] = useState<EngineSettings>(() => getSettings());
  const [device, setDevice] = useState<WhisperDevice | null>(null);

  useEffect(() => {
    let cancelled = false;
    whisperEngine.resolveDevice().then((d) => {
      if (!cancelled) setDevice(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<EngineSettings>) => setSettings(saveSettings(patch));
  const deviceLabel = device === "webgpu" ? "WebGPU" : device === "wasm" ? "CPU" : "…";
  const DeviceIcon = device === "webgpu" ? Zap : Cpu;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Transcription engine settings"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <span className="hidden sm:inline">On-device</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5 text-[11px]">
          <DeviceIcon className="h-3 w-3" />
          {deviceLabel}
        </span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 rounded-2xl border-white/10 bg-popover/95 backdrop-blur-xl">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Transcription runs in your browser — free, unlimited, nothing uploaded.
          {device === "webgpu" ? " Your GPU is being used." : device === "wasm" ? " Running on the CPU." : ""}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel>Quality</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={settings.model} onValueChange={(v) => update({ model: v as ModelChoice })}>
          {(Object.keys(MODELS) as ModelChoice[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key} className="flex-col items-start gap-0.5 rounded-lg">
              <span className="text-sm">{MODELS[key].label}</span>
              <span className="text-[11px] leading-4 text-muted-foreground">{MODELS[key].hint}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Spoken language</DropdownMenuLabel>
        <div className="max-h-44 overflow-y-auto">
          <DropdownMenuRadioGroup value={settings.language} onValueChange={(v) => update({ language: v })}>
            {LANGUAGES.map((l) => (
              <DropdownMenuRadioItem key={l.code} value={l.code} className="rounded-lg text-sm">
                {l.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.cloudFallback}
          onCheckedChange={(checked) => update({ cloudFallback: checked === true })}
          className="flex-col items-start gap-0.5 rounded-lg"
        >
          <span className="text-sm">Cloud fallback</span>
          <span className="text-[11px] leading-4 text-muted-foreground">
            Only if the browser can't download or decode a video. Uses the metered cloud transcriber.
          </span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
