import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText, Subtitles, FileType, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { downloadPdf, downloadSrt, downloadTranscriptImage, downloadTxt } from "@/lib/exports";

interface ExportBarProps {
  transcript: string;
  timestampedTranscript?: string;
  disabled?: boolean;
}

export function ExportBar({ transcript, timestampedTranscript, disabled }: ExportBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success("Transcript copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const actions = [
    { label: "TXT", icon: FileText, onClick: () => { downloadTxt(transcript); toast.success("TXT downloaded"); } },
    { label: "SRT", icon: Subtitles, onClick: () => { downloadSrt(transcript, timestampedTranscript); toast.success("SRT downloaded"); } },
    { label: "PDF", icon: FileType, onClick: () => { downloadPdf(transcript); toast.success("PDF downloaded"); } },
    { label: "Image", icon: ImageDown, onClick: () => { downloadTranscriptImage(transcript); toast.success("Image downloaded"); } },
  ];

  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-white/10 bg-background/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleCopy}
          disabled={disabled}
          className="h-12 flex-1 gap-2 rounded-xl text-sm sm:flex-none sm:px-6"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>

        {actions.map(({ label, icon: Icon, onClick }) => (
          <Button
            key={label}
            variant="secondary"
            onClick={onClick}
            disabled={disabled}
            className="h-12 flex-1 gap-2 rounded-xl border border-white/10 text-sm sm:flex-none sm:px-5"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
