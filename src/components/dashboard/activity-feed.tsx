"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Calculator,
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  MessageSquare,
  Clock,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityFeedProps {
  className?: string;
}

type ActivityColor =
  | "green"
  | "amber"
  | "rose"
  | "blue"
  | "violet";

interface ActivityItem {
  id: string;
  type: ActivityColor;
  icon: LucideIcon;
  description: string;
  timestamp: Date;
}

interface ActivityGroup {
  label: string;
  items: ActivityItem[];
}

// ---------------------------------------------------------------------------
// Color / icon mapping helpers
// ---------------------------------------------------------------------------

const colorMap: Record<ActivityColor, { bg: string; icon: string; dot: string }> = {
  green:  { bg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",  icon: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-400" },
  amber:  { bg: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",        icon: "text-amber-600 dark:text-amber-400",       dot: "bg-amber-400" },
  rose:   { bg: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",              icon: "text-rose-600 dark:text-rose-400",         dot: "bg-rose-400" },
  blue:   { bg: "bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400",              icon: "text-teal-600 dark:text-teal-400",         dot: "bg-teal-400" },
  violet: { bg: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",      icon: "text-violet-600 dark:text-violet-400",    dot: "bg-violet-400" },
};

// ---------------------------------------------------------------------------
// Mock activity data (realistic PMEGP workflow events)
// ---------------------------------------------------------------------------

function createMockActivities(): ActivityItem[] {
  const now = new Date();

  return [
    {
      id: "a1",
      type: "green",
      icon: CheckCircle2,
      description: "Applicant Details phase completed for \"Papad Making Unit\"",
      timestamp: new Date(now.getTime() - 1000 * 60 * 12), // 12 min ago
    },
    {
      id: "a2",
      type: "amber",
      icon: MessageSquare,
      description: "AI Interview started for \"Tailoring Shop\"",
      timestamp: new Date(now.getTime() - 1000 * 60 * 45), // 45 min ago
    },
    {
      id: "a3",
      type: "blue",
      icon: Calculator,
      description: "Financials ready for \"Papad Making Unit\"",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2 hours ago
    },
    {
      id: "a4",
      type: "green",
      icon: CheckCircle2,
      description: "Business Details phase completed for \"Tailoring Shop\"",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 4), // 4 hours ago
    },
    {
      id: "a5",
      type: "amber",
      icon: ClipboardCheck,
      description: "Profile reviewed for \"Papad Making Unit\"",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5), // 5 hours ago
    },
    // --- Yesterday ---
    {
      id: "a6",
      type: "violet",
      icon: ShieldCheck,
      description: "Eligibility checked for 'Handloom Unit'",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 20), // 20 hours ago
    },
    {
      id: "a7",
      type: "blue",
      icon: FileText,
      description: "DPR generated for 'Handloom Unit'",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 22), // 22 hours ago
    },
    {
      id: "a8",
      type: "green",
      icon: CheckCircle2,
      description: "NIC Code phase completed for 'Tailoring Shop'",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 26), // 26 hours ago
    },
    // --- Earlier ---
    {
      id: "a9",
      type: "green",
      icon: Plus,
      description: "New project created: 'Handloom Unit'",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 48), // 2 days ago
    },
    {
      id: "a10",
      type: "rose",
      icon: Trash2,
      description: "Project 'Agarbatti Manufacturing' deleted",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 52), // ~2 days ago
    },
    {
      id: "a11",
      type: "amber",
      icon: Pencil,
      description: "Project 'Papad Making Unit' renamed",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 72), // 3 days ago
    },
    {
      id: "a12",
      type: "green",
      icon: Plus,
      description: "New project created: \"Papad Making Unit\"",
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 96), // 4 days ago
    },
  ];
}

// ---------------------------------------------------------------------------
// Date grouping
// ---------------------------------------------------------------------------

function groupByDate(items: ActivityItem[]): ActivityGroup[] {
  const groups: Record<string, ActivityItem[]> = {};

  for (const item of items) {
    let label: string;
    if (isToday(item.timestamp)) {
      label = "Today";
    } else if (isYesterday(item.timestamp)) {
      label = "Yesterday";
    } else {
      label = format(item.timestamp, "MMM d, yyyy");
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  // Preserve order: Today → Yesterday → Earlier (chronological within each)
  const ordered: string[] = [];
  if (groups["Today"]) ordered.push("Today");
  if (groups["Yesterday"]) ordered.push("Yesterday");
  for (const key of Object.keys(groups)) {
    if (key !== "Today" && key !== "Yesterday") ordered.push(key);
  }

  return ordered.map((label) => ({
    label,
    items: groups[label],
  }));
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(timestamp: Date): string {
  const now = Date.now();
  const diff = now - timestamp.getTime();

  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  if (diff < 48 * 60 * 60 * 1000) return "Yesterday";
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }
  return format(timestamp, "MMM d");
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.35,
      ease: "easeOut" as const,
    },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed({ className }: ActivityFeedProps) {
  const activities = useMemo(() => createMockActivities(), []);
  const groups = useMemo(() => groupByDate(activities), [activities]);

  const isEmpty = activities.length === 0;

  return (
    <section
      className={`rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden ${className ?? ""}`}
      aria-labelledby="activity-feed-title"
    >
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-emerald-500/30 via-teal-400/20 to-emerald-500/30" />

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b px-5 py-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200/50 dark:ring-emerald-700/30">
          <Activity className="h-4 w-4" />
        </div>
        <h2 id="activity-feed-title" className="text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
          Activity Feed
        </h2>
      </div>

      {/* Content */}
      <div className="p-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/30">
              <Activity className="h-8 w-8 text-emerald-300 dark:text-emerald-700" />
            </div>
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-xs text-muted-foreground/60 max-w-[200px] text-center leading-relaxed">
              Activity will appear here as you work on your projects, complete interviews, and generate reports.
            </p>
          </div>
        ) : (
          <motion.div
            className="max-h-72 overflow-y-auto space-y-5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200 dark:[&::-webkit-scrollbar-thumb]:bg-emerald-800 [&::-webkit-scrollbar-track]:bg-transparent"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {groups.map((group) => (
              <div key={group.label}>
                {/* Date group header */}
                <p className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  {group.label}
                </p>

                {/* Activity items with timeline dots */}
                <div className="relative">
                  {/* Connecting line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/40" />

                  <div className="space-y-0.5">
                    {group.items.map((item, itemIdx) => {
                      const Icon = item.icon;
                      const colors = colorMap[item.type];
                      const isLast = itemIdx === group.items.length - 1;

                      return (
                        <motion.div
                          key={item.id}
                          variants={itemVariants}
                          className="relative flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                        >
                          {/* Timeline dot */}
                          <div className="relative z-10 mt-1.5 flex-shrink-0">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${colors.bg} ring-2 ring-background`}
                              aria-hidden="true"
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            {/* Dot below icon connecting to line */}
                            {!isLast && (
                              <div className={`absolute left-1/2 -translate-x-1/2 -bottom-1.5 h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                            )}
                          </div>

                          {/* Text */}
                          <div className="min-w-0 flex-1 pb-1">
                            <p className="text-sm leading-snug">
                              {item.description}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 opacity-60" />
                              {formatRelativeTime(item.timestamp)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
