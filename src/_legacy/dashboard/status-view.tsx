"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  IndianRupee,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Briefcase,
  Calculator,
  ClipboardCheck,
  FileText,
  Building2,
  MapPin,
  Users,
  Eye,
  Download,
  Plus,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";

import { formatIndianCurrency } from "@/lib/interview-api";
import {
  runPipelineStep,
  downloadDpr,
  downloadPdf,
  PIPELINE_STEPS_INFO,
} from "@/lib/pipeline-api";
import { getPipelineStepIndex } from "@/services/pipeline-constants";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";
import type { PipelineStepResponse } from "@/lib/pipeline-api";

// ── Types ─────────────────────────────────────────────────────────────────

/** Per-step state tracked in the UI. */
interface StepState {
  status: "pending" | "running" | "completed" | "error";
  result: PipelineStepResponse | null;
  error: string | null;
}

/** Props for the `StatusView` component. */
export interface StatusViewProps {
  /** The confirmed project profile, or null if not yet loaded. */
  profile: ProjectProfile | null;
  /** The project's unique ID — required for running pipeline steps. */
  projectId: string | null;
  /** The current status of the project from the DB. */
  projectStatus: ProjectStatus;
  /** Navigate back to the dashboard. */
  onGoBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Derive the initial step states from the project status. */
function deriveInitialSteps(projectStatus: string): StepState[] {
  const currentIdx = getPipelineStepIndex(projectStatus);
  return PIPELINE_STEPS_INFO.map((_, i) => {
    if (i < currentIdx) {
      return { status: "completed" as const, result: null, error: null };
    }
    return { status: "pending" as const, result: null, error: null };
  });
}

/** Icon for each pipeline step. */
const STEP_ICONS: Record<string, React.ReactNode> = {
  eligibility: <ClipboardCheck className="w-4 h-4" />,
  financial: <Calculator className="w-4 h-4" />,
  dpr: <FileText className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
};

// ── Sub-components ────────────────────────────────────────────────────────

/** Displays the eligibility check results after the step completes. */
function EligibilityResultCard({ result }: { result: PipelineStepResponse }) {
  const eligibility = result.data.eligibilityResult as {
    eligible: boolean;
    checks: { label: string; passed: boolean; reason: string }[];
    blockers: string[];
    warnings: string[];
  } | null;

  if (!eligibility) return null;

  return (
    <div className="mt-3 space-y-2">
      <Badge variant={eligibility.eligible ? "default" : "destructive"}>
        {eligibility.eligible ? "Eligible" : "Not Eligible"}
      </Badge>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {eligibility.checks.map((check, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {check.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            )}
            <span className="text-muted-foreground">{check.reason}</span>
          </div>
        ))}
      </div>
      {eligibility.warnings.length > 0 && (
        <div className="space-y-1">
          {eligibility.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Displays the financial analysis results after the step completes. */
function FinancialResultCard({ result }: { result: PipelineStepResponse }) {
  const fin = result.data.financialResult as {
    totalProjectCost: number;
    subsidyAmount: number;
    subsidyRate: number;
    bankTermLoan: number;
    emi: number;
    dscr: number;
    breakEvenPercent: number;
    annualRevenue: number;
    annualNetProfit: number;
  } | null;

  if (!fin) return null;

  const dscrOk = fin.dscr >= 1.25;
  const beOk = fin.breakEvenPercent <= 70;

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Project Cost</p>
          <p className="text-sm font-semibold">{formatIndianCurrency(fin.totalProjectCost)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subsidy ({fin.subsidyRate}%)</p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatIndianCurrency(fin.subsidyAmount)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bank Term Loan</p>
          <p className="text-sm font-semibold">{formatIndianCurrency(fin.bankTermLoan)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly EMI</p>
          <p className="text-sm font-semibold">{formatIndianCurrency(fin.emi)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">DSCR</p>
          <p className={`text-sm font-semibold ${dscrOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
            {fin.dscr.toFixed(2)}
            {!dscrOk && (
              <span className="text-[10px] font-normal text-muted-foreground ml-1">(&lt; 1.25)</span>
            )}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Break-Even</p>
          <p className={`text-sm font-semibold ${beOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
            {fin.breakEvenPercent.toFixed(1)}%
          </p>
        </div>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span>Annual Revenue: {formatIndianCurrency(fin.annualRevenue)}</span>
        <span>·</span>
        <span>Net Profit: {formatIndianCurrency(fin.annualNetProfit)}</span>
      </div>
      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Displays DPR generation result with download button. */
function DprResultCard({
  result,
  projectId,
}: {
  result: PipelineStepResponse;
  projectId: string;
}) {
  const sectionCount = result.data.dprSectionCount as number | undefined;
  const wordCount = result.data.dprWordCount as number | undefined;

  return (
    <div className="mt-3 space-y-2">
      <Badge variant="default">Generated</Badge>
      <p className="text-xs text-muted-foreground">
        {sectionCount ?? "?"} sections · {wordCount ?? "?"} words
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5"
        onClick={() => {
          downloadDpr(projectId).catch(() => {
            toast.error("Failed to download DPR");
          });
        }}
      >
        <Download className="w-3.5 h-3.5" />
        Download DPR (JSON)
      </Button>
    </div>
  );
}

/** Displays PDF export result with download button. */
function PdfResultCard({
  result,
  projectId,
}: {
  result: PipelineStepResponse;
  projectId: string;
}) {
  const sizeBytes = result.data.pdfSizeBytes as number | undefined;

  return (
    <div className="mt-3 space-y-2">
      <Badge variant="default">Generated</Badge>
      <p className="text-xs text-muted-foreground">
        {(sizeBytes ?? 0) > 1024
          ? `${((sizeBytes ?? 0) / 1024).toFixed(1)} KB`
          : `${sizeBytes ?? 0} bytes`}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5"
        onClick={() => {
          downloadPdf(projectId).catch(() => {
            toast.error("Failed to download PDF");
          });
        }}
      >
        <Download className="w-3.5 h-3.5" />
        Download PDF (Text)
      </Button>
    </div>
  );
}

/** Single step row in the vertical stepper timeline. */
function PipelineStepRow({
  stepInfo,
  stepState,
  isLast,
  projectId,
  onRun,
}: {
  stepInfo: (typeof PIPELINE_STEPS_INFO)[number];
  stepState: StepState;
  isLast: boolean;
  projectId: string | null;
  onRun?: () => void;
}) {
  const isActive = stepState.status === "running";
  const isCompleted = stepState.status === "completed";
  const isError = stepState.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="relative flex gap-4"
    >
      {/* Vertical line with dot */}
      <div className="flex flex-col items-center">
        <motion.div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${
            isCompleted
              ? "bg-emerald-500 text-white"
              : isError
                ? "bg-red-500 text-white"
                : isActive
                  ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400 ring-offset-2 ring-offset-background"
                  : "bg-muted text-muted-foreground"
          }`}
          animate={isActive ? { scale: [1, 1.08, 1] } : {}}
          transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-4.5 h-4.5" />
          ) : isError ? (
            <XCircle className="w-4.5 h-4.5" />
          ) : isActive ? (
            <Loader2 className="w-4.5 h-4.5 animate-spin" />
          ) : (
            STEP_ICONS[stepInfo.step] ?? stepInfo.step
          )}
        </motion.div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[40px] transition-colors ${
              isCompleted ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border"
            }`}
          />
        )}
      </div>

      {/* Step content */}
      <div className="pb-6 -mt-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p
            className={`text-sm font-medium ${
              isCompleted
                ? "text-emerald-700 dark:text-emerald-300"
                : isError
                  ? "text-red-600 dark:text-red-400"
                  : isActive
                    ? "text-foreground"
                    : "text-muted-foreground"
            }`}
          >
            {stepInfo.label}
          </p>
          {isCompleted && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-0">
              Done
            </Badge>
          )}
          {isActive && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 border-0">
              Running…
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-1">
          {stepInfo.description}
        </p>

        {/* Progress bar for running step */}
        {isActive && (
          <div className="mt-2">
            <Progress value={undefined} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1 animate-pulse">
              Processing…
            </p>
          </div>
        )}

        {/* Error display */}
        {isError && stepState.error && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{stepState.error}</span>
          </div>
        )}

        {/* Step-specific results */}
        {isCompleted && stepState.result && (
          <>
            {stepInfo.step === "eligibility" && (
              <EligibilityResultCard result={stepState.result} />
            )}
            {stepInfo.step === "financial" && (
              <FinancialResultCard result={stepState.result} />
            )}
            {stepInfo.step === "dpr" && projectId && (
              <DprResultCard result={stepState.result} projectId={projectId} />
            )}
            {stepInfo.step === "pdf" && projectId && (
              <PdfResultCard result={stepState.result} projectId={projectId} />
            )}
          </>
        )}

        {/* Retry button for error state */}
        {isError && onRun && (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs gap-1.5"
            onClick={onRun}
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </Button>
        )}
      </div>
    </motion.div>
  );
}

/** Compact summary item with icon. */
function SummaryItem({
  icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div
        className={`w-8 h-8 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

/** Simple row component. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="font-medium text-xs text-right truncate">{value}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

/**
 * Full-screen status view shown after a project application is confirmed.
 * Displays the engine pipeline as an interactive vertical stepper,
 * executes each step via the pipeline API, and shows results.
 */
export function StatusView({
  profile,
  projectId,
  projectStatus,
  onGoBack,
}: StatusViewProps) {
  // ── Pipeline state ──
  const [steps, setSteps] = useState<StepState[]>(
    deriveInitialSteps(projectStatus)
  );
  const [isRunningAll, setIsRunningAll] = useState(false);
  const hasAutoStartedRef = useRef(false);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  // Derive steps when projectStatus changes
  useEffect(() => {
    setSteps(deriveInitialSteps(projectStatus));
  }, [projectStatus]);

  // ── Find the next pending step ──
  const nextStepIndex = useMemo(() => {
    return steps.findIndex(
      (s) => s.status === "pending" || s.status === "error"
    );
  }, [steps]);

  const allComplete = useMemo(
    () => steps.every((s) => s.status === "completed"),
    [steps]
  );

  const completedCount = useMemo(
    () => steps.filter((s) => s.status === "completed").length,
    [steps]
  );

  // ── Progress percentage ──
  const progressPercent = Math.round(
    (completedCount / PIPELINE_STEPS_INFO.length) * 100
  );

  // ── Run a single step ──
  const runStep = useCallback(
    async (stepIdx: number) => {
      if (!projectId) {
        toast.error("No project ID — cannot run pipeline");
        return false;
      }

      const stepInfo = PIPELINE_STEPS_INFO[stepIdx];
      if (!stepInfo) return false;

      // Set step to running
      setSteps((prev) =>
        prev.map((s, i) =>
          i === stepIdx
            ? { ...s, status: "running" as const, error: null }
            : s
        )
      );

      try {
        const result = await runPipelineStep(projectId, stepInfo.step);
        const success = result.success;

        setSteps((prev) =>
          prev.map((s, i) =>
            i === stepIdx
              ? {
                  ...s,
                  status: success ? ("completed" as const) : ("error" as const),
                  result: success ? result : null,
                  error: !success ? (result.errors[0] ?? "Step failed") : null,
                }
              : s
          )
        );

        if (success) {
          toast.success(`${stepInfo.label} completed`);
        } else {
          toast.error(`${stepInfo.label} failed`, {
            description: result.errors[0] ?? "Unknown error",
          });
        }

        return success;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        setSteps((prev) =>
          prev.map((s, i) =>
            i === stepIdx
              ? { ...s, status: "error" as const, error: msg }
              : s
          )
        );
        toast.error(`${stepInfo.label} failed`, { description: msg });
        return false;
      }
    },
    [projectId]
  );

  // ── Run all remaining steps sequentially ──
  const runAllRemaining = useCallback(async () => {
    if (isRunningAll) return;
    setIsRunningAll(true);

    try {
      // Find the first non-completed step using ref for latest state
      for (let i = 0; i < PIPELINE_STEPS_INFO.length; i++) {
        const currentStepState = stepsRef.current[i];
        if (currentStepState?.status === "completed") continue;

        const success = await runStep(i);
        if (!success) break;
      }
    } finally {
      setIsRunningAll(false);
    }
  }, [isRunningAll, runStep]);

  // ── Auto-start: run all steps when component mounts ──
  useEffect(() => {
    if (
      projectId &&
      profile &&
      nextStepIndex >= 0 &&
      !isRunningAll &&
      !hasAutoStartedRef.current
    ) {
      hasAutoStartedRef.current = true;
      const timer = setTimeout(() => {
        runAllRemaining();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [projectId, profile, nextStepIndex, isRunningAll, runAllRemaining]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ── */}
      <header className="border-b bg-card shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoBack}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Project Pipeline</h1>
            <p className="text-xs text-muted-foreground">
              {allComplete
                ? "All steps completed successfully"
                : nextStepIndex >= 0
                  ? `Running ${PIPELINE_STEPS_INFO[nextStepIndex]?.label ?? ""}…`
                  : "Processing complete"}
            </p>
          </div>
          <Badge
            variant={allComplete ? "default" : "secondary"}
            className="text-xs"
          >
            {completedCount}/{PIPELINE_STEPS_INFO.length} steps
          </Badge>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:px-6">
        {profile ? (
          <div className="space-y-6">
            {/* ── Progress Overview ── */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">
                  {allComplete ? "Pipeline Complete" : "Running Pipeline"}
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {progressPercent}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </motion.div>

            {/* ── Pipeline Stepper ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Engine Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {PIPELINE_STEPS_INFO.map((stepInfo, i) => (
                      <PipelineStepRow
                        key={stepInfo.step}
                        stepInfo={stepInfo}
                        stepState={
                          steps[i] ?? {
                            status: "pending",
                            result: null,
                            error: null,
                          }
                        }
                        isLast={i === PIPELINE_STEPS_INFO.length - 1}
                        projectId={projectId}
                        onRun={
                          steps[i]?.status === "pending" ||
                          steps[i]?.status === "error"
                            ? () => runStep(i)
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  {/* Run All button */}
                  {!allComplete && nextStepIndex >= 0 && !isRunningAll && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        onClick={runAllRemaining}
                        className="w-full sm:w-auto gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Run Remaining Steps
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Project Summary ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Project Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <SummaryItem
                      icon={<Building2 className="w-4 h-4" />}
                      iconBg="bg-violet-100 dark:bg-violet-900/40"
                      iconColor="text-violet-600 dark:text-violet-400"
                      label="Business"
                      value={
                        profile.business?.name ||
                        profile.business?.description ||
                        "—"
                      }
                    />
                    <SummaryItem
                      icon={<MapPin className="w-4 h-4" />}
                      iconBg="bg-rose-100 dark:bg-rose-900/40"
                      iconColor="text-rose-600 dark:text-rose-400"
                      label="Location"
                      value={
                        profile.location?.district &&
                        profile.location?.state
                          ? `${profile.location.district}, ${profile.location.state}`
                          : "—"
                      }
                    />
                    <SummaryItem
                      icon={<IndianRupee className="w-4 h-4" />}
                      iconBg="bg-emerald-100 dark:bg-emerald-900/40"
                      iconColor="text-emerald-600 dark:text-emerald-400"
                      label="Project Cost"
                      value={formatIndianCurrency(
                        profile.financials?.totalProjectCost ?? 0
                      )}
                    />
                    <SummaryItem
                      icon={<Users className="w-4 h-4" />}
                      iconBg="bg-orange-100 dark:bg-orange-900/40"
                      iconColor="text-orange-600 dark:text-orange-400"
                      label="Total Employment"
                      value={String(
                        profile.employees?.totalEmployment ?? 0
                      )}
                    />
                  </div>
                  <Separator className="my-3" />
                  <div className="grid grid-cols-2 gap-3">
                    <Row
                      label="NIC Code"
                      value={
                        profile.business?.nicCode
                          ? `${profile.business.nicCode} — ${profile.business.nicDescription}`
                          : "—"
                      }
                    />
                    <Row
                      label="Sector"
                      value={profile.business?.sector ?? "—"}
                    />
                    <Row
                      label="Area Type"
                      value={profile.location?.area ?? "—"}
                    />
                    <Row
                      label="Completeness"
                      value={`${profile.validation?.completeness ?? 0}%`}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Action Cards ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
            >
              <h3 className="text-sm font-semibold mb-3">What You Can Do</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Eye className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">
                        View Application
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Review submitted details
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      completedCount >= 3
                        ? "ring-1 ring-emerald-300 dark:ring-emerald-700"
                        : "opacity-50 pointer-events-none"
                    }`}
                    onClick={() => {
                      if (projectId && completedCount >= 3) {
                        downloadDpr(projectId).catch(() => {
                          toast.error("Failed to download DPR");
                        });
                      }
                    }}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">
                        Download DPR
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {completedCount >= 3
                          ? "Get your project report"
                          : "Available after DPR generation"}
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={onGoBack}
                  >
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">
                        Start New Project
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Begin another application
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          </div>
        ) : (
          /* No profile loaded yet */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Briefcase className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-1">Loading Project…</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {projectId
                ? "Fetching your project details."
                : "No project selected. Go back to the dashboard."}
            </p>
          </div>
        )}

        {/* Back button */}
        <div className="mt-8 mb-8">
          <Button
            variant="outline"
            onClick={onGoBack}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 bg-gradient-to-b from-muted/30 to-muted/50 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
          <p className="text-[11px] text-muted-foreground/50 text-center">
            PMEGP Assistant — Pipeline{" "}
            {allComplete ? "complete" : `in progress (${progressPercent}%)`}.
          </p>
        </div>
      </footer>
    </div>
  );
}