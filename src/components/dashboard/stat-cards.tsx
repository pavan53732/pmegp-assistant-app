"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, animate } from "framer-motion";
import {
  Briefcase,
  TrendingUp,
  CheckCircle2,
  BarChart3,
  IndianRupee,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

/** Lightweight summary returned from the projects list API. */
export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  totalProjectCost: number;
  createdAt: string;
  updatedAt: string;
}

/** Props for the `StatCards` component. */
export interface StatCardsProps {
  /** Full list of projects used to compute statistics. */
  projects: ProjectSummary[];
  /** Called when a stat card is clicked to filter the project list. */
  onFilterChange: (filterKey: string) => void;
}

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

// ── Stat card definition ─────────────────────────────────────────────────

interface StatCardDef {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bg: string;
  filterKey: string;
  countSuffix: string;
  pulse: boolean;
  isCurrency?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Renders a responsive grid of animated stat cards showing project counts,
 * in-progress projects, completed projects, DPR-ready count, and subsidy
 * potential. Clicking a card triggers a filter change in the parent.
 */
export function StatCards({ projects, onFilterChange }: StatCardsProps) {
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

  const statCards: StatCardDef[] = [
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
      {statCards.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 + idx * 0.08 }}
          onClick={() => onFilterChange(stat.filterKey)}
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
  );
}