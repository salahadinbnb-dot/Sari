import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ExportBar } from "@/components/ExportBar";
import { PlatformBadge } from "@/components/PlatformLogos";
import { ArrowLeft, Download, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildSrt, parseCues } from "@/lib/exports";
import type { SourceType } from "@/types/history";

interface ResultsWorkspaceProps {
  transcript: string;
  timestampedTranscript?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  sourceType: SourceType | null;
  transcriptError?: string | null;
  isRetrying?: boolean;
  retryDetail?: string;
  onRetryTranscript?: () => void;
  onReset: () => void;
}

type Tab = "clean" | "timestamped" | "srt";

export function ResultsWorkspace({
  transcript,
  timestampedTranscript,
  videoUrl,
  thumbnailUrl,
  sourceType,
  transcriptError,
  isRetrying,
  retryDetail,
  onRetryTranscript,
  onReset,
}: ResultsWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("clean");

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const cues = parseCues(timestampedTranscript);
  const hasTranscript = transcript.trim().length > 0;

  const tabs: { key: Tab; label: string; disabled?: boolean }[] = [
    { key: "clean", label: "Clean" },
    { key: "timestamped", label: "Timestamped", disabled: cues.length === 0 },
    { key: "srt", label: "SRT preview", disabled: !hasTranscript },
  ];

  const handleDownloadVideo = async () => {
    if (!videoUrl) {
      toast.error("No video available to download");
      return;
    }
    const isYouTube = /(?:youtube\.com|youtu\.be)/.test(videoUrl);
    if (isYouTube) {
      window.open(`https://9xbuddy.com/process?url=${encodeURIComponent(videoUrl)}`, "_blank");
      toast.info("Opening 9xbuddy — pick your quality and download");
      return;
    }
    try {
      const response = await fetch(videoUrl, { referrerPolicy: "no-referrer" });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scripz-video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Video downloaded");
    } catch {
      window.open(videoUrl, "_blank");
      toast.info("Opened the video in a new tab — long-press or right-click to save");
    }
  };

  return (
    <div className="w-full animate-fade-in">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onReset} className="gap-2 rounded-xl text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          New link
        </Button>
        {sourceType && <PlatformBadge source={sourceType} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start">
        {/* Left: player + metadata */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          {videoUrl ? (
            <VideoPlayer
              videoUrl={videoUrl}
              thumbnailUrl={thumbnailUrl}
              transcript={transcript}
              timestampedTranscript={timestampedTranscript}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-muted-foreground">
              No video preview available
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Words</div>
                <div className="mt-1 font-medium text-foreground">{wordCount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Cues</div>
                <div className="mt-1 font-medium text-foreground">{cues.length || "—"}</div>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={handleDownloadVideo}
              disabled={!videoUrl}
              className="mt-4 h-12 w-full gap-2 rounded-xl border border-white/10"
            >
              <Download className="h-4 w-4" />
              Download video
            </Button>
          </div>
        </aside>

        {/* Right: transcript workspace */}
        <section className="min-w-0">
          <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl">
            <div className="flex items-center gap-1 border-b border-white/10 p-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  disabled={t.disabled}
                  className={`rounded-xl px-3.5 py-2 text-sm transition-colors disabled:opacity-35 ${
                    tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {isRetrying && retryDetail && !transcriptError && (
              <div className="m-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                <span>{retryDetail}</span>
              </div>
            )}

            {transcriptError && (
              <div className="m-4 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-sm text-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>{transcriptError}</span>
                </div>
                {onRetryTranscript && (
                  <Button onClick={onRetryTranscript} disabled={isRetrying} className="h-10 shrink-0 gap-2 rounded-xl">
                    {isRetrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Retry transcript
                  </Button>
                )}
              </div>
            )}

            <div className="min-h-[320px] max-h-[60vh] overflow-y-auto p-5 lg:min-h-[480px]">
              {tab === "clean" && (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
                  {hasTranscript ? transcript : "No transcript yet."}
                </p>
              )}

              {tab === "timestamped" && (
                <div className="space-y-2">
                  {cues.map((cue, i) => (
                    <div key={i} className="flex gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                      <span className="shrink-0 font-mono text-sm text-primary">{cue.time}</span>
                      <span className="text-[15px] leading-6 text-foreground/85">{cue.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "srt" && (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-terminal-text">
                  {buildSrt(transcript, timestampedTranscript)}
                </pre>
              )}
            </div>
          </div>

          <ExportBar
            transcript={transcript}
            timestampedTranscript={timestampedTranscript}
            disabled={!hasTranscript}
          />
        </section>
      </div>
    </div>
  );
}
