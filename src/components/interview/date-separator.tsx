"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

// ── Props ──────────────────────────────────────────────────────────────────

interface DateSeparatorProps {
  timestamp: string;
}

// ── Date formatting ────────────────────────────────────────────────────────

function formatDateLabel(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return "Today";
  }

  if (msgDay.getTime() === yesterday.getTime()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export function DateSeparator({ timestamp }: DateSeparatorProps) {
  const label = useMemo(() => formatDateLabel(timestamp), [timestamp]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3 py-3 px-1"
      role="separator"
    >
      {/* Left gradient line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      {/* Label */}
      <span className="text-[11px] font-medium text-muted-foreground/70 whitespace-nowrap select-none">
        {label}
      </span>
      {/* Right gradient line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </motion.div>
  );
}