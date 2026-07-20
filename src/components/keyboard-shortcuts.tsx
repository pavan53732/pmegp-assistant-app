"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Keyboard, Plus, Moon, ArrowLeft, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────

interface ShortcutItem {
  keys: string[];
  description: string;
  icon: React.ReactNode;
}

interface ShortcutGroup {
  label: string;
  items: ShortcutItem[];
}

// ── Shortcut definitions ─────────────────────────────────────────────────

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: "General",
    items: [
      {
        keys: ["⌘", "K"],
        description: "Open keyboard shortcuts",
        icon: <Keyboard className="w-3.5 h-3.5" />,
      },
      {
        keys: ["?"],
        description: "Open shortcuts help",
        icon: <HelpCircle className="w-3.5 h-3.5" />,
      },
    ],
  },
  {
    label: "Navigation",
    items: [
      {
        keys: ["Esc"],
        description: "Go back / Close dialog",
        icon: <ArrowLeft className="w-3.5 h-3.5" />,
      },
    ],
  },
  {
    label: "Actions",
    items: [
      {
        keys: ["⌘", "N"],
        description: "New project",
        icon: <Plus className="w-3.5 h-3.5" />,
      },
      {
        keys: ["⌘", "/"],
        description: "Toggle dark / light theme",
        icon: <Moon className="w-3.5 h-3.5" />,
      },
    ],
  },
];

// ── Key badge component ──────────────────────────────────────────────────

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded-md shadow-[0_1px_0_0_hsl(var(--border))]">
      {children}
    </kbd>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘/Ctrl + K — toggle shortcuts dialog
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleToggle();
        return;
      }

      // ? — open shortcuts (only when not in an input)
      if (
        e.key === "?" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        )
      ) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      // ⌘/Ctrl + N — new project
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pmegp:new-project"));
        return;
      }

      // ⌘/Ctrl + / — toggle theme
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("pmegp:toggle-theme"));
        return;
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleToggle]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-md border-emerald-500/30 shadow-lg shadow-emerald-500/10"
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Navigate and control PMEGP Assistant with your keyboard.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-2.5">
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.description}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="text-muted-foreground">
                          {item.icon}
                        </span>
                        <span>{item.description}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {item.keys.map((key, i) => {
                          const displayKey = isMac
                            ? key
                            : key.replace("⌘", "Ctrl");
                          return (
                            <span key={i} className="flex items-center gap-0.5">
                              {i > 0 && (
                                <span className="text-xs text-muted-foreground/60 mx-0.5">
                                  +
                                </span>
                              )}
                              <KeyBadge>{displayKey}</KeyBadge>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}