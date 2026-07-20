"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  User,
  Building2,
  MapPin,
  Home,
  IndianRupee,
  Gauge,
  Users,
  Target,
  Download,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatIndianCurrency } from "@/lib/interview-api";
import type { ProjectProfile } from "@/shared/types/project-profile";

// ── Props ──────────────────────────────────────────────────────────────────

interface ReviewViewProps {
  profile: ProjectProfile;
  projectId: string;
  onConfirm: () => void;
  onGoBack: () => void;
  loading?: boolean;
}

// ── Section definition ─────────────────────────────────────────────────────

interface ReviewSection {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  fields: { label: string; value: string; needsAttention: boolean }[];
}

// ── Helper: build review sections from profile ─────────────────────────────

function buildSections(profile: ProjectProfile): ReviewSection[] {
  const sections: ReviewSection[] = [];

  // Applicant
  const a = profile.applicant;
  if (a) {
    sections.push({
      title: "Applicant Details",
      icon: <User className="w-4 h-4" />,
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      fields: [
        { label: "Name", value: a.name || "—", needsAttention: !a.name },
        { label: "Age", value: a.age ? String(a.age) : "—", needsAttention: !a.age },
        { label: "Gender", value: a.gender, needsAttention: false },
        { label: "Category", value: a.category, needsAttention: false },
        { label: "Education", value: a.education, needsAttention: a.education === "NONE" },
        { label: "Entity Type", value: a.entityType, needsAttention: false },
        { label: "Prior Subsidy", value: a.priorSubsidy ? "Yes" : "No", needsAttention: false },
        { label: "EDP Completed", value: a.edpCompleted ? "Yes" : "No", needsAttention: false },
      ],
    });
  }

  // Business
  const b = profile.business;
  if (b) {
    sections.push({
      title: "Business Details",
      icon: <Building2 className="w-4 h-4" />,
      iconBg: "bg-violet-100 dark:bg-violet-900/40",
      iconColor: "text-violet-600 dark:text-violet-400",
      fields: [
        { label: "Unit Name", value: b.name || "—", needsAttention: !b.name },
        { label: "Description", value: b.description || "—", needsAttention: !b.description },
        { label: "Activity Type", value: b.activityType, needsAttention: false },
        { label: "NIC Code", value: b.nicCode ? `${b.nicCode} — ${b.nicDescription ?? ""}` : "—", needsAttention: !b.nicCode },
        { label: "Sector", value: b.sector, needsAttention: false },
      ],
    });
  }

  // Location
  const loc = profile.location;
  if (loc) {
    sections.push({
      title: "Location",
      icon: <MapPin className="w-4 h-4" />,
      iconBg: "bg-rose-100 dark:bg-rose-900/40",
      iconColor: "text-rose-600 dark:text-rose-400",
      fields: [
        { label: "State", value: loc.state || "—", needsAttention: !loc.state },
        { label: "District", value: loc.district || "—", needsAttention: !loc.district },
        { label: "Area", value: loc.area, needsAttention: false },
        { label: "Hill/Border Area", value: loc.isHillBorderArea ? "Yes" : "No", needsAttention: false },
        { label: "Aspirational District", value: loc.isAspirationalDistrict ? "Yes" : "No", needsAttention: false },
      ],
    });
  }

  // Land
  const land = profile.land;
  if (land) {
    sections.push({
      title: "Land & Building",
      icon: <Home className="w-4 h-4" />,
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      fields: [
        { label: "Status", value: land.status, needsAttention: land.status === "NONE" },
        { label: "Area (sq ft)", value: land.areaSqFt ? String(land.areaSqFt) : "—", needsAttention: false },
        { label: "Monthly Rent", value: land.monthlyRent ? formatIndianCurrency(land.monthlyRent) : "—", needsAttention: false },
      ],
    });
  }

  // Financials
  const fin = profile.financials;
  if (fin) {
    sections.push({
      title: "Financial Summary",
      icon: <IndianRupee className="w-4 h-4" />,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      fields: [
        { label: "Machinery & Equipment", value: formatIndianCurrency(fin.machineryAndEquipment), needsAttention: fin.machineryAndEquipment === 0 },
        { label: "Building & Civil Works", value: formatIndianCurrency(fin.buildingAndCivilWorks), needsAttention: false },
        { label: "Other Fixed Assets", value: formatIndianCurrency(fin.otherFixedAssets), needsAttention: false },
        { label: "Pre-Operative Expenses", value: formatIndianCurrency(fin.preOperativeExpenses), needsAttention: false },
        { label: "Total Fixed Capital", value: formatIndianCurrency(fin.totalFixedCapital), needsAttention: false },
        { label: "Working Capital", value: formatIndianCurrency(fin.workingCapital), needsAttention: fin.workingCapital === 0 },
        { label: "Total Project Cost", value: formatIndianCurrency(fin.totalProjectCost), needsAttention: fin.totalProjectCost === 0 },
        { label: "Loan Tenure", value: `${fin.loanTenureYears} years`, needsAttention: false },
        { label: "Interest Rate", value: `${fin.interestRate}%`, needsAttention: fin.interestRate === 0 },
        { label: "Projected Monthly Sales", value: formatIndianCurrency(fin.projectedMonthlySales), needsAttention: fin.projectedMonthlySales === 0 },
      ],
    });
  }

  // Capacity
  const cap = profile.capacity;
  if (cap) {
    sections.push({
      title: "Capacity & Production",
      icon: <Gauge className="w-4 h-4" />,
      iconBg: "bg-cyan-100 dark:bg-cyan-900/40",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      fields: [
        { label: "Installed Capacity", value: cap.installedCapacity?.value ? `${cap.installedCapacity.value} ${cap.installedCapacity.unit}/month` : "—", needsAttention: !cap.installedCapacity?.value },
        { label: "Capacity Utilisation", value: `${cap.projectedCapacityUtil}%`, needsAttention: cap.projectedCapacityUtil === 0 },
        { label: "Working Days/Month", value: String(cap.workingDaysPerMonth), needsAttention: false },
        { label: "Shifts", value: String(cap.shifts), needsAttention: false },
      ],
    });
  }

  // Employees
  const emp = profile.employees;
  if (emp) {
    sections.push({
      title: "Employment",
      icon: <Users className="w-4 h-4" />,
      iconBg: "bg-orange-100 dark:bg-orange-900/40",
      iconColor: "text-orange-600 dark:text-orange-400",
      fields: [
        { label: "Skilled (Male/Female)", value: `${emp.skilled.male}/${emp.skilled.female}`, needsAttention: emp.skilled.male + emp.skilled.female === 0 },
        { label: "Unskilled (Male/Female)", value: `${emp.unskilled.male}/${emp.unskilled.female}`, needsAttention: emp.unskilled.male + emp.unskilled.female === 0 },
        { label: "Administrative", value: String(emp.administrative.count), needsAttention: false },
        { label: "Total Employment", value: String(emp.totalEmployment), needsAttention: emp.totalEmployment === 0 },
        { label: "Total Monthly Wages", value: formatIndianCurrency(emp.totalMonthlyWages), needsAttention: false },
      ],
    });
  }

  // Market
  const mkt = profile.market;
  if (mkt) {
    sections.push({
      title: "Market",
      icon: <Target className="w-4 h-4" />,
      iconBg: "bg-pink-100 dark:bg-pink-900/40",
      iconColor: "text-pink-600 dark:text-pink-400",
      fields: [
        { label: "Target Market", value: mkt.targetMarket || "—", needsAttention: !mkt.targetMarket },
      ],
    });
  }

  return sections;
}

// ── SVG Completeness Ring ──────────────────────────────────────────────────

function CompletenessRing({ value }: { value: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        {/* Background circle */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/50"
        />
        {/* Progress circle */}
        <motion.circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-emerald-500"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none">{value}%</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">complete</span>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function ReviewView({
  profile,
  projectId: _projectId,
  onConfirm,
  onGoBack,
  loading = false,
}: ReviewViewProps) {
  const sections = useMemo(() => buildSections(profile), [profile]);

  const completeness = profile.validation?.completeness ?? 0;
  const errors = profile.validation?.errors ?? [];
  const missingFields = profile.validation?.missingFields ?? [];

  const totalFields = sections.reduce((acc, s) => acc + s.fields.length, 0);
  const attentionCount = sections.reduce(
    (acc, s) => acc + s.fields.filter((f) => f.needsAttention).length,
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Gradient Header Banner */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="shrink-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white"
      >
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0"
            >
              <ShieldCheck className="w-6 h-6" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Review & Confirm
              </h1>
              <p className="text-emerald-100 text-sm mt-1">
                Check all details before confirming your application
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Body */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:px-6">
        {/* Completeness Ring + Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl border bg-card mb-6"
        >
          <CompletenessRing value={completeness} />

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div className="text-center sm:text-left">
              <p className="text-2xl font-bold">{sections.length}</p>
              <p className="text-xs text-muted-foreground">Sections</p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-2xl font-bold">{totalFields}</p>
              <p className="text-xs text-muted-foreground">Fields</p>
            </div>
            <div className="text-center sm:text-left">
              <p className={`text-2xl font-bold ${attentionCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {attentionCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {attentionCount > 0 ? "Need Attention" : "All Good"}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Warnings */}
        {attentionCount > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3 mb-6"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {attentionCount} field{attentionCount > 1 ? "s" : ""} need attention
              </p>
              <p className="text-amber-700/80 dark:text-amber-400 text-xs mt-0.5">
                Fields highlighted with an amber border may need correction.
              </p>
            </div>
          </motion.div>
        )}

        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 mb-6"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-300">
              {errors.map((e, i) => (
                <p key={i} className="text-xs">{e.message}</p>
              ))}
            </div>
          </motion.div>
        )}

        {/* Section Cards */}
        <div className="space-y-5">
          {sections.map((section, si) => {
            const sectionAttention = section.fields.filter((f) => f.needsAttention).length;
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: si * 0.06 + 0.3, duration: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${section.iconBg} ${section.iconColor} flex items-center justify-center shrink-0`}>
                        {section.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-semibold">
                          {section.title}
                        </CardTitle>
                      </div>
                      {sectionAttention > 0 && (
                        <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                          {sectionAttention} warning{sectionAttention > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {section.fields.map((field) => (
                        <div
                          key={field.label}
                          className={`flex justify-between items-start gap-4 py-2 px-3 rounded-md text-sm transition-colors ${
                            field.needsAttention
                              ? "border-l-[3px] border-l-amber-400 bg-amber-50 dark:bg-amber-900/10"
                              : ""
                          }`}
                        >
                          <span className="text-muted-foreground text-xs shrink-0 pt-0.5">
                            {field.label}
                          </span>
                          <span
                            className={`text-right font-medium text-xs ${
                              field.needsAttention
                                ? "text-amber-700 dark:text-amber-400"
                                : ""
                            }`}
                          >
                            {field.value}
                            {field.needsAttention && (
                              <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-500" />
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8 mb-8">
          <Button
            variant="outline"
            onClick={onGoBack}
            className="flex-1"
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back to Interview
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button
                    variant="outline"
                    className="flex-1 opacity-60 cursor-not-allowed"
                    disabled
                    aria-label="Download as PDF (coming soon)"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download as PDF
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming Soon</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1"
          >
            <Button
              onClick={onConfirm}
              disabled={loading}
              size="lg"
              className="w-full relative bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold h-12 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 transition-shadow"
            >
              {/* Subtle glow animation */}
              {!loading && (
                <motion.span
                  className="absolute inset-0 rounded-md bg-emerald-400/20"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                    scale: [1, 1.02, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Confirming…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Confirm & Submit
                  </>
                )}
              </span>
            </Button>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground text-center">
            Review all details carefully. After confirmation, the project will
            proceed to validation and eligibility checks.
          </p>
        </div>
      </footer>
    </div>
  );
}