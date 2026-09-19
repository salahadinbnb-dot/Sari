import { useEffect, useState } from "react";
import { ChevronDown, Cloud, Cpu, ShieldCheck, Zap } from "lucide-react";
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
import {
  getSettings,
  LANGUAGES,
  MODELS,
  saveSettings,
  type EngineChoice,
  type EngineSettings,
  type ModelChoice,
} from "@/lib/settings";
import { whisperEngine } from "@/lib/whisper/engine";
import type { WhisperDevice } from "@/lib/whisper/types";

/** Small control in the nav: shows where transcription runs and lets the visitor tune it. */
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
  const onDevice = settings.engine === "device";
  const deviceLabel = device === "webgpu" ? "GPU" : device === "wasm" ? "CPU" : "…";
  const DeviceIcon = device === "webgpu" ? Zap : Cpu;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Transcription engine settings"
      >
        {onDevice ? <ShieldCheck className="h-3.5 w-3.5 text-primary" /> : <Cloud className="h-3.5 w-3.5 text-primary" />}
        <span className="hidden sm:inline">{onDevice ? "On-device" : "Cloud"}</span>
        {onDevice && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-1.5 py-0.5 text-[11px]">
            <DeviceIcon className="h-3 w-3" />
            {deviceLabel}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-white/10 bg-popover/95 backdrop-blur-xl">
        <DropdownMenuLabel>Engine</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={settings.engine} onValueChange={(v) => update({ engine: v as EngineChoice })}>
          <DropdownMenuRadioItem value="device" className="flex-col items-start gap-0.5 rounded-lg">
            <span className="text-sm">On-device · free, unlimited</span>
            <span className="text-[11px] leading-4 text-muted-foreground">
              Runs in your browser{device === "webgpu" ? " on the GPU" : device === "wasm" ? " on the CPU" : ""}. Nothing is uploaded.
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="cloud" className="flex-col items-start gap-0.5 rounded-lg">
            <span className="text-sm">Cloud · faster on slow phones</span>
            <span className="text-[11px] leading-4 text-muted-foreground">Uses the metered cloud transcriber. Not available for local files.</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>On-device quality</DropdownMenuLabel>
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
        <div className="max-h-40 overflow-y-auto">
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
            If the browser can't download or decode a video, finish it in the cloud instead of failing.
          </span>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
