import { useCallback, useEffect, useRef, useState } from "react";
import { Hero } from "@/components/Hero";
import { UrlInput } from "@/components/UrlInput";
import { LoadingSteps, LoadStage } from "@/components/LoadingSteps";
import { ResultsWorkspace } from "@/components/ResultsWorkspace";
import { HistoryLibrary } from "@/components/HistoryLibrary";
import { EngineMenu } from "@/components/EngineMenu";
import { useTranscriptHistory } from "@/hooks/useTranscriptHistory";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { HistoryItem, SourceType } from "@/types/history";
import {
  fetchInstagramReel,
  transcribeMedia,
  fetchYouTubeTranscript,
  fetchTwitterVideo,
  fetchFacebookReel,
  downloadYouTubeVideo,
  detectSourceType,
  extractYouTubeId,
  type TranscribeProgress,
} from "@/lib/api";
import { whisperEngine } from "@/lib/whisper/engine";

type Stage = "idle" | "fetching" | "transcribing" | "complete";

interface Media {
  videoUrl: string;
  transcriptionVideoUrl?: string;
  thumbnailUrl?: string;
  shortcode: string;
}

export default function Index() {
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
  const [timestampedTranscript, setTimestampedTranscript] = useState("");
  const [media, setMedia] = useState<Media | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [progress, setProgress] = useState<TranscribeProgress | null>(null);

  const mediaRef = useRef<Media | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const { history, addToHistory, deleteFromHistory, clearHistory } = useTranscriptHistory();

  useEffect(() => () => abortRef.current?.abort(), []);

  const persist = useCallback(
    (args: {
      url: string;
      source: SourceType;
      transcript: string;
      timestamped?: string;
      thumbnailUrl?: string;
      videoUrl?: string;
      shortcode: string;
    }) => {
      addToHistory({
        url: args.url,
        sourceType: args.source,
        transcript: args.transcript,
        timestampedTranscript: args.timestamped,
        thumbnailUrl: args.thumbnailUrl,
        videoUrl: args.videoUrl,
        shortcode: args.shortcode,
      });
    },
    [addToHistory],
  );

  const startRun = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    runRef.current += 1;
    return { controller, run: runRef.current };
  };

  const runPipeline = useCallback(
    async (url: string) => {
      const source = detectSourceType(url);
      if (!source) {
        toast.error("Paste a valid Instagram, YouTube, X, or Facebook link");
        return;
      }

      const { controller, run } = startRun();
      const stillCurrent = () => run === runRef.current && !controller.signal.aborted;

      setCurrentUrl(url);
      setSourceType(source);
      setFatalError(null);
      setTranscriptError(null);
      setTranscript("");
      setTimestampedTranscript("");
      setMedia(null);
      setProgress(null);
      mediaRef.current = null;
      setStage("fetching");

      const onProgress = (p: TranscribeProgress) => {
        if (stillCurrent()) setProgress(p);
      };

      try {
        if (source === "youtube") {
          const videoId = extractYouTubeId(url);
          const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
          const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;

          // Primary (fast): platform captions
          try {
            const yt = await fetchYouTubeTranscript(url);
            if (!stillCurrent()) return;
            const m: Media = {
              videoUrl: `https://www.youtube.com/watch?v=${yt.videoId}`,
              thumbnailUrl: yt.thumbnailUrl,
              shortcode: yt.videoId,
            };
            setMedia(m);
            mediaRef.current = m;
            setTranscript(yt.transcript);
            setTimestampedTranscript(yt.timestampedTranscript || "");
            setStage("complete");
            persist({
              url,
              source,
              transcript: yt.transcript,
              timestamped: yt.timestampedTranscript,
              thumbnailUrl: yt.thumbnailUrl,
              videoUrl: m.videoUrl,
              shortcode: yt.videoId,
            });
            toast.success("Transcript ready");
            return;
          } catch {
            console.log("No captions — falling back to our own transcription");
          }
          if (!stillCurrent()) return;

          // Fallback: resolve a direct mp4 and transcribe it ourselves
          const m: Media = { videoUrl: watchUrl, thumbnailUrl, shortcode: videoId };
          setMedia(m);
          mediaRef.current = m;

          let directUrl: string;
          try {
            const dl = await downloadYouTubeVideo(url);
            directUrl = dl.downloadUrl;
          } catch {
            if (!stillCurrent()) return;
            setStage("complete");
            setTranscriptError(
              "This video has no captions and we couldn't pull the media file to transcribe it. Try again in a moment.",
            );
            return;
          }
          if (!stillCurrent()) return;

          mediaRef.current = { ...m, transcriptionVideoUrl: directUrl };
          setMedia(mediaRef.current);
          setStage("transcribing");
          const result = await transcribeMedia(watchUrl, directUrl, { onProgress, signal: controller.signal });
          if (!stillCurrent()) return;
          setTranscript(result.transcript);
          setTimestampedTranscript(result.timestampedTranscript);
          setStage("complete");
          persist({
            url,
            source,
            transcript: result.transcript,
            timestamped: result.timestampedTranscript,
            thumbnailUrl,
            videoUrl: watchUrl,
            shortcode: videoId,
          });
          toast.success(result.engine === "device" ? "Transcript ready — done on your device" : "Transcript ready");
          return;
        }

        // Instagram / X / Facebook — extract, then transcribe
        let m: Media;
        if (source === "instagram") {
          const ig = await fetchInstagramReel(url);
          m = { videoUrl: ig.videoUrl, thumbnailUrl: ig.thumbnailUrl, shortcode: ig.shortcode };
        } else if (source === "twitter") {
          const tw = await fetchTwitterVideo(url);
          m = {
            videoUrl: tw.videoUrl,
            transcriptionVideoUrl: tw.transcriptionVideoUrl,
            thumbnailUrl: tw.thumbnailUrl,
            shortcode: tw.tweetId,
          };
        } else {
          const fb = await fetchFacebookReel(url);
          m = { videoUrl: fb.videoUrl, thumbnailUrl: fb.thumbnailUrl, shortcode: fb.videoId };
        }
        if (!stillCurrent()) return;

        setMedia(m);
        mediaRef.current = m;
        setStage("transcribing");

        try {
          const result = await transcribeMedia(m.videoUrl, m.transcriptionVideoUrl, { onProgress, signal: controller.signal });
          if (!stillCurrent()) return;
          setTranscript(result.transcript);
          setTimestampedTranscript(result.timestampedTranscript);
          setStage("complete");
          persist({
            url,
            source,
            transcript: result.transcript,
            timestamped: result.timestampedTranscript,
            thumbnailUrl: m.thumbnailUrl,
            videoUrl: m.videoUrl,
            shortcode: m.shortcode,
          });
          toast.success(result.engine === "device" ? "Transcript ready — done on your device" : "Transcript ready");
        } catch (e) {
          if (!stillCurrent()) return;
          // Extraction worked — keep the video, surface a retry for the transcript only
          setStage("complete");
          setTranscriptError(
            e instanceof Error ? e.message : "Transcription failed. Your video is still available below.",
          );
          toast.error("Transcription failed — the video is still ready to watch and download");
        }
      } catch (error) {
        if (!stillCurrent()) return;
        console.error("Pipeline error:", error);
        setStage("idle");
        setFatalError(
          error instanceof Error
            ? `We couldn't fetch the video (${error.message}).`
            : "We couldn't fetch the video from this link.",
        );
      } finally {
        if (stillCurrent()) setProgress(null);
      }
    },
    [persist],
  );

  const handleRetryTranscript = useCallback(async () => {
    const m = mediaRef.current;
    if (!m) return;
    const { controller, run } = startRun();
    const stillCurrent = () => run === runRef.current && !controller.signal.aborted;
    setIsRetrying(true);
    setTranscriptError(null);
    try {
      const result = await transcribeMedia(m.videoUrl, m.transcriptionVideoUrl, {
        onProgress: (p) => {
          if (stillCurrent()) setProgress(p);
        },
        signal: controller.signal,
      });
      if (!stillCurrent()) return;
      setTranscript(result.transcript);
      setTimestampedTranscript(result.timestampedTranscript);
      if (sourceType) {
        persist({
          url: currentUrl,
          source: sourceType,
          transcript: result.transcript,
          timestamped: result.timestampedTranscript,
          thumbnailUrl: m.thumbnailUrl,
          videoUrl: m.videoUrl,
          shortcode: m.shortcode,
        });
      }
      toast.success("Transcript ready");
    } catch (e) {
      if (!stillCurrent()) return;
      setTranscriptError(e instanceof Error ? e.message : "Transcription failed again. Please try once more.");
    } finally {
      if (stillCurrent()) {
        setIsRetrying(false);
        setProgress(null);
      }
    }
  }, [currentUrl, persist, sourceType]);

  const handleSelectFromHistory = (item: HistoryItem) => {
    abortRef.current?.abort();
    const m: Media = {
      videoUrl: item.videoUrl || "",
      thumbnailUrl: item.thumbnailUrl,
      shortcode: item.shortcode,
    };
    setMedia(m);
    mediaRef.current = m;
    setTranscript(item.transcript);
    setTimestampedTranscript(item.timestampedTranscript || "");
    setCurrentUrl(item.url);
    setSourceType(item.sourceType);
    setTranscriptError(null);
    setFatalError(null);
    setProgress(null);
    setStage("complete");
  };

  const handleReset = () => {
    abortRef.current?.abort();
    runRef.current += 1;
    whisperEngine.terminate();
    setStage("idle");
    setTranscript("");
    setTimestampedTranscript("");
    setMedia(null);
    mediaRef.current = null;
    setCurrentUrl("");
    setSourceType(null);
    setFatalError(null);
    setTranscriptError(null);
    setProgress(null);
    setIsRetrying(false);
  };

  const isLoading = stage === "fetching" || stage === "transcribing";

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-[hsl(199,89%,48%)]/10 blur-[120px]" />
      </div>

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <button onClick={handleReset} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-sm font-bold text-primary-foreground">
            S
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">Scripz</span>
        </button>
        <EngineMenu />
      </nav>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6 sm:pt-8">
        {stage === "idle" && (
          <>
            <Hero />
            <UrlInput onSubmit={runPipeline} isLoading={isLoading} />

            {fatalError && (
              <div className="mx-auto mt-6 flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-center sm:flex-row sm:text-left">
                <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                <p className="flex-1 text-sm text-foreground">
                  {fatalError} The post may be private or deleted — or the source was briefly unavailable.
                </p>
                <Button onClick={() => runPipeline(currentUrl)} className="h-11 shrink-0 gap-2 rounded-xl">
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
              </div>
            )}

            <HistoryLibrary
              history={history}
              onSelect={handleSelectFromHistory}
              onDelete={deleteFromHistory}
              onClearAll={clearHistory}
            />
          </>
        )}

        {isLoading && (
          <div className="py-16">
            <LoadingSteps stage={stage as LoadStage} progress={progress} onCancel={handleReset} />
          </div>
        )}

        {stage === "complete" && (
          <ResultsWorkspace
            transcript={transcript}
            timestampedTranscript={timestampedTranscript}
            videoUrl={media?.videoUrl}
            thumbnailUrl={media?.thumbnailUrl}
            sourceType={sourceType}
            transcriptError={transcriptError}
            isRetrying={isRetrying}
            retryDetail={isRetrying ? progress?.detail : undefined}
            onRetryTranscript={handleRetryTranscript}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Scripz</span> — transcribe, download and subtitle any video.
          Transcription runs on your device: free, unlimited, private.
        </div>
      </footer>
    </div>
  );
}
