import { useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";

import { VideoPlayer } from "@/components/VideoPlayer";
import {
  Copy,
  Check,
  Download,
  FileText,
  RotateCcw,
  Type,
  Image,
  Monitor,
  FileCode,
  Video,
  Subtitles,
  FileType
} from "lucide-react";
import { toast } from "sonner";

interface TranscriptDisplayProps {
  transcript: string;
  timestampedTranscript?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  onReset: () => void;
}

type TextSize = "small" | "medium" | "large";

const textSizeClasses: Record<TextSize, string> = {
  small: "text-xs",
  medium: "text-sm",
  large: "text-base",
};

export function TranscriptDisplay({ transcript, timestampedTranscript, videoUrl, thumbnailUrl, onReset }: TranscriptDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [textSize, setTextSize] = useState<TextSize>("medium");
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  const [viewMode, setViewMode] = useState<"video" | "text">("video");

  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const charCount = transcript.length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyWithTimestamps = async () => {
    if (!timestampedTranscript) {
      await navigator.clipboard.writeText(transcript);
      toast.success("Copied (no timestamps available)");
      return;
    }

    const lineRegex = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]?\s*(.+)$/;
    const timestamps: string[] = [];

    for (const rawLine of timestampedTranscript.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(lineRegex);
      if (m) timestamps.push(`${m[1]} ${m[2].trim()}`);
    }

    const textToCopy = timestamps.length > 0
      ? `${transcript}\n\n---\n\nTimestamps:\n${timestamps.join("\n")}`
      : transcript;

    await navigator.clipboard.writeText(textToCopy);
    toast.success("Copied with timestamps at bottom!");
  };

  const handleDownloadText = () => {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded!");
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Convert "MM:SS" or "HH:MM:SS" or "M:SS" to seconds
  const parseTimestamp = (ts: string): number | null => {
    const parts = ts.split(":").map((p) => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  };

  const formatSrtTime = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };

  const buildSrt = (): string => {
    // Try to parse timestamped transcript first (lines like "[00:12] text" or "00:12 text")
    const source = timestampedTranscript || transcript;
    const lineRegex = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]?\s*(.+)$/;
    const cues: { start: number; text: string }[] = [];

    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(lineRegex);
      if (m) {
        const start = parseTimestamp(m[1]);
        if (start !== null) {
          cues.push({ start, text: m[2].trim() });
          continue;
        }
      }
    }

    // If no timestamped cues found, fall back to splitting plain text into ~5s chunks
    if (cues.length === 0) {
      const sentences = transcript
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const SECS_PER_CUE = 4;
      sentences.forEach((sentence, i) => {
        cues.push({ start: i * SECS_PER_CUE, text: sentence });
      });
    }

    // Build SRT with end = next start (or +3s for last cue)
    return cues
      .map((cue, i) => {
        const end = i < cues.length - 1 ? cues[i + 1].start : cue.start + 3;
        return `${i + 1}\n${formatSrtTime(cue.start)} --> ${formatSrtTime(end)}\n${cue.text}\n`;
      })
      .join("\n");
  };

  const handleDownloadSrt = () => {
    const srt = buildSrt();
    triggerDownload(new Blob([srt], { type: "text/plain;charset=utf-8" }), "transcript.srt");
    toast.success("SRT subtitle file downloaded!");
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 54; // 0.75"
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margin * 2;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Transcript", margin, margin);

    // Meta line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    const meta = `${wordCount} words · ${charCount} characters · ${new Date().toLocaleDateString()}`;
    doc.text(meta, margin, margin + 18);
    doc.setTextColor(0);

    // Body
    doc.setFontSize(11);
    const bodyText = transcript.replace(/\r\n/g, "\n");
    const lines = doc.splitTextToSize(bodyText, usableWidth);
    let cursorY = margin + 44;
    const lineHeight = 15;

    for (const line of lines) {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    }

    doc.save("transcript.pdf");
    toast.success("PDF downloaded!");
  };

  const handleDownloadVideo = async () => {
    if (!videoUrl) {
      toast.error("No video available to download");
      return;
    }

    try {
      const isYouTube = /(?:youtube\.com|youtu\.be)/.test(videoUrl);

      if (isYouTube) {
        // Use 9xbuddy — supports YouTube up to 4K and works in 2026
        window.open(`https://9xbuddy.com/process?url=${encodeURIComponent(videoUrl)}`, '_blank');
        toast.info("Opening 9xbuddy in a new tab — pick your quality and download");
      } else {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "reel-video.mp4";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Video downloaded!");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download video");
    }
  };


  const handleDownloadImage = async () => {
    // Create a canvas to render the transcript as an image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 60;
    const lineHeight = 28;
    const fontSize = 16;
    const maxWidth = 800;

    ctx.font = `${fontSize}px Monaco, Menlo, Courier New, monospace`;

    // Calculate text wrapping
    const words = transcript.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth - padding * 2) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Set canvas size
    canvas.width = maxWidth;
    canvas.height = padding * 2 + lines.length * lineHeight + 40;

    // Draw background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw terminal header dots
    ctx.fillStyle = '#ff5f56';
    ctx.beginPath();
    ctx.arc(padding, 30, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffbd2e';
    ctx.beginPath();
    ctx.arc(padding + 20, 30, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#27ca40';
    ctx.beginPath();
    ctx.arc(padding + 40, 30, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#d4d4d4';
    ctx.font = `${fontSize}px Monaco, Menlo, Courier New, monospace`;

    lines.forEach((line, index) => {
      ctx.fillText(line, padding, 70 + index * lineHeight);
    });

    // Download
    const link = document.createElement('a');
    link.download = 'transcript.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    toast.success("Image downloaded!");
  };

  const lines = transcript.split("\n");

  const timestampCues = (() => {
    if (!timestampedTranscript) return [];
    const lineRegex = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]?\s*(.+)$/;
    const cues: { time: string; text: string }[] = [];
    for (const rawLine of timestampedTranscript.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = line.match(lineRegex);
      if (m) cues.push({ time: m[1], text: m[2].trim() });
    }
    return cues;
  })();

  const cycleTextSize = () => {
    const sizes: TextSize[] = ["small", "medium", "large"];
    const currentIndex = sizes.indexOf(textSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setTextSize(sizes[nextIndex]);
  };

  return (
    <div className="w-full max-w-5xl mx-auto animate-slide-up">
      {/* View Mode Toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <Button
          variant={viewMode === "video" ? "default" : "outline"}
          onClick={() => setViewMode("video")}
          className="gap-2"
        >
          <Monitor className="w-4 h-4" />
          Video + Captions
        </Button>
        <Button
          variant={viewMode === "text" ? "default" : "outline"}
          onClick={() => setViewMode("text")}
          className="gap-2"
        >
          <FileCode className="w-4 h-4" />
          Text Only
        </Button>
      </div>

      {/* Video Mode */}
      {viewMode === "video" && videoUrl && (
        <div className="mb-8">
          <VideoPlayer
            videoUrl={videoUrl}
            thumbnailUrl={thumbnailUrl}
            transcript={transcript}
            timestampedTranscript={timestampedTranscript}
          />
        </div>
      )}

      {/* Text Mode - Terminal Window */}
      {viewMode === "text" && (
        <div className="terminal-window">
          {/* Terminal Header */}
          <div className="terminal-header">
            <div className="flex gap-2">
              <div className="terminal-dot bg-destructive" />
              <div className="terminal-dot bg-warning" />
              <div className="terminal-dot bg-success" />
            </div>
            <span className="text-xs text-muted-foreground ml-4 font-mono">
              transcript.txt
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {wordCount} words · {charCount} chars
              </span>
            </div>
          </div>

          {/* Terminal Content */}
          <div className={`terminal-content ${textSizeClasses[textSize]} max-h-[500px] overflow-y-auto`}>
            {showLineNumbers ? (
              <div className="flex">
                <div className="pr-4 text-terminal-line-number select-none border-r border-terminal-border mr-4">
                  {lines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <div className="flex-1 whitespace-pre-wrap">
                  {transcript}
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">
                {transcript}
              </div>
            )}

            {timestampCues.length > 0 && (
              <div className="mt-8 pt-5 border-t border-terminal-border">
                <div className="text-xs text-terminal-line-number mb-3 uppercase tracking-wider font-mono">
                  Timestamps
                </div>
                <div className="space-y-1.5">
                  {timestampCues.map((cue, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-primary font-mono select-none shrink-0">
                        {cue.time}
                      </span>
                      <span className="text-terminal-text/80">{cue.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="terminal"
          onClick={handleCopy}
          className="min-w-[140px]"
        >
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? "Copied!" : "Copy Text"}
        </Button>

        <Button variant="terminal" onClick={handleCopyWithTimestamps}>
          <Clock />
          Copy with Timestamps
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="terminal">
              <Download />
              Export
              <ChevronDown className="ml-1 h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52 bg-popover border border-border z-50">
            <DropdownMenuLabel>Download transcript</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDownloadText} className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              Plain text (.txt)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadSrt} className="cursor-pointer">
              <Subtitles className="mr-2 h-4 w-4" />
              Subtitles (.srt)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf} className="cursor-pointer">
              <FileType className="mr-2 h-4 w-4" />
              Document (.pdf)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDownloadImage} className="cursor-pointer">
              <Image className="mr-2 h-4 w-4" />
              Image (.png)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {videoUrl && (
          <Button variant="terminal" onClick={handleDownloadVideo}>
            <Video />
            Download Video
          </Button>
        )}

        {viewMode === "text" && (
          <>
            <Button
              variant="terminal"
              onClick={cycleTextSize}
              className="min-w-[100px]"
            >
              <Type />
              {textSize.charAt(0).toUpperCase() + textSize.slice(1)}
            </Button>

            <Button
              variant="terminal"
              onClick={() => setShowLineNumbers(!showLineNumbers)}
            >
              {showLineNumbers ? "Hide" : "Show"} Lines
            </Button>
          </>
        )}
      </div>

      {/* Try Another */}
      <div className="mt-8 text-center">
        <Button
          variant="ghost"
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-2" />
          Try Another Video
        </Button>
      </div>
    </div>
  );
}
