"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SendHorizonal, Loader2, Mic, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Props ──────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onStop?: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_CHARS = 2000;
const AMBER_THRESHOLD = 0.8; // 80% = 1600 chars
const RED_THRESHOLD = 1.0; // 100% = 2000 chars

// ── Component ──────────────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message…",
  onStop,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    // Re-focus the input after sending
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const charRatio = text.length / MAX_CHARS;
  const showCharCount = text.length > 100;

  // Character count color classes
  const charCountColor =
    charRatio >= RED_THRESHOLD
      ? "text-red-500 dark:text-red-400"
      : charRatio >= AMBER_THRESHOLD
        ? "text-amber-500 dark:text-amber-400"
        : "text-muted-foreground/60";

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="border-t border-border/50 bg-card/95 backdrop-blur-xl shadow-[0_-2px_10px_rgba(0,0,0,0.03)] px-3 pt-3 pb-3.5 sm:px-4 sm:pb-4">
      <div className="max-w-4xl mx-auto">
        {/* Character count indicator */}
        <AnimatePresence>
          {showCharCount && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex justify-end mb-1.5 px-1"
            >
              <span
                className={`text-[10px] tabular-nums font-medium ${charCountColor}`}
              >
                {text.length}/{MAX_CHARS}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`flex items-center gap-2 rounded-2xl border px-3 py-1.5 transition-all duration-300 relative ${
            focused
              ? "border-emerald-400/70 dark:border-emerald-500/50 shadow-[0_0_0_4px_rgba(16,185,129,0.15)] dark:shadow-[0_0_0_4px_rgba(16,185,129,0.1)]"
              : "border-border/70 bg-muted/30 hover:bg-muted/50"
          }`}
        >
          {/* Gradient background on focus */}
          {focused && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent pointer-events-none" />
          )}

          <Input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) {
                setText(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            aria-label="Type your message"
            className="relative flex-1 h-10 rounded-full border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0 px-1 placeholder:text-muted-foreground/70"
          />

          {/* Mic placeholder button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled
                aria-label="Voice input (coming soon)"
                className="relative flex-shrink-0 w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/40 cursor-not-allowed hover:bg-muted/50"
              >
                <Mic className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px]">
              <span className="flex items-center gap-1.5">
                🎤 Coming soon
              </span>
            </TooltipContent>
          </Tooltip>

          {/* Stop generating button — visible when disabled (AI responding) */}
          <AnimatePresence mode="wait">
            {disabled ? (
              <motion.div
                key="stop"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  size="icon"
                  onClick={onStop}
                  aria-label="Stop generating"
                  className="relative h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white shrink-0 shadow-md shadow-red-500/25 transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="send"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                  className="relative h-9 w-9 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shrink-0 shadow-md shadow-emerald-600/25 disabled:opacity-40 disabled:shadow-none transition-all cursor-pointer"
                >
                  {/* Pulse animation when ready to send */}
                  {canSend && (
                    <motion.span
                      className="absolute inset-0 rounded-full bg-emerald-400/30"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 0, 0.4],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                  <SendHorizonal className="w-4 h-4 relative" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Keyboard hint — desktop only */}
        {!disabled && (
          <p className="hidden sm:block text-center mt-1.5 text-[10px] text-muted-foreground/50">
            <kbd className="inline-flex items-center gap-0.5 rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
              Enter
            </kbd>{" "}
            to send
          </p>
        )}
      </div>
    </div>
  );
}