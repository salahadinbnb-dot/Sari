import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Clock } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string;
  transcript: string;
  timestampedTranscript?: string;
}

export function VideoPlayer({ videoUrl, thumbnailUrl, transcript, timestampedTranscript }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [showControls, setShowControls] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(false);

  // Detect YouTube URL
  const youtubeMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  const isYouTube = !!youtubeMatch;
  const youtubeId = youtubeMatch?.[1];

  // Parse transcript into words with estimated timing
  const words = transcript.split(/\s+/).filter(Boolean);

  // Parse timestamped transcript into seekable cues
  const parseTimestamp = (ts: string): number | null => {
    const parts = ts.split(":").map((p) => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  };

  const timestampCues = (() => {
    if (!timestampedTranscript) return [];
    const lineRegex = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]?\s*(.+)$/;
    const cues: { time: string; text: string; seconds: number }[] = [];
    for (const rawLine of timestampedTranscript.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(lineRegex);
      if (m) {
        const seconds = parseTimestamp(m[1]);
        if (seconds !== null) cues.push({ time: m[1], text: m[2].trim(), seconds });
      }
    }
    return cues;
  })();

  const handleTimestampClick = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  // Calculate timing for each word based on duration
  const getWordTimings = useCallback(() => {
    if (!duration || words.length === 0) return [];

    const avgWordDuration = duration / words.length;
    return words.map((word, index) => ({
      word,
      start: index * avgWordDuration,
      end: (index + 1) * avgWordDuration,
    }));
  }, [duration, words]);

  const wordTimings = getWordTimings();

  // Update current word based on video time
  useEffect(() => {
    if (wordTimings.length === 0) return;

    const currentWord = wordTimings.findIndex(
      (timing) => currentTime >= timing.start && currentTime < timing.end
    );
    setCurrentWordIndex(currentWord);
  }, [currentTime, wordTimings]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = percent * duration;
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get visible words (current word + context)
  const getVisibleWords = () => {
    const contextSize = 4; // words before and after
    const start = Math.max(0, currentWordIndex - contextSize);
    const end = Math.min(words.length, currentWordIndex + contextSize + 1);

    return wordTimings.slice(start, end).map((timing, idx) => ({
      ...timing,
      isActive: start + idx === currentWordIndex,
      isPast: start + idx < currentWordIndex,
      globalIndex: start + idx,
    }));
  };

  const visibleWords = getVisibleWords();

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-md mx-auto rounded-2xl overflow-hidden bg-black shadow-2xl"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video */}
      <div className="relative aspect-[9/16]">
        {isYouTube ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            // The page sends no referrer (X's video CDN rejects foreign referrers), but YouTube's
            // player refuses to load without one ("Error 153"), so the embed sends its origin.
            referrerPolicy="strict-origin-when-cross-origin"
            title="YouTube video player"
          />
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl}
            className="w-full h-full object-cover"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentWordIndex(-1);
            }}
            playsInline
          />
        )}

        {/* Gradient overlay for captions - only for non-YouTube */}
        {!isYouTube && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
        )}

        {/* Netflix-style Captions - only for non-YouTube */}
        {!isYouTube && (
          <div className="absolute bottom-20 left-0 right-0 px-4 pointer-events-none">
            <div className="text-center">
              <p className="text-lg sm:text-xl font-bold leading-relaxed">
                {visibleWords.map((wordData, idx) => (
                  <span
                    key={`${wordData.globalIndex}-${wordData.word}`}
                    className={`inline-block mx-0.5 transition-all duration-150 ${
                      wordData.isActive
                        ? "text-primary scale-110 drop-shadow-[0_0_10px_hsl(var(--primary))]"
                        : wordData.isPast
                        ? "text-white/60"
                        : "text-white/40"
                    }`}
                    style={{
                      transform: wordData.isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {wordData.word}
                  </span>
                ))}
              </p>
            </div>
          </div>
        )}

        {/* Play/Pause overlay button - only for non-YouTube */}
        {!isYouTube && !isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30"
          >
            <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
              <Play className="w-8 h-8 text-black ml-1" fill="currentColor" />
            </div>
          </button>
        )}

        {/* Controls - only for non-YouTube */}
        {!isYouTube && (
          <div
            className={`absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Progress bar */}
            <div
              className="h-1 bg-white/30 rounded-full mb-3 cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-primary rounded-full relative transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  )}
                </button>

                <button
                  onClick={toggleMute}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-white" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-white" />
                  )}
                </button>

                <span className="text-white/80 text-sm font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <button
                onClick={toggleFullscreen}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <Maximize className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toggle timestamps under the video */}
      {timestampCues.length > 0 && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowTimestamps((s) => !s)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-xs transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            {showTimestamps ? "Hide Timestamps" : "Show Timestamps"}
          </button>
        </div>
      )}

      {showTimestamps && timestampCues.length > 0 && (
        <div className="mt-3 max-w-md mx-auto rounded-xl bg-black/60 border border-white/10 p-3 max-h-[200px] overflow-y-auto">
          <div className="space-y-1">
            {timestampCues.map((cue, i) => (
              <button
                key={i}
                onClick={() => handleTimestampClick(cue.seconds)}
                className="w-full flex items-start gap-3 text-left hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors"
              >
                <span className="text-primary font-mono text-xs shrink-0">{cue.time}</span>
                <span className="text-white/80 text-xs leading-relaxed">{cue.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
