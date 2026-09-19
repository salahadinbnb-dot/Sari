import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Trash2, Library } from "lucide-react";
import { platformMeta } from "@/components/PlatformLogos";
import type { HistoryItem } from "@/types/history";

interface HistoryLibraryProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryLibrary({ history, onSelect, onDelete, onClearAll }: HistoryLibraryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) => h.transcript.toLowerCase().includes(q) || h.url.toLowerCase().includes(q) || h.shortcode.toLowerCase().includes(q),
    );
  }, [history, query]);

  if (history.length === 0) return null;

  return (
    <section className="mx-auto mt-16 w-full max-w-5xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
          <Library className="h-4.5 w-4.5 text-primary" />
          Your library
          <span className="text-sm text-muted-foreground">({history.length})</span>
        </h2>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search transcripts"
              className="h-11 rounded-xl border-white/10 bg-white/[0.03] pl-9 text-sm"
            />
          </div>
          <Button variant="ghost" onClick={onClearAll} className="h-11 rounded-xl text-muted-foreground hover:text-destructive">
            Clear
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
          Nothing matches "{query}".
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const meta = platformMeta[item.sourceType];
            const Logo = meta.Logo;
            return (
              <article
                key={item.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30"
              >
                <button onClick={() => onSelect(item)} className="block w-full text-left">
                  <div className="relative aspect-video overflow-hidden bg-white/[0.03]">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={`Thumbnail for ${meta.label} transcript`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Logo className="h-8 w-8 opacity-50" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 text-[11px] text-foreground backdrop-blur">
                      <Logo className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                  </div>

                  <div className="p-4">
                    <p className="line-clamp-2 text-sm leading-6 text-foreground/85">
                      {item.transcript.slice(0, 160) || "No transcript"}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete from library"
                  onClick={() => onDelete(item.id)}
                  className="absolute right-2 top-2 h-8 w-8 rounded-lg bg-background/70 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
