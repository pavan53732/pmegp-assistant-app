"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Bot, User } from "lucide-react";
import type { ChatMessage, QuestionSuggestion } from "@/features/ai/interview/types";
import { SuggestionChips } from "./suggestion-chips";

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

// ── Props ──────────────────────────────────────────────────────────────────

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onSuggestionClick?: (value: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  onSuggestionClick,
}: ChatMessageBubbleProps) {
  const isUser = message.role === "USER";
  const phaseLabel = PHASE_LABELS[message.phase] ?? message.phase;

  // Parse suggestions from the message content (JSON block at end)
  const suggestions = useMemoSuggestions(message);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        }`}
        aria-label={isUser ? "You" : "PMEGP Assistant"}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] sm:max-w-[70%] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card border border-border rounded-bl-md shadow-sm"
          }`}
        >
          {message.content}
        </div>

        {/* Meta row: phase badge + time */}
        <div
          className={`flex items-center gap-1.5 mt-1 px-1 text-[11px] text-muted-foreground ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {phaseLabel}
          </Badge>
          <span>
            {new Date(message.timestamp).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
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
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────

function useMemoSuggestions(message: ChatMessage): QuestionSuggestion[] {
  // The chat API returns a ChatMessage. Suggestions may be embedded as a
  // JSON block at the end of the content, e.g.:
  //   "What is your age?\n\n::SUGGESTIONS::[{\"label\":\"25\",\"value\":\"25\"}]"
  const SUGGESTIONS_MARKER = "::SUGGESTIONS::";
  const idx = message.content.lastIndexOf(SUGGESTIONS_MARKER);
  if (idx === -1) return [];

  try {
    const jsonStr = message.content.slice(idx + SUGGESTIONS_MARKER.length).trim();
    const parsed = JSON.parse(jsonStr) as QuestionSuggestion[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // ignore parse errors
  }
  return [];
}