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
  transcribeLocalFile,
  fetchYouTubeTranscriptWithRetry,
  fetchTwitterVideo,
  fetchFacebookReel,
  downloadYouTubeVideo,
  detectSourceType,
  extractYouTubeId,
  type MediaTranscript,
  type TranscribeProgress,
} from "@/lib/api";
import { fetchYouTubeFromMirrors } from "@/lib/youtubeMirrors";
import { whisperEngine } from "@/lib/whisper/engine";
import { getSettings, MODELS } from "@/lib/settings";
import { prefersReducedData } from "@/lib/device";

type Stage = "idle" | "fetching" | "transcribing" | "complete";

interface Media {
  videoUrl: string;
  transcriptionVideoUrl?: string;
  thumbnailUrl?: string;
  shortcode: string;
}

const YOUTUBE_DEAD_END =
  "YouTube blocked every route for this video: no captions anywhere and it refused the download. " +
  "Save the video to your device and drop the file into Scripz — that always works.";

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
  const fileRef = useRef<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runRef = useRef(0);
  const { history, addToHistory, deleteFromHistory, clearHistory } = useTranscriptHistory();

  useEffect(() => () => abortRef.current?.abort(), []);

  // Start the one-time model download as soon as the page is idle so the first transcript is quick.
  useEffect(() => {
    const settings = getSettings();
    if (settings.engine !== "device" || prefersReducedData()) return;
    const timer = setTimeout(() => void whisperEngine.preload(MODELS[settings.model].id), 1500);
    return () => clearTimeout(timer);
  }, []);

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
    const run = runRef.current;
    return { controller, stillCurrent: () => run === runRef.current && !controller.signal.aborted };
  };

  const resetWorkspace = (url: string, source: SourceType) => {
    setCurrentUrl(url);
    setSourceType(source);
    setFatalError(null);
    setTranscriptError(null);
    setTranscript("");
    setTimestampedTranscript("");
    setMedia(null);
    setProgress(null);
    mediaRef.current = null;
    fileRef.current = null;
  };

  const runPipeline = useCallback(
    async (url: string) => {
      const source = detectSourceType(url);
      if (!source) {
        toast.error("Paste a valid Instagram, YouTube, X, or Facebook link");
        return;
      }

      const { controller, stillCurrent } = startRun();
      resetWorkspace(url, source);
      setStage("fetching");

      const onProgress = (p: TranscribeProgress) => {
        if (stillCurrent()) setProgress(p);
      };
      const status = (detail: string) => onProgress({ phase: "download", fraction: null, detail });

      const finish = (m: Media, result: { transcript: string; timestampedTranscript?: string }, message: string) => {
        setTranscript(result.transcript);
        setTimestampedTranscript(result.timestampedTranscript || "");
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
        toast.success(message);
      };

      const readyMessage = (r: MediaTranscript) =>
        r.engine === "device" ? "Transcript ready — done on your device" : "Transcript ready";

      try {
        if (source === "youtube") {
          const videoId = extractYouTubeId(url);
          const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
          const m: Media = {
            videoUrl: watchUrl,
            thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
            shortcode: videoId,
          };
          setMedia(m);
          mediaRef.current = m;

          // 1. Platform captions (fast path), retrying if the service is rate-limited.
          status("Fetching captions…");
          const yt = await fetchYouTubeTranscriptWithRetry(url, status);
          if (!stillCurrent()) return;
          if (yt) {
            finish(m, yt, "Transcript ready");
            return;
          }

          // 2. Public mirrors: captions (manual or auto-generated), and audio when they still serve it.
          status("No captions from the main service — checking public mirrors…");
          const mirror = await fetchYouTubeFromMirrors(videoId, getSettings().language).catch(() => null);
          if (!stillCurrent()) return;
          if (mirror?.captions) {
            finish(m, mirror.captions, "Transcript ready");
            return;
          }

          setStage("transcribing");

          // 3. Mirror audio → transcribed here on the device.
          if (mirror?.audioUrl) {
            try {
              const r = await transcribeMedia(watchUrl, mirror.audioUrl, { onProgress, signal: controller.signal });
              if (!stillCurrent()) return;
              mediaRef.current = { ...m, transcriptionVideoUrl: mirror.audioUrl };
              finish(m, r, readyMessage(r));
              return;
            } catch (e) {
              if (!stillCurrent()) return;
              console.warn("Mirror audio route failed:", e);
            }
          }

          // 4. Our own download + transcription (falls back to the cloud transcriber).
          try {
            status("Trying to pull the media file…");
            const dl = await downloadYouTubeVideo(url);
            if (!stillCurrent()) return;
            mediaRef.current = { ...m, transcriptionVideoUrl: dl.downloadUrl };
            setMedia(mediaRef.current);
            const r = await transcribeMedia(watchUrl, dl.downloadUrl, { onProgress, signal: controller.signal });
            if (!stillCurrent()) return;
            finish(m, r, readyMessage(r));
            return;
          } catch (e) {
            if (!stillCurrent()) return;
            console.warn("Download route failed:", e);
          }

          // 5. Honest dead end with the route that always works.
          setStage("complete");
          setTranscriptError(YOUTUBE_DEAD_END);
          return;
        }

        // Instagram / X / Facebook — extract, then transcribe
        status("Finding the best source…");
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
          const r = await transcribeMedia(m.videoUrl, m.transcriptionVideoUrl, { onProgress, signal: controller.signal });
          if (!stillCurrent()) return;
          finish(m, r, readyMessage(r));
        } catch (e) {
          if (!stillCurrent()) return;
          // Extraction worked — keep the video, surface a retry for the transcript only
          setStage("complete");
          setTranscriptError(e instanceof Error ? e.message : "Transcription failed. Your video is still available below.");
          toast.error("Transcription failed — the video is still ready to watch and download");
        }
      } catch (error) {
        if (!stillCurrent()) return;
        console.error("Pipeline error:", error);
        setStage("idle");
        setFatalError(
          error instanceof Error ? `We couldn't fetch the video (${error.message}).` : "We couldn't fetch the video from this link.",
        );
      } finally {
        if (stillCurrent()) setProgress(null);
      }
    },
    [persist],
  );

  /** A video/audio file from the visitor's device: always transcribed locally, no captions needed. */
  const runFile = useCallback(
    async (file: File) => {
      const { controller, stillCurrent } = startRun();
      resetWorkspace(file.name, "file");
      fileRef.current = file;
      const m: Media = { videoUrl: URL.createObjectURL(file), shortcode: `file-${file.name}-${file.size}` };
      setMedia(m);
      mediaRef.current = m;
      setStage("transcribing");

      try {
        const r = await transcribeLocalFile(file, {
          onProgress: (p) => {
            if (stillCurrent()) setProgress(p);
          },
          signal: controller.signal,
        });
        if (!stillCurrent()) return;
        setTranscript(r.transcript);
        setTimestampedTranscript(r.timestampedTranscript);
        setStage("complete");
        // Object URLs do not survive a reload, so the library keeps the text only.
        persist({ url: file.name, source: "file", transcript: r.transcript, timestamped: r.timestampedTranscript, shortcode: m.shortcode });
        toast.success("Transcript ready — done on your device");
      } catch (e) {
        if (!stillCurrent()) return;
        setStage("complete");
        setTranscriptError(e instanceof Error ? e.message : "Transcription failed. Please try again.");
      } finally {
        if (stillCurrent()) setProgress(null);
      }
    },
    [persist],
  );

  const handleRetryTranscript = useCallback(async () => {
    const m = mediaRef.current;
    if (!m) return;
    const { controller, stillCurrent } = startRun();
    setIsRetrying(true);
    setTranscriptError(null);
    const onProgress = (p: TranscribeProgress) => {
      if (stillCurrent()) setProgress(p);
    };
    try {
      const result = fileRef.current
        ? await transcribeLocalFile(fileRef.current, { onProgress, signal: controller.signal })
        : await transcribeMedia(m.videoUrl, m.transcriptionVideoUrl, { onProgress, signal: controller.signal });
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
          videoUrl: sourceType === "file" ? undefined : m.videoUrl,
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
    fileRef.current = null;
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
    fileRef.current = null;
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
            <UrlInput onSubmit={runPipeline} onFile={runFile} isLoading={isLoading} />

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
