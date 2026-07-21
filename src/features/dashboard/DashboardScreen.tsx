// ─── Dashboard Screen ──────────────────────────────────────────────────────
// Lists all projects from the repository, with a "New Project" CTA and a
// "Create demo project" shortcut that seeds a fully-populated profile via
// `createTestProfile()` so downstream screens (Financial / Eligibility / DPR)
// have something real to render.
//
// Each project card shows: business name, NIC code, total project cost,
// completeness bar, and a status badge. Clicking a card navigates to the
// profile screen; per-stage shortcuts (Financial, Eligibility, DPR) are
// surfaced inline.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Sparkles, FileText, ShieldCheck, IndianRupee, ClipboardList } from "lucide-react";

import { getProjectRepository } from "@/database/project-repository";
import type { ProjectSummary } from "@/database/interfaces";
import { createTestProfile } from "@/test-helpers/create-test-profile";
import {
  formatINR,
  formatDate,
  statusLabel,
  statusBadgeClass,
} from "@/shared/format";

export function DashboardScreen() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const repo = getProjectRepository();
      const list = await repo.list();
      setProjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProjects([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createProject = async () => {
    setBusy(true);
    setError(null);
    try {
      const repo = getProjectRepository();
      const summary = await repo.create(
        `Project ${new Date().toLocaleDateString("en-IN")}`,
      );
      navigate(`/project/${summary.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const createDemoProject = async () => {
    setBusy(true);
    setError(null);
    try {
      const repo = getProjectRepository();
      const summary = await repo.create("Demo Project");
      await repo.updateProfile(summary.id, createTestProfile(), "COMPLETE");
      navigate(`/project/${summary.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Projects</h2>
          <p className="text-sm text-muted-foreground">
            Offline-first project list · stored in on-device SQLite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={createProject} disabled={busy} className="min-h-11">
            <Plus className="size-4" /> New Project
          </Button>
          <Button
            variant="outline"
            onClick={createDemoProject}
            disabled={busy}
            className="min-h-11"
          >
            <Sparkles className="size-4" /> Create demo project
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load projects</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {projects === null && !error && (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {projects && projects.length === 0 && !error && (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create a new blank project, or seed a fully-populated demo
              project (Rajesh Pickle Unit — manufacturing, ₹1.1L cost, all 28
              mandatory fields filled) so you can explore the financial,
              eligibility and DPR screens.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={createProject} disabled={busy} className="min-h-11">
              <Plus className="size-4" /> New Project
            </Button>
            <Button
              variant="outline"
              onClick={createDemoProject}
              disabled={busy}
              className="min-h-11"
            >
              <Sparkles className="size-4" /> Create demo project
            </Button>
          </CardContent>
        </Card>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {p.businessName || p.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {p.businessDescription || "No business description yet."}
                    </CardDescription>
                  </div>
                  <Badge className={`shrink-0 ${statusBadgeClass(p.status)}`}>
                    {statusLabel(p.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <Field label="NIC code" value={p.nicCode ?? "—"} />
                  <Field
                    label="Project cost"
                    value={
                      p.totalProjectCost > 0
                        ? formatINR(p.totalProjectCost)
                        : "—"
                    }
                  />
                  <Field
                    label="Updated"
                    value={formatDate(p.updatedAt.toISOString())}
                  />
                  <Field label="Status" value={statusLabel(p.status)} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Completeness</span>
                    <span>{p.completeness}%</span>
                  </div>
                  <Progress value={p.completeness} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    asChild
                    size="sm"
                    variant="default"
                    className="min-h-9"
                  >
                    <Link to={`/project/${p.id}`}>Open profile</Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                  >
                    <Link to={`/project/${p.id}/guided`}>
                      <ClipboardList className="size-3.5" /> Guided form
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                  >
                    <Link to={`/project/${p.id}/financial`}>
                      <IndianRupee className="size-3.5" /> Financial
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                  >
                    <Link to={`/project/${p.id}/eligibility`}>
                      <ShieldCheck className="size-3.5" /> Eligibility
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                  >
                    <Link to={`/project/${p.id}/dpr`}>
                      <FileText className="size-3.5" /> DPR
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}
