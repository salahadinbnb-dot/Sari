import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranscribeProgress } from "@/lib/api";

export type LoadStage = "fetching" | "transcribing";

const steps: { key: LoadStage | "ready"; label: string; hint: string }[] = [
  { key: "fetching", label: "Fetch", hint: "Finding the best source..." },
  { key: "transcribing", label: "Transcribe", hint: "Turning speech into text on your device..." },
  { key: "ready", label: "Ready", hint: "Almost there..." },
];

interface LoadingStepsProps {
  stage: LoadStage;
  progress?: TranscribeProgress | null;
  onCancel?: () => void;
}

export function LoadingSteps({ stage, progress, onCancel }: LoadingStepsProps) {
  const currentIndex = steps.findIndex((s) => s.key === stage);
  const detail = stage === "transcribing" ? progress?.detail : undefined;
  const fraction = stage === "transcribing" ? progress?.fraction ?? null : null;

  return (
    <div className="mx-auto w-full max-w-xl animate-fade-in rounded-3xl border border-white/10 bg-card/60 p-6 backdrop-blur-xl sm:p-8">
      <div className="flex items-center gap-3">
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div key={step.key} className="flex flex-1 items-center gap-3">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-500 ${
                    done
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : active
                        ? "border-primary bg-primary/20 text-primary shadow-[0_0_24px_-6px_hsl(var(--primary))]"
                        : "border-white/10 bg-white/5 text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </div>
                <span className={`text-xs ${active || done ? "text-foreground" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="mb-6 h-px flex-1 overflow-hidden rounded bg-white/10">
                  <div
                    className="h-full bg-primary transition-all duration-700"
                    style={{
                      width: done ? "100%" : active ? `${active && fraction !== null ? Math.max(10, Math.round(fraction * 100)) : 45}%` : "0%",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-foreground/90" aria-live="polite">
        {detail || steps[Math.max(currentIndex, 0)].hint}
      </p>

      {fraction !== null && (
        <div className="mx-auto mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[image:var(--gradient-primary)] transition-[width] duration-300"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      )}

      {progress?.sub && stage === "transcribing" && (
        <p className="mt-3 text-center text-xs text-muted-foreground">{progress.sub}</p>
      )}

      {progress?.live && stage === "transcribing" && (
        <div className="mt-4 max-h-24 overflow-hidden rounded-xl border border-white/10 bg-black/40 p-3 text-left">
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">…{progress.live}</p>
        </div>
      )}

      {onCancel && (
        <div className="mt-5 flex justify-center">
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
