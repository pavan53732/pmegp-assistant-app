"use client";

import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Trash2, Pencil, Check, X, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { duplicateProject, exportProject } from "@/lib/interview-api";
import { notificationCenter } from "@/components/notification-center";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  EMPTY: "outline",
  PARTIAL: "secondary",
  DISCOVERING: "secondary",
  COMPLETE: "default",
  REVIEW_PENDING: "default",
  VALIDATED: "default",
  ELIGIBILITY_READY: "default",
  FINANCIAL_READY: "default",
  DPR_READY: "default",
};

const STATUS_LABEL: Record<string, string> = {
  EMPTY: "Empty",
  PARTIAL: "In Progress",
  DISCOVERING: "Discovering",
  COMPLETE: "Complete",
  REVIEW_PENDING: "Review Pending",
  VALIDATED: "Validated",
  ELIGIBILITY_READY: "Eligibility Checked",
  FINANCIAL_READY: "Financials Ready",
  DPR_READY: "DPR Ready",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  EMPTY: "bg-muted text-muted-foreground hover:bg-muted",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  DISCOVERING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30",
  COMPLETE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  REVIEW_PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  VALIDATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  ELIGIBILITY_READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  FINANCIAL_READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  DPR_READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
};

// Status progress mapping (0-100%)
const STATUS_PROGRESS: Record<string, number> = {
  EMPTY: 0,
  PARTIAL: 15,
  DISCOVERING: 35,
  COMPLETE: 55,
  REVIEW_PENDING: 65,
  VALIDATED: 80,
  ELIGIBILITY_READY: 90,
  FINANCIAL_READY: 95,
  DPR_READY: 100,
};

const STATUS_STEPS = ["EMPTY", "PARTIAL", "DISCOVERING", "COMPLETE", "REVIEW_PENDING", "VALIDATED", "ELIGIBILITY_READY", "FINANCIAL_READY", "DPR_READY"];

function getStatusStepIndex(status: string): number {
  return STATUS_STEPS.indexOf(status);
}

function getLeftBorderColor(status: string): string {
  switch (status) {
    case "PARTIAL":
    case "REVIEW_PENDING":
      return "#f59e0b";
    case "DISCOVERING":
      return "#60a5fa";
    case "EMPTY":
      return "hsl(var(--muted-foreground) / 0.3)";
    default:
      return "#10b981";
  }
}

function getStepDotColor(status: string): string {
  const idx = getStatusStepIndex(status);
  if (idx <= 1) return "bg-amber-400";      // Empty/Partial
  if (idx <= 2) return "bg-blue-400";        // Discovering
  if (idx <= 4) return "bg-emerald-400";     // Complete/Review
  return "bg-emerald-500";                   // Validated+
}

function getProgressColor(status: string): string {
  const idx = getStatusStepIndex(status);
  if (idx <= 1) return "bg-amber-500 dark:bg-amber-400";      // Empty/Partial
  if (idx <= 2) return "bg-blue-500 dark:bg-blue-400";          // Discovering
  if (idx <= 4) return "bg-emerald-500 dark:bg-emerald-400";    // Complete/Review
  return "bg-emerald-600 dark:bg-emerald-500";                  // Validated+
}

function getLeftGradientStyle(status: string): string {
  switch (status) {
    case "PARTIAL":
    case "REVIEW_PENDING":
      return "from-amber-100/60 via-transparent to-transparent dark:from-amber-900/20";
    case "DISCOVERING":
      return "from-blue-100/60 via-transparent to-transparent dark:from-blue-900/20";
    case "EMPTY":
      return "from-muted/30 via-transparent to-transparent";
    default:
      return "from-emerald-100/60 via-transparent to-transparent dark:from-emerald-900/20";
  }
}

interface ProjectCardProps {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onDuplicate?: (newId: string, newName: string) => void;
  formatDate: (dateStr: string) => string;
}

export function ProjectCard({
  id,
  name,
  status,
  createdAt,
  updatedAt,
  onOpen,
  onDelete,
  onRename,
  onDuplicate,
  formatDate,
}: ProjectCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleSaveRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    setRenameValue(name);
    setIsRenaming(false);
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDuplicating(true);
    try {
      const result = await duplicateProject(id);
      toast.success("Project duplicated!", { description: result.name });
      notificationCenter.add("Project Duplicated", `Created a copy of "${name}"`, "success");
      onDuplicate?.(result.id, result.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to duplicate project";
      toast.error("Duplicate failed", { description: msg });
    } finally {
      setDuplicating(false);
    }
  };

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await exportProject(id);
      toast.success("Project exported!", { description: `${name}-export.json` });
    } catch {
      toast.error("Export failed", { description: "Could not export project" });
    }
  };

  const statusLabel = STATUS_LABEL[status] ?? status;
  const statusVariant = STATUS_VARIANT[status] ?? "outline";
  const badgeClass = STATUS_BADGE_CLASS[status] ?? "";
  const leftColor = getLeftBorderColor(status);
  const progress = STATUS_PROGRESS[status] ?? 0;
  const progressColor = getProgressColor(status);
  const stepIndex = getStatusStepIndex(status);
  const stepDotColor = getStepDotColor(status);
  const leftGradient = getLeftGradientStyle(status);

  return (
    <div
      className="group relative flex items-center gap-3 rounded-xl border border-l-4 bg-card p-4 hover:shadow-lg hover:border-emerald-200 dark:hover:border-emerald-800 cursor-pointer transition-all duration-300 hover:bg-gradient-to-r hover:from-emerald-50/40 hover:to-transparent dark:hover:from-emerald-950/20 dark:hover:to-transparent"
      style={{ borderLeftColor: leftColor }}
      onClick={isRenaming ? undefined : onOpen}
      role="button"
      tabIndex={isRenaming ? -1 : 0}
      aria-label={`Open project: ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {/* Subtle left-side gradient fade */}
      <div className={`absolute inset-y-0 left-0 w-16 bg-gradient-to-r ${leftGradient} rounded-l-xl pointer-events-none`} />

      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isRenaming ? (
            <div
              className="flex items-center gap-1.5 flex-1 min-w-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRename();
                  if (e.key === "Escape") handleCancelRename();
                }}
                className="h-7 text-sm py-0"
              />
              <button
                onClick={(e) => { e.stopPropagation(); handleSaveRename(); }}
                className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors shrink-0"
                aria-label="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleCancelRename(); }}
                className="flex items-center justify-center w-7 h-7 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors shrink-0"
                aria-label="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <p className="font-medium text-sm truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                {name}
              </p>
              {/* Colored dot indicator + status badge */}
              <Badge
                variant={statusVariant}
                className={`text-[10px] px-1.5 py-0 shrink-0 ${badgeClass}`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${stepDotColor} mr-1`} />
                {statusLabel}
              </Badge>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Updated {formatDate(updatedAt)}
          </span>
        </div>
        {/* Status progress bar */}
        {!isRenaming && (
          <div className="flex items-center gap-2">
            <Progress
              value={progress}
              className={`h-2 flex-1 rounded-full [&>[data-slot=progress-indicator]]:${progressColor} rounded-full`}
            />
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-8 text-right">
              {progress}%
            </span>
          </div>
        )}
        {/* Step indicator */}
        {!isRenaming && status !== "EMPTY" && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Step {stepIndex + 1} of 9
          </p>
        )}
      </div>

      {/* Action buttons */}
      {!isRenaming && (
        <div className="relative flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
          {/* Rename button */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setRenameValue(name);
              setIsRenaming(true);
            }}
            aria-label={`Rename project: ${name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {/* Duplicate button */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200 disabled:opacity-50"
            onClick={handleDuplicate}
            disabled={duplicating}
            aria-label={`Duplicate project: ${name}`}
          >
            {duplicating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Export button */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-200"
            onClick={handleExport}
            aria-label={`Export project: ${name}`}
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {/* Delete button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Delete project: ${name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &ldquo;{name}&rdquo;? This
                  action cannot be undone. All project data, including interview
                  history and generated reports, will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
