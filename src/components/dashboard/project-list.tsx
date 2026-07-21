"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  Search,
  ArrowUpDown,
  LayoutGrid,
  List,
  X,
  Zap,
  Plus,
} from "lucide-react";
import { ProjectCard } from "@/components/dashboard/project-card";
import { formatIndianDate } from "@/lib/interview-api";
import type { ProjectSummary } from "@/components/dashboard/stat-cards";

// ── Constants ─────────────────────────────────────────────────────────────

/** Human-readable labels for project status codes. */
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

/** Sortable columns in the project list. */
type SortKey = "updatedAt" | "createdAt" | "name" | "status";
type SortDir = "asc" | "desc";

// ── Props ─────────────────────────────────────────────────────────────────

/** Props for the `ProjectList` component. */
export interface ProjectListProps {
  /** Full list of project summaries. */
  projects: ProjectSummary[];
  /** Whether the project list is still loading from the server. */
  loading: boolean;
  /** Called when a project card is clicked to open/interview it. */
  onProjectClick: (project: ProjectSummary) => void;
  /** Called to delete a project. */
  onDeleteProject: (id: string, name: string, e?: React.MouseEvent) => void;
  /** Called to rename a project. */
  onRenameProject: (id: string, newName: string) => void;
  /** Called after a project is duplicated (parent should reload). */
  onDuplicateProject: (newId: string, newName: string) => void;
  /** Called when the user clicks "Create New Project" in the empty state. */
  onCreateClick: () => void;
  /** Currently active status filter key (controlled by parent). */
  filterStatus: string;
  /** Called when the user changes the status filter dropdown. */
  onFilterChange: (value: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Searchable, sortable, filterable project list with grid/list view toggle.
 * Shows skeletons while loading, an empty state when no projects exist,
 * and a "no results" message when filters exclude everything.
 */
export function ProjectList({
  projects,
  loading,
  onProjectClick,
  onDeleteProject,
  onRenameProject,
  onDuplicateProject,
  onCreateClick,
  filterStatus,
  onFilterChange,
}: ProjectListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  return (
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
                onChange={(e) => onFilterChange(e.target.value)}
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
                onDuplicate={(newId: string, _newName: string) => {
                  onDuplicateProject(newId, _newName);
                }}
                formatDate={formatIndianDate}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}