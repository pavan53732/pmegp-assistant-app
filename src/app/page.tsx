"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  FolderOpen,
  FileText,
  IndianRupee,
  ShieldCheck,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ── Status badge color mapping ─────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        setProjects(data.projects ?? []);
      })
      .catch(() => {
        setProjects([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                PMEGP Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                Prime Minister&apos;s Employment Generation Programme
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">
        {/* Hero card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Get Started</CardTitle>
            <CardDescription>
              Create a new PMEGP project application. The AI interview will
              guide you through every section — from applicant details to
              financial planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Available in Phase 2
            </p>
          </CardContent>
        </Card>

        {/* Project list */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Your Projects</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No projects yet. Create your first PMEGP application to get
                  started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {projects.map((project) => (
                <Card key={project.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated{" "}
                        {new Date(project.updatedAt).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[project.status] ?? "outline"}>
                      {STATUS_LABEL[project.status] ?? project.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <CardTitle className="text-sm">Scheme Guidelines</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                PMEGP provides subsidy for setting up micro-enterprises in
                manufacturing and service sectors. Subsidy rates vary by
                category (General, SC/ST, Women, etc.) and area (Urban, Rural).
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle className="text-sm">DPR Generation</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                A Detailed Project Report (DPR) is auto-generated from your
                project data — including financial projections, eligibility
                analysis, and subsidy calculations.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t bg-card mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground text-center">
            PMEGP Assistant &mdash; Phase 1 Foundation. All calculations are
            indicative. Verify against latest KVIC/MoMSME guidelines before
            submission.
          </p>
        </div>
      </footer>
    </div>
  );
}