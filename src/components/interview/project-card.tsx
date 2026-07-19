"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { formatIndianDate } from "@/lib/interview-api";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ── Status config ──────────────────────────────────────────────────────────

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

const STATUS_COLOR: Record<string, string> = {
  EMPTY: "text-muted-foreground",
  PARTIAL: "text-amber-600 dark:text-amber-400",
  DISCOVERING: "text-emerald-600 dark:text-emerald-400",
  COMPLETE: "text-emerald-600 dark:text-emerald-400",
  REVIEW_PENDING: "text-amber-600 dark:text-amber-400",
  VALIDATED: "text-emerald-700 dark:text-emerald-300",
  ELIGIBILITY_READY: "text-emerald-700 dark:text-emerald-300",
  FINANCIAL_READY: "text-emerald-700 dark:text-emerald-300",
  DPR_READY: "text-emerald-700 dark:text-emerald-300",
};

// ── Props ──────────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectSummary;
  onClick: (project: ProjectSummary) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const statusLabel = STATUS_LABEL[project.status] ?? project.status;
  const statusVariant = STATUS_VARIANT[project.status] ?? "outline";
  const statusColor = STATUS_COLOR[project.status] ?? "text-muted-foreground";

  const updatedDate = useMemo(
    () => formatIndianDate(project.updatedAt),
    [project.updatedAt]
  );

  return (
    <Card
      className="group cursor-pointer hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all duration-200"
      onClick={() => onClick(project)}
      role="button"
      tabIndex={0}
      aria-label={`Open project: ${project.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(project);
        }
      }}
    >
      <CardContent className="p-4 flex items-center gap-4">
        {/* Project name & date */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
            {project.name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Updated {updatedDate}
          </p>
        </div>

        {/* Status badge */}
        <Badge variant={statusVariant} className={`text-xs shrink-0 ${statusColor}`}>
          {statusLabel}
        </Badge>

        {/* Arrow */}
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-emerald-600 transition-colors shrink-0" />
      </CardContent>
    </Card>
  );
}