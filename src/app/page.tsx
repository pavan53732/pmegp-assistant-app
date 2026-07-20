"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, animate } from "framer-motion";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  FolderOpen,
  FileText,
  IndianRupee,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Search,
  Trash2,
  Calculator,
  ClipboardCheck,
  Info,
  ChevronDown,
  Clock,
  TrendingUp,
  BarChart3,
  Briefcase,
  Sparkles,
  X,
  Eye,
  Download,
  Building2,
  MapPin,
  Users,
  Pencil,
  CreditCard,
  SearchCode,
  Target,
  FileCheck2,
  ArrowUpDown,
  LayoutGrid,
  List,
  Zap,
  BookOpen,
  ArrowUpRight,
} from "lucide-react";

import { ChatView } from "@/components/interview/chat-view";
import { ReviewView } from "@/components/interview/review-view";
import { SubsidyCalculator } from "@/components/dashboard/subsidy-calculator";
import { EligibilityChecker } from "@/components/dashboard/eligibility-checker";
import { SchemeInfo } from "@/components/dashboard/scheme-info";
import { NicCodeSearch } from "@/components/dashboard/nic-code-search";
import { EmiCalculator } from "@/components/dashboard/emi-calculator";
import { BreakevenCalculator } from "@/components/dashboard/breakeven-calculator";
import { DocumentChecklist } from "@/components/dashboard/document-checklist";
import { SubsidyComparison } from "@/components/dashboard/subsidy-comparison";
import { ProjectCard } from "@/components/dashboard/project-card";
import { ProjectTemplates, type ProjectTemplate } from "@/components/dashboard/project-templates";
import HowItWorks from "@/components/dashboard/how-it-works";
import { PmegpFaq } from "@/components/dashboard/pmegp-faq";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ProjectAnalytics } from "@/components/dashboard/project-analytics";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";
import { NotificationTrigger } from "@/components/notification-center";
import {
  createProject,
  fetchProjects,
  sendChatMessage,
  formatIndianCurrency,
  formatIndianDate,
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

const STATUS_BADGE_CLASS: Record<string, string> = {
  EMPTY: "bg-muted text-muted-foreground hover:bg-muted",
  PARTIAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  DISCOVERING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30",
  COMPLETE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  REVIEW_PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  VALIDATED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  ELIGIBILITY_READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  FINANCIAL_READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  DPR_READY: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
};

// ── Animated Number Counter ──────────────────────────────────────────────

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 120, damping: 30, mass: 0.8 });
  const display = useTransform(springVal, (v) => Math.round(v).toString());
  const [displayValue, setDisplayValue] = useState("0");

  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 0.8 });
    const unsubscribe = display.on("change", (v) => setDisplayValue(v));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [value, motionVal, display]);

  return <span className={className}>{displayValue}</span>;
}

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

  // ── Global keyboard shortcut: new project ────────────────────
  useEffect(() => {
    function onNewProject() {
      if (view === "dashboard") {
        setDialogOpen(true);
      }
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

  const handleOpenProject = useCallback(
    async (project: ProjectSummary) => {
      if (project.status === "DPR_READY" || project.status === "VALIDATED") {
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

  // ── Delete project ─────────────────────────────────────────────

  const handleDeleteProject = useCallback(async (projectId: string, projectName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
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
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
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
  onDeleteProject: (id: string, name: string, e?: React.MouseEvent) => void;
  onRenameProject: (id: string, newName: string) => void;
  onSelectTemplate: (template: ProjectTemplate) => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  creating: boolean;
  onCreateProject: () => void;
}

type SortKey = "updatedAt" | "createdAt" | "name" | "status";
type SortDir = "asc" | "desc";

function DashboardView({
  projects,
  loading,
  onCreateClick,
  onProjectClick,
  onDeleteProject,
  onRenameProject,
  onSelectTemplate,
  dialogOpen,
  setDialogOpen,
  newProjectName,
  setNewProjectName,
  creating,
  onCreateProject,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openTool, setOpenTool] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredProjects = projects
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === "all" || p.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
        default:
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  // View mode state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const stats = {
    total: projects.length,
    inProgress: projects.filter(
      (p) => p.status === "PARTIAL" || p.status === "DISCOVERING" || p.status === "EMPTY"
    ).length,
    completed: projects.filter(
      (p) => p.status === "VALIDATED" || p.status === "DPR_READY"
    ).length,
    dprReady: projects.filter((p) => p.status === "DPR_READY").length,
    subsidyPotential: 0,
  };

  const statCards = [
    {
      label: "Total Projects",
      value: stats.total,
      icon: Briefcase,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      filterKey: "all",
      countSuffix: "projects",
      pulse: false,
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: TrendingUp,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-900/30",
      filterKey: "PARTIAL",
      countSuffix: "active",
      pulse: stats.inProgress > 0,
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      filterKey: "VALIDATED",
      countSuffix: "done",
      pulse: false,
    },
    {
      label: "DPR Ready",
      value: stats.dprReady,
      icon: BarChart3,
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-100 dark:bg-teal-900/30",
      filterKey: "DPR_READY",
      countSuffix: "generated",
      pulse: false,
    },
    {
      label: "Subsidy Potential",
      value: stats.subsidyPotential,
      icon: IndianRupee,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      filterKey: "all",
      countSuffix: "₹ estimated",
      pulse: false,
      isCurrency: true,
    },
  ];

  const quickTools = [
    {
      id: "calculator",
      title: "Subsidy Calculator",
      description: "Estimate your PMEGP subsidy based on project cost, category, and area.",
      icon: Calculator,
      content: <SubsidyCalculator />,
    },
    {
      id: "emi",
      title: "EMI Calculator",
      description: "Calculate monthly loan EMI, interest breakdown, and amortization.",
      icon: CreditCard,
      content: <EmiCalculator />,
    },
    {
      id: "breakeven",
      title: "Break-Even Analysis",
      description: "Find your break-even point, safety margin, and profit/loss projection.",
      icon: Target,
      content: <BreakevenCalculator />,
    },
    {
      id: "nic",
      title: "NIC Code Search",
      description: "Find the right NIC code for your business activity.",
      icon: SearchCode,
      content: <NicCodeSearch />,
    },
    {
      id: "checker",
      title: "Eligibility Checker",
      description: "Check if you meet PMEGP eligibility criteria.",
      icon: ClipboardCheck,
      content: <EligibilityChecker />,
    },
    {
      id: "docs",
      title: "Document Checklist",
      description: "Track all required documents for your PMEGP application.",
      icon: FileCheck2,
      content: <DocumentChecklist />,
    },
    {
      id: "scheme",
      title: "Scheme Info",
      description: "Key facts about the PMEGP scheme — limits, rates, and more.",
      icon: BookOpen,
      content: <SchemeInfo />,
    },
    {
      id: "comparison",
      title: "Subsidy Rate Comparison",
      description: "Compare PMEGP subsidy rates across categories and areas.",
      icon: ArrowUpDown,
      content: <SubsidyComparison />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-border/60 bg-card/90 backdrop-blur-xl sticky top-0 z-30 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]">
        <div className="max-w-6xl mx-auto px-4 py-3.5 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/25 ring-1 ring-white/10">
                <IndianRupee className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  PMEGP Assistant
                </h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block leading-tight">
                  Prime Minister&apos;s Employment Generation Programme
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <NotificationTrigger />
              <span className="text-[10px] text-muted-foreground/60 hidden sm:flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/50">
                <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-background border border-border/80 rounded-md shadow-[0_1px_0_0_rgb(0_0_0/0.05)]">
                  ⌘K
                </kbd>
                <span>shortcuts</span>
              </span>
              <SettingsDialog />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 sm:px-6 sm:py-10">
        {/* ── Hero Section ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-8 sm:p-12 lg:p-16 mb-8 shadow-xl shadow-emerald-900/25"
        >
          {/* Animated gradient mesh blobs */}
          <motion.div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,0.35) 0%, transparent 70%)" }}
            animate={{ x: [0, 30, -20, 0], y: [0, -20, 15, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 70%)" }}
            animate={{ x: [0, -25, 20, 0], y: [0, 15, -25, 0], scale: [1, 0.9, 1.1, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(52,211,153,0.2) 0%, transparent 70%)" }}
            animate={{ x: [0, 15, -15, 0], y: [0, 20, -10, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Dot pattern overlay for texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Animated decorative line */}
          <motion.div
            className="absolute bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-4">
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
              >
                <Sparkles className="w-4 h-4 text-emerald-300" />
              </motion.div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 px-3 py-1 text-emerald-100 text-xs font-medium">
                AI-Powered
                <Sparkles className="w-3 h-3 text-amber-300" />
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight">
              Build Your PMEGP
              <br />
              <span className="bg-gradient-to-r from-emerald-200 to-emerald-100 bg-clip-text text-transparent">
                Project Application
              </span>
            </h2>
            <p className="text-emerald-100/80 text-sm sm:text-base max-w-xl mb-2 leading-relaxed">
              Create a complete PMEGP application with AI-guided interviews. From applicant
              details to financial projections and DPR generation — everything in one place.
            </p>
            <p className="text-emerald-200/60 text-xs sm:text-sm mb-8">
              ✨ No paperwork required
            </p>

            {/* New Project Dialog — BUG FIXED: removed forceMount and modal=false */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="h-12 px-8 text-base bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-lg shadow-black/15 hover:shadow-2xl hover:shadow-emerald-400/25 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                  onClick={onCreateClick}
                >
                  <Plus className="w-5 h-5 mr-2" />
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

            {/* Browse Templates link */}
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("project-templates-title");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-emerald-200/70 hover:text-emerald-100 text-sm transition-colors duration-200 group"
            >
              Browse Templates
              <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </motion.div>

        {/* ── Statistics Grid ─────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
          {statCards.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + idx * 0.08 }}
              onClick={() => setFilterStatus(stat.filterKey)}
              whileHover={{ y: -2 }}
              className={`group relative p-[1.5px] rounded-xl bg-gradient-to-r from-emerald-500/0 via-teal-400/0 to-emerald-500/0 hover:from-emerald-400/80 hover:via-teal-400/80 hover:to-emerald-400/80 transition-all duration-500 cursor-pointer active:scale-[0.98]`}
            >
              <div className="relative flex items-center gap-3.5 rounded-[10px] border border-border/60 bg-card p-4 sm:p-5 shadow-[0_1px_3px_0_rgb(0_0_0/0.04),0_1px_2px_-1px_rgb(0_0_0/0.04)] hover:shadow-lg hover:shadow-emerald-500/5 overflow-hidden transition-all duration-300">
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-teal-50/0 group-hover:from-emerald-50/60 group-hover:to-teal-50/30 dark:group-hover:from-emerald-950/20 dark:group-hover:to-teal-950/10 transition-all duration-300 rounded-[10px]" />
                <div className={`relative flex items-center justify-center w-12 h-12 rounded-xl ${stat.bg} ${stat.color} shrink-0 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.04]`}>
                  <stat.icon className="w-5.5 h-5.5" />
                </div>
                <div className="relative min-w-0">
                  <div className="flex items-center gap-1.5">
                    {stat.isCurrency ? (
                      <span className="text-3xl sm:text-4xl font-extrabold leading-none tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                        ₹0
                      </span>
                    ) : (
                      <AnimatedNumber
                        value={stat.value}
                        className="text-3xl sm:text-4xl font-extrabold leading-none tabular-nums tracking-tight"
                      />
                    )}
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0 mt-0.5" />
                    {stat.pulse && (
                      <motion.span
                        className="relative flex h-2.5 w-2.5 shrink-0 mt-0.5"
                        initial={{ scale: 1 }}
                        animate={{ scale: [1, 1.4, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <span className="absolute inset-0 rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
                      </motion.span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-1.5 font-medium">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground/70">{stat.countSuffix}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── How It Works Section ────────────────────────── */}
        <div className="mb-8">
          <HowItWorks />
        </div>

        {/* ── Quick-Start Templates ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <ProjectTemplates onSelectTemplate={onSelectTemplate} />
        </motion.div>

        {/* ── Project List Section ────────────────────────── */}
        <section aria-labelledby="projects-heading" className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-emerald-600" />
              <h2 id="projects-heading" className="text-lg font-semibold">
                Projects
              </h2>
              {projects.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {projects.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              {projects.length > 0 && (
                <>
                  {/* View toggle */}
                  <div className="flex items-center rounded-md border border-border/60 p-0.5 bg-muted/30">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-200 ${
                        viewMode === "grid"
                          ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-muted-foreground/60 hover:text-muted-foreground"
                      }`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center justify-center w-7 h-7 rounded-sm transition-all duration-200 ${
                        viewMode === "list"
                          ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-muted-foreground/60 hover:text-muted-foreground"
                      }`}
                      aria-label="List view"
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="relative sm:max-w-[180px] flex-1 sm:flex-none">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search projects…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => { setSortDir((d) => d === "asc" ? "desc" : "asc"); }}
                    className="flex items-center gap-1 h-8 px-2.5 rounded-md border text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
                    aria-label="Toggle sort direction"
                    title={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{sortDir === "asc" ? "↑" : "↓"}</span>
                  </button>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    className="h-8 px-2 rounded-md border text-xs bg-background text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer appearance-none pr-7"
                    aria-label="Sort by"
                  >
                    <option value="updatedAt">Last Updated</option>
                    <option value="createdAt">Created</option>
                    <option value="name">Name</option>
                    <option value="status">Status</option>
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-8 px-2 rounded-md border text-xs bg-background text-muted-foreground hover:bg-accent/50 transition-colors cursor-pointer appearance-none pr-7"
                    aria-label="Filter by status"
                  >
                    <option value="all">All Status</option>
                    <option value="EMPTY">Empty</option>
                    <option value="PARTIAL">In Progress</option>
                    <option value="DISCOVERING">Discovering</option>
                    <option value="COMPLETE">Complete</option>
                    <option value="REVIEW_PENDING">Review Pending</option>
                    <option value="VALIDATED">Validated</option>
                    <option value="DPR_READY">DPR Ready</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700 bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent p-10 sm:p-14 text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/30 flex items-center justify-center mb-4 shadow-sm">
                <Zap className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold mb-1.5">No projects yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-2">
                Create your first PMEGP application or pick a template above.
                The AI interview will guide you through every section.
              </p>
              <p className="text-xs text-muted-foreground/70 mb-5">
                Tip: Use the <strong>Quick-Start Templates</strong> to get started in seconds
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={onCreateClick}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Project
                </Button>
              </div>
            </motion.div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <Search className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-1">
                No projects match &ldquo;{searchQuery}&rdquo;
              </p>
              {filterStatus !== "all" && (
                <p className="text-xs text-muted-foreground/70">
                  Also filtering by: {STATUS_LABEL[filterStatus] ?? filterStatus}
                </p>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className={viewMode === "grid"
                  ? "space-y-2.5 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar"
                  : "max-h-[420px] overflow-y-auto pr-1 custom-scrollbar"
                }
              >
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    status={project.status}
                    createdAt={project.createdAt}
                    updatedAt={project.updatedAt}
                    onOpen={() => onProjectClick(project)}
                    onDelete={() => onDeleteProject(project.id, project.name)}
                    onRename={(newName) => onRenameProject(project.id, newName)}
                    onDuplicate={(newId) => {
                      setProjects((prev) => [
                        {
                          id: newId,
                          name: "",
                          status: "EMPTY",
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                        ...prev,
                      ]);
                      reloadProjects();
                    }}
                    formatDate={formatIndianDate}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </section>

        {/* ── Analytics + Activity ────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-2">
            <ProjectAnalytics projects={projects} />
          </div>
          <div>
            <ActivityFeed />
          </div>
        </div>

        {/* ── Quick Tools Section ─────────────────────────── */}
        <section aria-labelledby="tools-heading" className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h2 id="tools-heading" className="text-lg font-semibold">
              Quick Tools
            </h2>
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full ml-1">
              {quickTools.length} tools
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {quickTools.map((tool) => {
              const isOpen = openTool === tool.id;
              return (
                <Collapsible
                  key={tool.id}
                  open={isOpen}
                  onOpenChange={(open) => setOpenTool(open ? tool.id : null)}
                >
                  <Card
                    className={`group hover:shadow-md transition-all duration-200 cursor-pointer border border-border/50 shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] ${isOpen ? "ring-2 ring-emerald-400/30 dark:ring-emerald-600/30 shadow-emerald-500/5 border-emerald-200 dark:border-emerald-800/50" : "hover:border-emerald-200/70 dark:hover:border-emerald-800/40"}`}
                    onClick={() => setOpenTool(isOpen ? null : tool.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 shadow-sm ${isOpen ? "bg-emerald-200 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-300 shadow-emerald-500/10" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"}`}>
                              <tool.icon className="w-[18px] h-[18px]" />
                            </div>
                            <div className="text-left min-w-0">
                              <CardTitle className="text-[13px] font-semibold leading-tight">{tool.title}</CardTitle>
                              <CardDescription className="text-[11px] mt-0.5 leading-relaxed">
                                {tool.description}
                              </CardDescription>
                            </div>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground/60 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-emerald-600" : ""}`}
                          />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <Separator className="mb-4" />
                        {tool.content}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </section>

        {/* ── FAQ Section ─────────────────────────────────────── */}
        <div className="mb-10">
          <PmegpFaq />
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="mt-auto bg-gradient-to-b from-muted/30 to-muted/50">
        {/* Gradient top border */}
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
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-200 group hover:translate-x-0.5"
                  >
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
                  { label: "Subsidy", value: "15% – 35%", icon: Target },
                  { label: "Age", value: "18+ years", icon: Users },
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
                <Sparkles className="w-3 h-3" />
                Built with AI
              </span>
              <span className="text-xs text-muted-foreground">
                Next.js 16 · TypeScript
              </span>
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

// ── Status View ────────────────────────────────────────────────────────────

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
      {/* Vertical line + circle */}
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
        {/* Connecting line */}
        <div className="w-0.5 flex-1 min-h-[24px] bg-border" />
      </div>

      {/* Content */}
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

// ── Status View ─────────────────────────────────────────────────────────────

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
            {/* Success animation */}
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

            {/* Engine stage progress indicator */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.4 }}
              className="p-4 rounded-xl border bg-card overflow-x-auto"
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Engine Pipeline</p>
              <EngineStages currentStep={0} />
            </motion.div>

            {/* Project Summary with icons */}
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

            {/* Next Steps — Vertical Timeline */}
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

            {/* What You Can Do — Action Cards */}
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