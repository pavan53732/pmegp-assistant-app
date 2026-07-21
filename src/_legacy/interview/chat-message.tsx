"use client";

import { memo, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Copy, Check } from "lucide-react";
import type { ChatMessage, QuestionSuggestion } from "@/features/ai/interview/types";
import { SuggestionChips } from "./suggestion-chips";
import { DateSeparator } from "./date-separator";
import { toast } from "sonner";

// ── Phase label map ────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  APPLICANT_DISCOVERY: "Applicant",
  BUSINESS_DISCOVERY: "Business",
  ACTIVITY_RESOLUTION: "Activity",
  PROJECT_SIZING: "Project Size",
  FINANCIAL_PLANNING: "Financials",
  REVIEW: "Review",
  VALIDATION_COMPLETION: "Validation",
};

// ── Time formatting helper ─────────────────────────────────────────────────

function formatTimestamp(timestamp: string): string {
  const now = Date.now();
  const msgTime = new Date(timestamp).getTime();
  const diffMs = now - msgTime;

  if (diffMs < 60_000) {
    return "Just now";
  }

  return new Date(timestamp).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Date comparison helper ─────────────────────────────────────────────────

function isDifferentDay(tsA: string, tsB: string): boolean {
  const a = new Date(tsA);
  const b = new Date(tsB);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface ChatMessageBubbleProps {
  message: ChatMessage;
  index: number;
  previousMessage?: ChatMessage;
  onSuggestionClick?: (value: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  index,
  previousMessage,
  onSuggestionClick,
}: ChatMessageBubbleProps) {
  const isUser = message.role === "USER";
  const phaseLabel = PHASE_LABELS[message.phase] ?? message.phase;
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Parse suggestions from the message content (JSON block at end)
  const suggestions = useMemoSuggestions(message);

  // Determine if we need a date separator
  const showDateSeparator = useMemo(() => {
    if (!previousMessage) return true; // Show for first message
    return isDifferentDay(previousMessage.timestamp, message.timestamp);
  }, [previousMessage, message.timestamp]);

  // Stagger delay: slight delay based on index (capped for UX)
  const staggerDelay = Math.min(index * 0.03, 0.3);

  // Copy handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [message.content]);

  return (
    <>
      {/* Date separator between different days */}
      {showDateSeparator && <DateSeparator timestamp={message.timestamp} />}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: staggerDelay, ease: "easeOut" }}
        className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white flex items-center justify-center shadow-sm">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-400/30 dark:bg-emerald-400/20 scale-125 opacity-0 animate-[ping_2s_ease-in-out_infinite]" />
              <div className="relative w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              {/* Online status dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background dark:border-card" />
            </div>
          )}
        </div>

        {/* Bubble */}
        <div
          className={`max-w-[80%] sm:max-w-[70%] min-w-0 ${
            isUser ? "items-end" : "items-start"
          }`}
        >
          <div
            className={`group relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words transition-colors duration-200 ${
              isUser
                ? "bg-gradient-to-br from-emerald-600 via-emerald-650 to-emerald-700 text-white rounded-br-md shadow-md shadow-emerald-600/20 dark:shadow-emerald-600/10"
                : "bg-card border border-border rounded-bl-md shadow-sm"
            }`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {/* Emerald gradient left border for bot messages */}
            {!isUser && (
              <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-400" />
            )}

            {/* Subtle gradient overlay on user messages */}
            {isUser && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 pointer-events-none" />
            )}

            {/* Message content */}
            <span className="relative">{message.content}</span>

            {/* Copy button — bot messages only, appears on hover */}
            {!isUser && (
              <motion.button
                type="button"
                onClick={handleCopy}
                aria-label="Copy message"
                className={`absolute -right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-150 cursor-pointer ${
                  hovered ? "opacity-100" : "opacity-0"
                }`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                animate={{ opacity: hovered ? 1 : 0 }}
                transition={{ duration: 0.15 }}
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </motion.button>
            )}
          </div>

          {/* Meta row: phase badge + time (phase badge only on bot messages) */}
          <div
            className={`flex items-center gap-1.5 mt-1 px-1 text-[11px] text-muted-foreground ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {!isUser && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 font-normal text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
              >
                {phaseLabel}
              </Badge>
            )}
            <span className={isUser ? "text-white/60 dark:text-white/50" : ""}>
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          {/* Suggestion chips */}
          {!isUser && suggestions.length > 0 && (
            <div className="mt-2">
              <SuggestionChips
                suggestions={suggestions}
                onSelect={onSuggestionClick}
              />
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────

function useMemoSuggestions(message: ChatMessage): QuestionSuggestion[] {
  const SUGGESTIONS_MARKER = "::SUGGESTIONS::";
  const idx = message.content.lastIndexOf(SUGGESTIONS_MARKER);
  if (idx === -1) return [];

  try {
    const jsonStr = message.content
      .slice(idx + SUGGESTIONS_MARKER.length)
      .trim();
    const parsed = JSON.parse(jsonStr) as QuestionSuggestion[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // ignore parse errors
  }
  return [];
}