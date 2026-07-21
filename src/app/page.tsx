"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import {
  Plus,
  IndianRupee,
  Sparkles,
  ChevronDown,
  Briefcase,
  ArrowUpRight,
  Building2,
  Loader2,
} from "lucide-react";

import { ChatView } from "@/components/interview/chat-view";
import { ReviewView } from "@/components/interview/review-view";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCards, type ProjectSummary } from "@/components/dashboard/stat-cards";
import { ProjectList } from "@/components/dashboard/project-list";
import { QuickTools } from "@/components/dashboard/quick-tools";
import { StatusView } from "@/components/dashboard/status-view";
import { ProjectTemplates, type ProjectTemplate } from "@/components/dashboard/project-templates";
import HowItWorks from "@/components/dashboard/how-it-works";
import { PmegpFaq } from "@/components/dashboard/pmegp-faq";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ProjectAnalytics } from "@/components/dashboard/project-analytics";
import {
  createProject,
  fetchProjects,
  sendChatMessage,
} from "@/lib/interview-api";
import type { ProjectProfile } from "@/shared/types/project-profile";

// ── View type ──────────────────────────────────────────────────────────────

type ViewType = "dashboard" | "interview" | "review" | "status";

// ── Main Page Component ────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState<ViewType>("dashboard");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [interviewProfile, setInterviewProfile] = useState<ProjectProfile | null>(null);
  const [reviewProfile, setReviewProfile] = useState<ProjectProfile | null>(null);
  const [confirming, setConfirming] = useState(false);
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

  useEffect(() => { reloadProjects(); }, [reloadProjects]);

  // ── Global keyboard shortcut: new project ────────────────────
  useEffect(() => {
    function onNewProject() {
      if (view === "dashboard") setDialogOpen(true);
    }
    window.addEventListener("pmegp:new-project", onNewProject);
    return () => window.removeEventListener("pmegp:new-project", onNewProject);
  }, [view]);

  // ── Create new project ─────────────────────────────────────────

  const handleCreateProject = useCallback(async () => {
    const name = newProjectName.trim() || `Project ${projects.length + 1}`;
    setCreating(true);
    try {
      const projectId = await createProject(name);
      setDialogOpen(false);
      setNewProjectName("");
      toast.success("Project created!", { description: name });
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

  // ── Create from template ──────────────────────────────────────

  const handleSelectTemplate = useCallback(async (template: ProjectTemplate) => {
    setCreating(true);
    try {
      const projectId = await createProject(template.name);
      toast.success("Project created from template!", { description: `${template.name} — ${template.projectCostLabel}` });
      setActiveProjectId(projectId);
      setInterviewProfile(null);
      setView("interview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create project";
      toast.error("Error", { description: msg });
    } finally {
      setCreating(false);
    }
  }, []);

  // ── Open existing project ──────────────────────────────────────

  const handleOpenProject = useCallback(async (project: ProjectSummary) => {
    if (project.status === "DPR_READY" || project.status === "VALIDATED") {
      toast.info("This project has been confirmed.");
      setView("status");
      return;
    }
    setActiveProjectId(project.id);
    setInterviewProfile(null);
    setView("interview");
  }, []);

  // ── Delete project ─────────────────────────────────────────────

  const handleDeleteProject = useCallback(async (projectId: string, projectName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Project deleted", { description: projectName });
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        toast.error("Failed to delete", { description: data.error?.message ?? "Unknown error" });
      }
    } catch {
      toast.error("Failed to delete project");
    }
  }, []);

  // ── Rename project ─────────────────────────────────────────────

  const handleRenameProject = useCallback(async (projectId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Project renamed", { description: newName.trim() });
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, name: newName.trim() } : p))
        );
      } else {
        toast.error("Failed to rename", { description: data.error?.message ?? "Unknown error" });
      }
    } catch {
      toast.error("Failed to rename project");
    }
  }, []);

  // ── Duplicate project ──────────────────────────────────────────

  const handleDuplicateProject = useCallback((_newId: string, _newName: string) => {
    reloadProjects();
  }, [reloadProjects]);

  // ── Navigation callbacks ────────────────────────────────────────

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

  const handleConfirmReview = useCallback(async () => {
    if (!activeProjectId) return;
    setConfirming(true);
    try {
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

  const handleReviewGoBack = useCallback(() => { setView("interview"); }, []);

  // ── View router ────────────────────────────────────────────────

  return (
    <AnimatePresence mode="wait">
      {view === "dashboard" && (
        <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <DashboardView
            projects={projects}
            loading={projectsLoading}
            filterStatus={filterStatus}
            onFilterChange={setFilterStatus}
            onCreateClick={() => setDialogOpen(true)}
            onProjectClick={handleOpenProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            onDuplicateProject={handleDuplicateProject}
            onSelectTemplate={handleSelectTemplate}
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
        <motion.div key="interview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          <ChatView projectId={activeProjectId} initialProfile={interviewProfile ?? undefined} onGoBack={handleGoBack} onEnterReview={handleEnterReview} />
        </motion.div>
      )}

      {view === "review" && reviewProfile && (
        <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          <ReviewView profile={reviewProfile} projectId={activeProjectId ?? ""} onConfirm={handleConfirmReview} onGoBack={handleReviewGoBack} loading={confirming} />
        </motion.div>
      )}

      {view === "status" && (
        <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <StatusView profile={statusProfile} onGoBack={handleGoBack} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────────────

interface DashboardViewProps {
  projects: ProjectSummary[];
  loading: boolean;
  filterStatus: string;
  onFilterChange: (value: string) => void;
  onCreateClick: () => void;
  onProjectClick: (p: ProjectSummary) => void;
  onDeleteProject: (id: string, name: string, e?: React.MouseEvent) => void;
  onRenameProject: (id: string, newName: string) => void;
  onDuplicateProject: (newId: string, newName: string) => void;
  onSelectTemplate: (template: ProjectTemplate) => void;
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
  filterStatus,
  onFilterChange,
  onCreateClick,
  onProjectClick,
  onDeleteProject,
  onRenameProject,
  onDuplicateProject,
  onSelectTemplate,
  dialogOpen,
  setDialogOpen,
  newProjectName,
  setNewProjectName,
  creating,
  onCreateProject,
}: DashboardViewProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Hero Section ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-8 sm:p-12 lg:p-16 mb-8 shadow-xl shadow-emerald-900/25"
        >
          <motion.div className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)" }}
            animate={{ x: [0, 30, -20, 0], y: [0, -20, 15, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 70%)" }}
            animate={{ x: [0, -25, 20, 0], y: [0, 15, -25, 0], scale: [1, 0.9, 1.1, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(52,211,153,0.2) 0%, transparent 70%)" }}
            animate={{ x: [0, 15, -15, 0], y: [0, 20, -10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          <motion.div
            className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent"
            initial={{ width: "0%" }} animate={{ width: "100%" }}
            transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-4">
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}>
                <Sparkles className="w-4 h-4 text-emerald-300" />
              </motion.div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1 text-emerald-100 text-xs font-medium">
                AI-Powered <Sparkles className="w-3 h-3 text-amber-300" />
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Build Your PMEGP<br />
              <span className="bg-gradient-to-r from-emerald-200 to-emerald-100 bg-clip-text text-transparent">Project Application</span>
            </h2>
            <p className="text-emerald-100/80 text-sm sm:text-base max-w-xl mb-2 leading-relaxed">
              Create a complete PMEGP application with AI-guided interviews. From applicant
              details to financial projections and DPR generation — everything in one place.
            </p>
            <p className="text-emerald-200/60 text-xs sm:text-sm mb-8">✨ No paperwork required</p>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="h-12 px-8 text-base bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-lg shadow-black/15 hover:shadow-2xl hover:shadow-emerald-400/25 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                  onClick={onCreateClick}
                >
                  <Plus className="w-5 h-5 mr-2" /> New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>Give your PMEGP application a name. You can change it later.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input id="project-name" placeholder="e.g. Paper Plate Manufacturing" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onCreateProject(); }} disabled={creating} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>Cancel</Button>
                  <Button onClick={onCreateProject} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {creating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>) : "Create & Start Interview"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <button type="button" onClick={() => { const el = document.getElementById("project-templates-title"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="mt-4 inline-flex items-center gap-1.5 text-emerald-200/70 hover:text-emerald-100 text-sm transition-colors duration-200 group">
              Browse Templates <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* ── Statistics Grid ─────────────────────────────── */}
        <StatCards projects={projects} onFilterChange={onFilterChange} />

        {/* ── How It Works ────────────────────────────────── */}
        <div className="mb-8"><HowItWorks /></div>

        {/* ── Quick-Start Templates ────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="mb-8">
          <ProjectTemplates onSelectTemplate={onSelectTemplate} />
        </motion.div>

        {/* ── Project List ────────────────────────────────── */}
        <ProjectList projects={projects} loading={loading} filterStatus={filterStatus} onFilterChange={onFilterChange} onProjectClick={onProjectClick} onDeleteProject={onDeleteProject} onRenameProject={onRenameProject} onDuplicateProject={onDuplicateProject} onCreateClick={onCreateClick} />

        {/* ── Analytics + Activity ────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2"><ProjectAnalytics projects={projects} /></div>
          <div><ActivityFeed /></div>
        </div>

        {/* ── Quick Tools ─────────────────────────────────── */}
        <QuickTools />

        {/* ── FAQ ─────────────────────────────────────────── */}
        <div className="mb-10"><PmegpFaq /></div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="mt-auto bg-gradient-to-b from-muted/30 to-muted/50">
        <div className="h-px bg-gradient-to-r from-emerald-500/20 via-transparent to-teal-500/20" />
        <div className="max-w-6xl mx-auto px-4 py-10 sm:px-6">
          <div className="grid sm:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm font-bold tracking-tight">PMEGP Assistant</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                AI-powered project application builder for the Prime Minister&apos;s
                Employment Generation Programme. Build complete DPRs in minutes.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Quick Links</p>
              <div className="space-y-2.5">
                {[
                  { label: "KVIC PMEGP Portal", href: "https://www.kvic.org.in/pmegp" },
                  { label: "MoMSME", href: "https://msme.gov.in" },
                  { label: "Udyam Registration", href: "https://www.udyamregistration.gov.in" },
                ].map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-200 group hover:translate-x-0.5">
                    {link.label}
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity duration-200 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">PMEGP Highlights</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Max Cost", value: "₹25,00,000", icon: IndianRupee },
                  { label: "Subsidy", value: "15% – 35%", icon: Briefcase },
                  { label: "Age", value: "18+ years", icon: Building2 },
                  { label: "Agencies", value: "KVIC / KVIB / DRDA", icon: Building2 },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2">
                    <item.icon className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground leading-tight">{item.label}</p>
                      <p className="text-sm font-semibold text-foreground tabular-nums leading-snug">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Separator className="my-6 bg-border/50" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              All calculations are indicative. Verify against latest KVIC/MoMSME guidelines before submission.
            </p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Sparkles className="w-3 h-3" /> Built with AI
              </span>
              <span className="text-xs text-muted-foreground">Next.js 16 · TypeScript</span>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/60 mt-6">
            © {new Date().getFullYear()} PMEGP Assistant. For informational purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
}