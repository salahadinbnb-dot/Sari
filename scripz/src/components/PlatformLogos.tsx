import type { SourceType } from "@/types/history";

export function InstagramLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f9ce34" />
          <stop offset="45%" stopColor="#ee2a7b" />
          <stop offset="80%" stopColor="#6228d7" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#ig-gradient)" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="white" />
    </svg>
  );
}

export function YouTubeLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0033" />
      <path d="M10 9l5 3-5 3V9z" fill="white" />
    </svg>
  );
}

export function XLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M18.9 3H21l-6.87 7.86L22 21h-6.2l-4.86-6.35L5.4 21H3.3l7.35-8.4L2 3h6.35l4.39 5.79L18.9 3Zm-1.09 16.18h1.72L7.4 4.73H5.56l12.25 14.45Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function FacebookLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1877F2" />
      <path
        d="M13.6 12.6h1.9l.3-2.3h-2.2V8.9c0-.66.2-1.1 1.15-1.1H16V5.75A16 16 0 0 0 14.2 5.6c-1.8 0-3 1.1-3 3.1v1.6H9.3v2.3h1.9V19h2.4v-6.4Z"
        fill="white"
      />
    </svg>
  );
}

export function FileLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" fill="#334155" />
      <path d="M14 3v5h5" fill="#64748b" />
      <path d="M10 11.5v6l5-3-5-3Z" fill="white" />
    </svg>
  );
}

export const platformMeta: Record<SourceType, { label: string; Logo: (p: { className?: string }) => JSX.Element }> = {
  instagram: { label: "Instagram", Logo: InstagramLogo },
  youtube: { label: "YouTube", Logo: YouTubeLogo },
  twitter: { label: "X", Logo: XLogo },
  facebook: { label: "Facebook", Logo: FacebookLogo },
  file: { label: "File", Logo: FileLogo },
};

export function PlatformBadge({ source, className = "" }: { source: SourceType; className?: string }) {
  const { label, Logo } = platformMeta[source];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-foreground/80 ${className}`}
    >
      <Logo className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
