import { Sparkles } from "lucide-react";
import { InstagramLogo, YouTubeLogo, XLogo, FacebookLogo } from "@/components/PlatformLogos";

export function Hero() {
  return (
    <header className="mx-auto mb-8 w-full max-w-3xl text-center sm:mb-10">
      <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Transcribe · Watch · Download · Export
      </div>

      <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
        Every video,{" "}
        <span className="gradient-text">turned into text</span>
      </h1>

      <p className="mx-auto mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
        Drop a link. Scripz pulls the video, transcribes it right in your browser — free, unlimited,
        no account — and hands you clean text, timestamps, subtitles and the original file.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {[
          { Logo: InstagramLogo, label: "Instagram" },
          { Logo: YouTubeLogo, label: "YouTube" },
          { Logo: XLogo, label: "X" },
          { Logo: FacebookLogo, label: "Facebook" },
        ].map(({ Logo, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-muted-foreground backdrop-blur"
          >
            <Logo className="h-4 w-4" />
            {label}
          </span>
        ))}
      </div>
    </header>
  );
}
