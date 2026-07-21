"use client";

import { useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Circle } from "lucide-react";
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

const PHASE_META: Record<
  InterviewPhase,
  { label: string; shortLabel: string; description: string }
> = {
  APPLICANT_DISCOVERY: {
    label: "Applicant Details",
    shortLabel: "Applicant",
    description: "Collect your personal details and eligibility info",
  },
  BUSINESS_DISCOVERY: {
    label: "Business Idea",
    shortLabel: "Business",
    description: "Understand your business concept and activity type",
  },
  ACTIVITY_RESOLUTION: {
    label: "Activity & NIC Code",
    shortLabel: "Activity",
    description: "Identify the correct NIC code for your enterprise",
  },
  PROJECT_SIZING: {
    label: "Project Sizing",
    shortLabel: "Sizing",
    description: "Determine capacity, land, and infrastructure needs",
  },
  FINANCIAL_PLANNING: {
    label: "Financial Planning",
    shortLabel: "Financials",
    description: "Plan costs, investments, and financial projections",
  },
  REVIEW: {
    label: "Review & Confirm",
    shortLabel: "Review",
    description: "Review all collected details before submission",
  },
  VALIDATION_COMPLETION: {
    label: "Validation",
    shortLabel: "Validation",
    description: "Validate your application and complete the process",
  },
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Current phase completion percentage
  const currentPhaseProgress = useMemo(() => {
    const p = phaseProgress[currentPhase];
    if (!p || p.totalFields === 0) return 0;
    return Math.round((p.completedFields / p.totalFields) * 100);
  }, [phaseProgress, currentPhase]);

  // Find the last completed phase index for the "Complete" label
  const lastCompletedIndex = useMemo(() => {
    let lastIdx = -1;
    for (let i = PHASE_ORDER.length - 1; i >= 0; i--) {
      const status = phaseProgress[PHASE_ORDER[i]]?.status ?? "NOT_STARTED";
      if (status === "COMPLETED") {
        lastIdx = i;
        break;
      }
    }
    return lastIdx;
  }, [phaseProgress]);

  // Auto-scroll to active phase on mobile
  useEffect(() => {
    if (scrollRef.current) {
      const activeDot = scrollRef.current.querySelector(
        '[data-phase-active="true"]'
      );
      if (activeDot) {
        activeDot.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [currentPhase]);

  return (
    <div className="rounded-xl bg-muted/50 border border-border/50 p-3 space-y-2.5">
      {/* Overall completeness bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground flex items-center gap-2">
            {PHASE_META[currentPhase]?.label ?? currentPhase}
            {/* Completion percentage badge for current phase */}
            {currentPhaseProgress > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 tabular-nums"
              >
                {currentPhaseProgress}%
              </motion.span>
            )}
          </span>
          <span className="font-medium text-muted-foreground tabular-nums bg-muted/80 px-1.5 py-0.5 rounded-md">
            {overallProgress}%
          </span>
        </div>
        <div className="relative overflow-hidden rounded-full">
          <Progress
            value={overallProgress}
            className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-500"
          />
          {/* Shimmer overlay */}
          {overallProgress > 0 && (
            <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Phase steps — horizontal with connector lines */}
      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto pb-0.5 scrollbar-none scroll-smooth snap-x snap-mandatory"
      >
        {PHASE_ORDER.map((phase, idx) => {
          const meta = PHASE_META[phase];
          const progress = phaseProgress[phase];
          const status = progress?.status ?? "NOT_STARTED";
          const isActive = phase === currentPhase;
          const isPast = idx < currentIndex;
          const isComplete = status === "COMPLETED" || isPast;
          const isFirstPhase = idx === 0;
          const isLastCompleted = idx === lastCompletedIndex && !isActive;

          return (
            <div key={phase} className="flex items-center shrink-0 snap-start">
              {/* Phase dot */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    data-phase-active={isActive ? "true" : undefined}
                    className={`relative flex items-center justify-center rounded-lg transition-all duration-300 ${
                      isActive
                        ? "w-6 h-6 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1 sm:rounded-lg ring-2 ring-emerald-400/40 scale-[1.05]"
                        : isComplete
                          ? "w-6 h-6 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1 sm:rounded-lg"
                          : "w-6 h-6 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1 sm:rounded-lg bg-muted/80"
                    } ${
                      isActive
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : isComplete
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground/60"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {/* Pulsing animation for active phase */}
                    {isActive && (
                      <motion.span
                        className="absolute -inset-1.5 rounded-full bg-emerald-400/25 dark:bg-emerald-400/15"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.5, 0, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}

                    {/* Filled checkmark for completed phases */}
                    {isComplete ? (
                      <span className="relative flex items-center justify-center w-full h-full sm:w-auto sm:h-auto">
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap">
                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </span>
                          <span>
                            {isLastCompleted
                              ? "Complete"
                              : `${idx + 1}. ${meta.label}`}
                          </span>
                        </span>
                        <span className="sm:hidden w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" strokeWidth={3} />
                        </span>
                      </span>
                    ) : isActive ? (
                      <span className="relative flex items-center justify-center w-full h-full sm:w-auto sm:h-auto">
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap">
                          <span className="relative w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)] shrink-0">
                            <motion.span
                              className="absolute inset-0 rounded-full bg-emerald-400"
                              animate={{ opacity: [0.75, 0.3, 0.75], scale: [1, 1.4, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </span>
                          <span>
                            {isFirstPhase
                              ? "Start"
                              : `${idx + 1}. ${meta.label}`}
                          </span>
                        </span>
                        <span className="sm:hidden relative w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]">
                          <motion.span
                            className="absolute inset-0 rounded-full bg-emerald-400"
                            animate={{ opacity: [0.75, 0.3, 0.75], scale: [1, 1.4, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          />
                        </span>
                      </span>
                    ) : (
                      <span className="relative flex items-center justify-center w-full h-full sm:w-auto sm:h-auto">
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap opacity-70">
                          <Circle className="w-3 h-3 fill-current shrink-0" />
                          <span>{idx + 1}. {meta.label}</span>
                        </span>
                        <span className="sm:hidden opacity-50">
                          <Circle className="w-3 h-3 fill-current" />
                        </span>
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  <div className="text-center">
                    <p className="font-medium">{meta.label}</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {meta.description}
                    </p>
                    {progress && progress.totalFields > 0 && (
                      <p className="text-emerald-600 dark:text-emerald-400 mt-1 text-[11px] font-medium">
                        {progress.completedFields}/{progress.totalFields} fields
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Connector line with gradient for completed sections */}
              {idx < PHASE_ORDER.length - 1 && (
                <div className="w-3 sm:w-4 h-px mx-0.5 shrink-0">
                  <div
                    className={`h-full rounded-full transition-colors duration-500 ${
                      isComplete || isActive
                        ? "bg-emerald-400 dark:bg-emerald-600"
                        : "bg-border"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}