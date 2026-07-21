"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
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
        <motion.button
          key={`${s.value}-${i}`}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onSelect?.(s.value)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.06, ease: "easeOut" }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="group inline-flex items-center gap-1.5 rounded-full
            border border-white/20 dark:border-white/10
            bg-white/60 dark:bg-white/5
            backdrop-blur-md
            text-emerald-800 dark:text-emerald-200
            px-3.5 py-1.5 text-xs font-medium
            hover:bg-white/80 dark:hover:bg-white/10
            hover:border-emerald-300 dark:hover:border-emerald-600
            hover:shadow-sm hover:shadow-emerald-500/10
            transition-colors cursor-pointer text-left"
        >
          {s.label}
          {s.description && (
            <span className="inline-flex items-center rounded-full bg-emerald-100/80 dark:bg-emerald-800/40 px-1.5 py-0 text-[10px] font-normal text-emerald-700 dark:text-emerald-300 ml-0.5">
              {s.description}
            </span>
          )}
          <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-60 group-hover:translate-x-0 transition-all duration-200" />
        </motion.button>
      ))}
    </div>
  );
}