import { useState, useEffect, useCallback } from "react";
import { HistoryItem } from "@/types/history";

const HISTORY_STORAGE_KEY = "transcript-history";
const MAX_HISTORY_ITEMS = 50;

export function useTranscriptHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryItem[];
        setHistory(parsed);
      }
    } catch (e) {
      console.error("Failed to load transcript history:", e);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = useCallback((items: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save transcript history:", e);
    }
  }, []);

  const addToHistory = useCallback((item: Omit<HistoryItem, "id" | "createdAt">) => {
    setHistory((prev) => {
      // Check if this shortcode already exists
      const existingIndex = prev.findIndex((h) => h.shortcode === item.shortcode);

      let newHistory: HistoryItem[];

      if (existingIndex !== -1) {
        // Update existing item and move to top
        const existing = prev[existingIndex];
        const updated: HistoryItem = {
          ...existing,
          ...item,
          createdAt: Date.now(),
        };
        newHistory = [updated, ...prev.filter((_, i) => i !== existingIndex)];
      } else {
        // Add new item at the top
        const newItem: HistoryItem = {
          ...item,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        newHistory = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS);
      }

      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory((prev) => {
      const newHistory = prev.filter((item) => item.id !== id);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  return {
    history,
    addToHistory,
    deleteFromHistory,
    clearHistory,
  };
}
