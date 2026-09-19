import { useState } from "react";
import { History, ChevronDown, Trash2, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface HistoryItem {
  id: string;
  url: string;
  sourceType: 'instagram' | 'youtube' | 'twitter' | 'facebook';
  transcript: string;
  timestampedTranscript?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  shortcode: string;
  createdAt: number;
}

interface TranscriptHistoryProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const sourceLabels = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
};

const sourceColors = {
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  youtube: 'bg-red-500',
  twitter: 'bg-sky-500',
  facebook: 'bg-blue-600',
};

export function TranscriptHistory({ history, onSelect, onDelete, onClearAll }: TranscriptHistoryProps) {
  const [open, setOpen] = useState(false);

  if (history.length === 0) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <History className="h-4 w-4" />
          History
          <span className="bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">
            {history.length}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 bg-popover border border-border shadow-xl z-50"
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Transcript History</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.preventDefault();
              onClearAll();
            }}
          >
            Clear All
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {history.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className="flex flex-col items-start gap-2 p-3 cursor-pointer focus:bg-accent"
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${sourceColors[item.sourceType]}`}>
                    {sourceLabels[item.sourceType]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-sm text-foreground line-clamp-2">
                {truncateText(item.transcript, 100)}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                <span className="truncate max-w-[200px]">{item.shortcode}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
