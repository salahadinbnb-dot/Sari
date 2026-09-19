export type SourceType = 'instagram' | 'youtube' | 'twitter' | 'facebook';

export interface HistoryItem {
  id: string;
  url: string;
  sourceType: SourceType;
  transcript: string;
  timestampedTranscript?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  shortcode: string;
  createdAt: number;
}
