"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  FolderOpen,
  FileText,
  IndianRupee,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

import { ChatView } from "@/components/interview/chat-view";
import { ReviewView } from "@/components/interview/review-view";
import { ProjectCard } from "@/components/interview/project-card";
import {
  createProject,
  fetchProjects,
  sendChatMessage,
  formatIndianCurrency,
} from "@/lib/interview-api";
import type { ProjectProfile } from "@/shared/types/project-profile";

// ── View type ──────────────────────────────────────────────────────────────

type ViewType = "dashboard" | "interview" | "review" | "status";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ── Status badge config ────────────────────────────────────────────────────

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

// ── Main Page Component ────────────────────────────────────────────────────

export default function Home() {
  // View state
  const [view, setView] = useState<ViewType>("dashboard");

  // Dashboard state
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // New project dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  // Interview state
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [interviewProfile, setInterviewProfile] = useState<ProjectProfile | null>(null);

  // Review state
  const [reviewProfile, setReviewProfile] = useState<ProjectProfile | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Status view state
  const [statusProfile, setStatusProfile] = useState<ProjectProfile | null>(null);

  // ── Load projects ──────────────────────────────────────────────

  const reloadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const list = await fetchProjects();
      setProjects(list);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadProjects();
  }, [reloadProjects]);

  // ── Create new project ─────────────────────────────────────────

  const handleCreateProject = useCallback(async () => {
    const name = newProjectName.trim() || `Project ${projects.length + 1}`;
    setCreating(true);
    try {
      const projectId = await createProject(name);
      setDialogOpen(false);
      setNewProjectName("");
      toast.success("Project created!", { description: name });
      // Enter interview view
      setActiveProjectId(projectId);
      setInterviewProfile(null);
      setView("interview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      toast.error("Error", { description: msg });
    } finally {
      setCreating(false);
    }
  }, [newProjectName, projects.length]);

  // ── Open existing project ──────────────────────────────────────

  const handleOpenProject = useCallback(
    async (project: ProjectSummary) => {
      if (project.status === "DPR_READY" || project.status === "VALIDATED") {
        // Show status view
        toast.info("This project has been confirmed.");
        setView("status");
        return;
      }
      setActiveProjectId(project.id);
      setInterviewProfile(null);
      setView("interview");
    },
    []
  );

  // ── Interview callbacks ────────────────────────────────────────

  const handleGoBack = useCallback(() => {
    setActiveProjectId(null);
    setInterviewProfile(null);
    setReviewProfile(null);
    setStatusProfile(null);
    setView("dashboard");
    reloadProjects();
  }, [reloadProjects]);

  const handleEnterReview = useCallback((profile: ProjectProfile) => {
    setReviewProfile(profile);
    setView("review");
  }, []);

  // ── Review callbacks ───────────────────────────────────────────

  const handleConfirmReview = useCallback(async () => {
    if (!activeProjectId) return;
    setConfirming(true);
    try {
      // Send "confirm" message to the chat API
      const res = await sendChatMessage(activeProjectId, "confirm");
      if (res.profile) {
        setStatusProfile(res.profile);
        setReviewProfile(res.profile);
      }
      setView("status");
      toast.success("Project confirmed!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to confirm";
      toast.error("Error", { description: msg });
    } finally {
      setConfirming(false);
    }
  }, [activeProjectId]);

  const handleReviewGoBack = useCallback(() => {
    setView("interview");
  }, []);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <AnimatePresence mode="wait">
      {view === "dashboard" && (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DashboardView
            projects={projects}
            loading={projectsLoading}
            onCreateClick={() => setDialogOpen(true)}
            onProjectClick={handleOpenProject}
            dialogOpen={dialogOpen}
            setDialogOpen={setDialogOpen}
            newProjectName={newProjectName}
            setNewProjectName={setNewProjectName}
            creating={creating}
            onCreateProject={handleCreateProject}
          />
        </motion.div>
      )}

      {view === "interview" && activeProjectId && (
        <motion.div
          key="interview"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <ChatView
            projectId={activeProjectId}
            initialProfile={interviewProfile ?? undefined}
            onGoBack={handleGoBack}
            onEnterReview={handleEnterReview}
          />
        </motion.div>
      )}

      {view === "review" && reviewProfile && (
        <motion.div
          key="review"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* We'll pass the latest profile from interview - but we need to sync it.
              For now, use a placeholder that will be replaced by the real profile
              from the chat API state. */}
          <ReviewView
            profile={reviewProfile}
            projectId={activeProjectId ?? ""}
            onConfirm={handleConfirmReview}
            onGoBack={handleReviewGoBack}
            loading={confirming}
          />
        </motion.div>
      )}

      {view === "status" && (
        <motion.div
          key="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <StatusView
            profile={statusProfile}
            onGoBack={handleGoBack}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────────────

interface DashboardViewProps {
  projects: ProjectSummary[];
  loading: boolean;
  onCreateClick: () => void;
  onProjectClick: (p: ProjectSummary) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  creating: boolean;
  onCreateProject: () => void;
}

function DashboardView({
  projects,
  loading,
  onCreateClick,
  onProjectClick,
  dialogOpen,
  setDialogOpen,
  newProjectName,
  setNewProjectName,
  creating,
  onCreateProject,
}: DashboardViewProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-600 text-white">
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
        <Card className="mb-8 border-emerald-100 dark:border-emerald-900/50">
          <CardHeader>
            <CardTitle className="text-lg">Get Started</CardTitle>
            <CardDescription>
              Create a new PMEGP project application. The AI interview will
              guide you through every section — from applicant details to
              financial planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Give your PMEGP application a name. You can change it later.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      placeholder="e.g. Paper Plate Manufacturing"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onCreateProject();
                      }}
                      disabled={creating}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onCreateProject}
                    disabled={creating}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      "Create & Start Interview"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Project list */}
        <section aria-labelledby="projects-heading">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            <h2 id="projects-heading" className="text-lg font-semibold">
              Your Projects
            </h2>
            {projects.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {projects.length}
              </Badge>
            )}
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
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={onProjectClick}
                />
              ))}
            </div>
          )}
        </section>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
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
                <FileText className="w-5 h-5 text-emerald-600" />
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
            PMEGP Assistant &mdash; AI-powered project application builder. All
            calculations are indicative. Verify against latest KVIC/MoMSME
            guidelines before submission.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── Status View ────────────────────────────────────────────────────────────

function StatusView({
  profile,
  onGoBack,
}: {
  profile: ProjectProfile | null;
  onGoBack: () => void;
}) {
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
            {/* Success banner */}
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 px-4 py-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
                  Application Confirmed
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400 mt-1">
                  Your project profile has been submitted. It will go through
                  validation, eligibility checks, and financial analysis.
                </p>
              </div>
            </div>

            {/* Completeness */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Completeness</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={profile.validation?.completeness ?? 0} className="h-2 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {profile.validation?.completeness ?? 0}% —{" "}
                  {(profile.validation?.missingFields?.length ?? 0) > 0
                    ? `${profile.validation!.missingFields.length} fields still pending`
                    : "All fields collected"}
                </p>
              </CardContent>
            </Card>

            {/* Quick summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Project Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Business" value={profile.business?.name || profile.business?.description || "—"} />
                <Row label="NIC Code" value={profile.business?.nicCode ? `${profile.business.nicCode} — ${profile.business.nicDescription}` : "—"} />
                <Row label="Location" value={profile.location?.district && profile.location?.state ? `${profile.location.district}, ${profile.location.state}` : "—"} />
                <Row label="Project Cost" value={formatIndianCurrency(profile.financials?.totalProjectCost ?? 0)} />
                <Row label="Total Employment" value={String(profile.employees?.totalEmployment ?? 0)} />
                <Separator className="my-1" />
                <Row label="Sector" value={profile.business?.sector ?? "—"} />
                <Row label="Area Type" value={profile.location?.area ?? "—"} />
              </CardContent>
            </Card>

            {/* Next steps */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Next Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Validation Engine will check all fields for consistency and completeness</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Eligibility Engine will verify PMEGP scheme eligibility</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Financial Engine will generate detailed projections</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[10px] font-bold">4</span>
                    <span>DPR (Detailed Project Report) will be generated for download</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-4" />
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

      <footer className="border-t bg-card mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
          <p className="text-xs text-muted-foreground text-center">
            PMEGP Assistant — Processing complete. Further engines will run
            automatically.
          </p>
        </div>
      </footer>
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