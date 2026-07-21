// ─── Eligibility Screen ────────────────────────────────────────────────────
// Loads the project, calls `checkEligibility(profile)` from the eligibility
// engine, and renders:
//   1. A prominent eligible / ineligible banner (with blockers count).
//   2. Warnings (e.g. EDP training not completed).
//   3. A checklist of every criterion with ✓/✗, actual vs required, and the
//      human-readable reason.
//
// The eligibility engine is pure and synchronous. Profile-load errors are
// surfaced via a shadcn Alert.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  IndianRupee,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

import { getProjectRepository } from "@/database/project-repository";
import type { ProjectProfile } from "@/shared/types/project-profile";
import {
  checkEligibility,
  type EligibilityResult,
} from "@/engines/eligibility-engine";

export function EligibilityScreen() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProjectProfile | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = getProjectRepository();
        const row = await repo.getById(id);
        if (cancelled) return;
        if (!row) {
          setError("Project not found.");
          return;
        }
        setProfile(row.profile);
        setProjectName(row.businessName || row.name);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const result: EligibilityResult | null = useMemo(
    () => (profile ? checkEligibility(profile) : null),
    [profile],
  );

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load eligibility</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
          <ArrowLeft className="size-3.5" /> Back to dashboard
        </Button>
      </Alert>
    );
  }

  if (!profile || !result) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  const passed = result.checks.filter((c) => c.passed).length;
  const total = result.checks.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 min-h-9 text-muted-foreground"
            onClick={() => navigate(`/project/${id}`)}
          >
            <ArrowLeft className="size-3.5" /> Profile
          </Button>
          <h2 className="truncate text-2xl font-semibold tracking-tight">
            Eligibility · {projectName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {passed}/{total} criteria pass ·{" "}
            {result.blockers.length} blocker{result.blockers.length === 1 ? "" : "s"}
            {result.warnings.length > 0
              ? ` · ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-9">
            <Link to={`/project/${id}/financial`}>
              <IndianRupee className="size-3.5" /> Financial
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-9">
            <Link to={`/project/${id}/dpr`}>
              <FileText className="size-3.5" /> DPR
            </Link>
          </Button>
        </div>
      </div>

      {/* Banner */}
      <Card
        className={
          result.eligible
            ? "border-emerald-500/60 bg-emerald-500/5"
            : "border-destructive/60 bg-destructive/5"
        }
      >
        <CardContent className="flex items-center gap-4 py-5">
          {result.eligible ? (
            <CheckCircle2 className="size-10 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="size-10 shrink-0 text-destructive" />
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">
              {result.eligible
                ? "Eligible for PMEGP subsidy"
                : "Not eligible for PMEGP subsidy"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {result.eligible
                ? "All hard eligibility criteria pass. You may proceed to financial review and DPR generation."
                : `${result.blockers.length} hard blocker${result.blockers.length === 1 ? "" : "s"} must be resolved before this project is PMEGP-eligible.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Blockers */}
      {result.blockers.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Blockers ({result.blockers.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {result.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4 text-amber-500" />
          <AlertTitle>Warnings ({result.warnings.length})</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eligibility checklist</CardTitle>
          <CardDescription>
            Every PMEGP hard criterion evaluated against this profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Criterion</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.checks.map((c) => (
                <TableRow key={c.criterionId}>
                  <TableCell>
                    {c.passed ? (
                      <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="size-5 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {c.label}
                    <div className="text-xs text-muted-foreground">
                      {c.criterionId}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.actual ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.required ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
