"use client";

import { Badge } from "@/components/ui/badge";
import type { QuestionSuggestion } from "@/features/ai/interview/types";

// ── Props ──────────────────────────────────────────────────────────────────

interface SuggestionChipsProps {
  suggestions: QuestionSuggestion[];
  onSelect?: (value: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label="Suggested answers">
      {suggestions.map((s, i) => (
        <button
          key={`${s.value}-${i}`}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onSelect?.(s.value)}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200
            bg-emerald-50 text-emerald-800 px-3 py-1.5 text-xs font-medium
            hover:bg-emerald-100 hover:border-emerald-300 transition-colors
            dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300
            dark:hover:bg-emerald-900/50 cursor-pointer text-left"
        >
          {s.label}
          {s.description && (
            <Badge
              variant="outline"
              className="text-[10px] px-1 py-0 h-3.5 font-normal text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
            >
              {s.description}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}