import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClipboardPaste, Sparkles, Loader2 } from "lucide-react";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const autoPastedRef = useRef(false);

  const validateUrl = (input: string): boolean => {
    const instagramPattern = /^https?:\/\/(www\.)?instagram\.com\/(reel|p|reels|stories)\/[A-Za-z0-9_-]+/i;
    const youtubePattern = /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]+/i;
    const twitterPattern = /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/\w+\/status\/\d+/i;
    const facebookPattern = /^https?:\/\/((www\.|web\.|m\.)?facebook\.com\/(reel\/\d+|watch\/?\?v=\d+|share\/(r|v)\/[A-Za-z0-9_-]+|[^/]+\/videos\/\d+)|fb\.watch\/[A-Za-z0-9_-]+)/i;
    return instagramPattern.test(input) || youtubePattern.test(input) || twitterPattern.test(input) || facebookPattern.test(input);
  };

  const pasteFromClipboard = async (auto = false) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      setUrl(text);
      if (error) setError("");

      if (validateUrl(text)) {
        onSubmit(text);
      } else if (!auto) {
        setError("Use a valid Instagram, YouTube, X, or Facebook link");
      }
    } catch {
      if (!auto) {
        setError("Could not access clipboard. Try pressing Ctrl+V instead.");
      }
    }
  };

  const handlePasteClick = () => {
    inputRef.current?.focus();
    pasteFromClipboard();
  };

  const handleFocus = () => {
    if (!url && !autoPastedRef.current) {
      autoPastedRef.current = true;
      pasteFromClipboard(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError("Paste a video URL first");
      return;
    }

    if (!validateUrl(url)) {
      setError("Use a valid Instagram, YouTube, X, or Facebook link");
      return;
    }

    setError("");
    onSubmit(url);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-4xl">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-card/80 p-3 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.15),transparent_40%)] pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-3 rounded-[1.25rem] bg-background/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Paste from clipboard"
              onClick={handlePasteClick}
              className="absolute left-1 top-1/2 z-10 h-12 w-12 -translate-y-1/2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ClipboardPaste className="h-5 w-5" />
            </Button>
            <Input
              ref={inputRef}
              type="url"
              placeholder="Paste Instagram, YouTube, X, or Facebook URL here"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError("");
              }}
              onFocus={handleFocus}
              className="h-14 rounded-2xl border-white/10 bg-secondary/80 pl-14 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            variant="gradient"
            size="lg"
            disabled={isLoading}
            className="h-14 rounded-2xl px-6 text-base sm:w-auto w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles />
                Unpack Reel
              </>
            )}
          </Button>
        </div>

        <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-2 text-sm text-muted-foreground">
          <span>Transcript + video + subtitles</span>
          <span className="hidden sm:inline">•</span>
          <span>Instagram, YouTube, X, Facebook</span>
          <span className="hidden sm:inline">•</span>
          <span>Free &amp; unlimited · runs on your device</span>
        </div>
      </div>

      {error && <p className="mt-3 text-center text-sm text-destructive animate-fade-in">{error}</p>}
    </form>
  );
}

