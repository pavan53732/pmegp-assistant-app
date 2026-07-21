"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
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
} from "lucide-react";

import { formatIndianCurrency } from "@/lib/interview-api";
import type { ProjectProfile } from "@/shared/types/project-profile";

// ── Props ─────────────────────────────────────────────────────────────────

/** Props for the `StatusView` component. */
export interface StatusViewProps {
  /** The confirmed project profile, or null if not yet loaded. */
  profile: ProjectProfile | null;
  /** Navigate back to the dashboard. */
  onGoBack: () => void;
}

// ── Success Checkmark Animation ─────────────────────────────────────────────

function SuccessCheckAnimation() {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const checkPathLength = 40;

  return (
    <div className="relative flex items-center justify-center w-24 h-24 mx-auto">
      <motion.svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-emerald-200 dark:text-emerald-900/60"
        />
        {/* Animated ring */}
        <motion.circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          className="text-emerald-500"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
        {/* Checkmark */}
        <motion.path
          d="M30 50 L43 63 L66 37"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600 dark:text-emerald-400"
          strokeDasharray={checkPathLength}
          strokeDashoffset={checkPathLength}
          initial={{ strokeDashoffset: checkPathLength }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.7 }}
          style={{ transform: "rotate(0deg)", transformOrigin: "center" }}
        />
      </motion.svg>
      {/* Glow pulse behind */}
      <motion.div
        className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// ── Timeline Step ───────────────────────────────────────────────────────────

function TimelineStep({
  step,
  title,
  description,
  isActive,
  isCompleted,
  delay,
}: {
  step: number;
  title: string;
  description: string;
  isActive: boolean;
  isCompleted: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative flex gap-4"
    >
      <div className="flex flex-col items-center">
        <motion.div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
            isCompleted
              ? "bg-emerald-500 text-white"
              : isActive
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400 ring-offset-2 ring-offset-background dark:ring-offset-background"
                : "bg-muted text-muted-foreground"
          }`}
          animate={isActive && !isCompleted ? { scale: [1, 1.1, 1] } : {}}
          transition={isActive && !isCompleted ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            step
          )}
        </motion.div>
        <div className="w-0.5 flex-1 min-h-[24px] bg-border" />
      </div>

      <div className="pb-6 -mt-1">
        <p className={`text-sm font-medium ${isCompleted ? "text-emerald-700 dark:text-emerald-300" : isActive ? "text-foreground" : "text-muted-foreground"}`}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// ── Engine Stage Indicator ──────────────────────────────────────────────────

function EngineStages({ currentStep }: { currentStep: number }) {
  const stages = [
    { label: "Interview", icon: <Briefcase className="w-3.5 h-3.5" /> },
    { label: "Validation", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { label: "Eligibility", icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
    { label: "Financial", icon: <Calculator className="w-3.5 h-3.5" /> },
    { label: "DPR Gen", icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const done = i <= currentStep;
        return (
          <div key={stage.label} className="flex items-center gap-1">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 + 0.5, duration: 0.3 }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-colors ${
                done
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {stage.icon}
              {stage.label}
            </motion.div>
            {i < stages.length - 1 && (
              <div className={`w-4 h-0.5 ${i < currentStep ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Summary Item with Icon ──────────────────────────────────────────────────

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
      <div className={`w-8 h-8 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Tiny helper ────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground text-xs shrink-0">{label}</span>
      <span className="font-medium text-xs text-right truncate">{value}</span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Full-screen status view shown after a project application is confirmed.
 * Displays a success animation, engine pipeline progress, project summary,
 * next-steps timeline, and action cards.
 */
export function StatusView({
  profile,
  onGoBack,
}: StatusViewProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onGoBack} aria-label="Back to dashboard">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Project Status</h1>
            <p className="text-xs text-muted-foreground">Your application is being processed</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:px-6">
        {profile ? (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center pt-2 pb-4"
            >
              <SuccessCheckAnimation />
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.4 }}
                className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-4"
              >
                Application Confirmed!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                className="text-sm text-muted-foreground mt-1 max-w-md mx-auto"
              >
                Your project profile has been submitted and will go through
                validation, eligibility checks, and financial analysis.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.4 }}
              className="p-4 rounded-xl border bg-card overflow-x-auto"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Engine Pipeline</p>
              <EngineStages currentStep={0} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.4 }}
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
                      value={profile.business?.name || profile.business?.description || "—"}
                    />
                    <SummaryItem
                      icon={<MapPin className="w-4 h-4" />}
                      iconBg="bg-rose-100 dark:bg-rose-900/40"
                      iconColor="text-rose-600 dark:text-rose-400"
                      label="Location"
                      value={profile.location?.district && profile.location?.state ? `${profile.location.district}, ${profile.location.state}` : "—"}
                    />
                    <SummaryItem
                      icon={<IndianRupee className="w-4 h-4" />}
                      iconBg="bg-emerald-100 dark:bg-emerald-900/40"
                      iconColor="text-emerald-600 dark:text-emerald-400"
                      label="Project Cost"
                      value={formatIndianCurrency(profile.financials?.totalProjectCost ?? 0)}
                    />
                    <SummaryItem
                      icon={<Users className="w-4 h-4" />}
                      iconBg="bg-orange-100 dark:bg-orange-900/40"
                      iconColor="text-orange-600 dark:text-orange-400"
                      label="Total Employment"
                      value={String(profile.employees?.totalEmployment ?? 0)}
                    />
                  </div>
                  <Separator className="my-3" />
                  <div className="grid grid-cols-2 gap-3">
                    <Row label="NIC Code" value={profile.business?.nicCode ? `${profile.business.nicCode} — ${profile.business.nicDescription}` : "—"} />
                    <Row label="Sector" value={profile.business?.sector ?? "—"} />
                    <Row label="Area Type" value={profile.location?.area ?? "—"} />
                    <Row label="Completeness" value={`${profile.validation?.completeness ?? 0}%`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.4 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Next Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <TimelineStep
                    step={1}
                    title="Validation Engine"
                    description="Check all fields for consistency and completeness"
                    isCompleted={true}
                    isActive={false}
                    delay={1.6}
                  />
                  <TimelineStep
                    step={2}
                    title="Eligibility Engine"
                    description="Verify PMEGP scheme eligibility based on category, area, and project parameters"
                    isCompleted={false}
                    isActive={true}
                    delay={1.75}
                  />
                  <TimelineStep
                    step={3}
                    title="Financial Engine"
                    description="Generate detailed financial projections, subsidy calculations, and repayment schedules"
                    isCompleted={false}
                    isActive={false}
                    delay={1.9}
                  />
                  <TimelineStep
                    step={4}
                    title="DPR Generation"
                    description="Detailed Project Report will be generated for download and submission"
                    isCompleted={false}
                    isActive={false}
                    delay={2.05}
                  />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7, duration: 0.4 }}
            >
              <h3 className="text-sm font-semibold mb-3">What You Can Do</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Eye className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">View Application</span>
                      <span className="text-[10px] text-muted-foreground">Review submitted details</span>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                        <Download className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">Download DPR</span>
                      <span className="text-[10px] text-muted-foreground">Get your project report</span>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onGoBack}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">Start New Project</span>
                      <span className="text-[10px] text-muted-foreground">Begin another application</span>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <SuccessCheckAnimation />
            <h2 className="text-lg font-semibold mb-1">Confirmed!</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your project has been confirmed. Go back to the dashboard to see
              your projects.
            </p>
          </div>
        )}

        <div className="mt-8 mb-8">
          <Button variant="outline" onClick={onGoBack} className="w-full sm:w-auto">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </main>

      <footer className="border-t border-border/50 bg-gradient-to-b from-muted/30 to-muted/50 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
          <p className="text-[11px] text-muted-foreground/50 text-center">
            PMEGP Assistant — Processing complete. Further engines will run
            automatically.
          </p>
        </div>
      </footer>
    </div>
  );
}