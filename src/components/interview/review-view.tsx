"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
      fields: [
        { label: "Target Market", value: mkt.targetMarket || "—", needsAttention: !mkt.targetMarket },
      ],
    });
  }

  return sections;
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

  const attentionCount = sections.reduce(
    (acc, s) => acc + s.fields.filter((f) => f.needsAttention).length,
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoBack}
            aria-label="Back to interview"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold">Review & Confirm</h1>
            <p className="text-xs text-muted-foreground">
              Check all details before confirming your application
            </p>
          </div>
          <Badge
            variant={completeness >= 80 ? "default" : "secondary"}
            className="text-xs"
          >
            {completeness}% complete
          </Badge>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:px-6">
        {/* Completeness bar */}
        <div className="mb-6">
          <Progress value={completeness} className="h-2" />
        </div>

        {/* Warnings */}
        {attentionCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3 mb-6">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {attentionCount} field{attentionCount > 1 ? "s" : ""} need attention
              </p>
              <p className="text-amber-700/80 dark:text-amber-400 text-xs mt-0.5">
                Fields highlighted in amber are missing or may need correction.
              </p>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 mb-6">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-300">
              {errors.map((e, i) => (
                <p key={i} className="text-xs">{e.message}</p>
              ))}
            </div>
          </div>
        )}

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, si) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.05, duration: 0.25 }}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {section.fields.map((field) => (
                    <div
                      key={field.label}
                      className={`flex justify-between items-start gap-4 py-1.5 text-sm ${
                        field.needsAttention
                          ? "bg-amber-50 dark:bg-amber-900/10 -mx-2 px-2 rounded"
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
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8 mb-8">
          <Button
            variant="outline"
            onClick={onGoBack}
            className="flex-1"
            disabled={loading}
          >
            Go Back to Interview
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Confirming…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm & Submit
              </>
            )}
          </Button>
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