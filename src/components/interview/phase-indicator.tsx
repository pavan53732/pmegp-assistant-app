"use client";

import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Circle, Loader2 } from "lucide-react";
import type { InterviewPhase, PhaseProgress } from "@/shared/types/interview";

// ── Phase configuration ────────────────────────────────────────────────────

const PHASE_ORDER: InterviewPhase[] = [
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
  "REVIEW",
  "VALIDATION_COMPLETION",
];

const PHASE_META: Record<InterviewPhase, { label: string; shortLabel: string }> = {
  APPLICANT_DISCOVERY: { label: "Applicant Details", shortLabel: "Applicant" },
  BUSINESS_DISCOVERY: { label: "Business Idea", shortLabel: "Business" },
  ACTIVITY_RESOLUTION: { label: "Activity & NIC Code", shortLabel: "Activity" },
  PROJECT_SIZING: { label: "Project Sizing", shortLabel: "Sizing" },
  FINANCIAL_PLANNING: { label: "Financial Planning", shortLabel: "Financials" },
  REVIEW: { label: "Review & Confirm", shortLabel: "Review" },
  VALIDATION_COMPLETION: { label: "Validation", shortLabel: "Validation" },
};

// ── Props ──────────────────────────────────────────────────────────────────

interface PhaseIndicatorProps {
  currentPhase: InterviewPhase;
  phaseProgress: Record<InterviewPhase, PhaseProgress>;
  completeness: number;
}

// ── Component ──────────────────────────────────────────────────────────────

export function PhaseIndicator({
  currentPhase,
  phaseProgress,
  completeness,
}: PhaseIndicatorProps) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  const overallProgress = useMemo(() => {
    let completedFields = 0;
    let totalFields = 0;
    for (const phase of PHASE_ORDER) {
      const p = phaseProgress[phase];
      if (p) {
        completedFields += p.completedFields;
        totalFields += p.totalFields;
      }
    }
    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  }, [phaseProgress]);

  return (
    <div className="space-y-3">
      {/* Overall completeness bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">
            {PHASE_META[currentPhase]?.label ?? currentPhase}
          </span>
          <span className="text-muted-foreground">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-1.5" />
      </div>

      {/* Phase steps — horizontal on desktop, compact on mobile */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {PHASE_ORDER.map((phase, idx) => {
          const meta = PHASE_META[phase];
          const progress = phaseProgress[phase];
          const status = progress?.status ?? "NOT_STARTED";
          const isActive = phase === currentPhase;
          const isPast = idx < currentIndex;
          const isComplete = status === "COMPLETED" || isPast;

          return (
            <Tooltip key={phase}>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : isComplete
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isComplete ? (
                    <Check className="w-3 h-3" />
                  ) : isActive ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Circle className="w-3 h-3 opacity-40" />
                  )}
                  <span className="hidden sm:inline">{meta.label}</span>
                  <span className="sm:hidden">{meta.shortLabel}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="text-center">
                  <p className="font-medium">{meta.label}</p>
                  {progress && progress.totalFields > 0 && (
                    <p className="text-muted-foreground">
                      {progress.completedFields}/{progress.totalFields} fields
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}