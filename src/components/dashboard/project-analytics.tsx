"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { BarChart3, PieChartIcon, CalendarDays, TrendingUp } from "lucide-react";
import { startOfWeek, addDays } from "date-fns";

import {
  Card,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectAnalyticsProps {
  projects: Array<{
    id: string;
    name: string;
    status: string;
    totalProjectCost: number;
    createdAt: string;
  }>;
  className?: string;
}

// ── Status color mapping (emerald/teal/amber palette) ───────────────────────

const STATUS_COLORS: Record<string, string> = {
  EMPTY: "#94a3b8",
  PARTIAL: "#f59e0b",
  DISCOVERING: "#14b8a6",
  COMPLETE: "#10b981",
  REVIEW_PENDING: "#f59e0b",
  VALIDATED: "#059669",
  DPR_READY: "#047857",
  ELIGIBILITY_READY: "#10b981",
  FINANCIAL_READY: "#059669",
};

const STATUS_LABEL: Record<string, string> = {
  EMPTY: "Empty",
  PARTIAL: "In Progress",
  DISCOVERING: "Discovering",
  COMPLETE: "Complete",
  REVIEW_PENDING: "Review Pending",
  VALIDATED: "Validated",
  ELIGIBILITY_READY: "Eligibility Ready",
  FINANCIAL_READY: "Financials Ready",
  DPR_READY: "DPR Ready",
};

// ── Animation variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ── Component ──────────────────────────────────────────────────────────────

export function ProjectAnalytics({ projects, className }: ProjectAnalyticsProps) {
  // ── Status distribution data ──────────────────────────────────────────
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([status, count]) => ({
        name: STATUS_LABEL[status] ?? status,
        value: count,
        fill: STATUS_COLORS[status] ?? "#94a3b8",
        statusKey: status,
      }))
      .sort((a, b) => b.value - a.value);
  }, [projects]);

  const totalProjects = projects.length;

  // ── Pie chart config for shadcn ───────────────────────────────────────
  const pieChartConfig: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const item of statusData) {
      cfg[item.statusKey] = {
        label: item.name,
        color: item.fill,
      };
    }
    return cfg;
  }, [statusData]);

  // ── Weekly activity data (mock) ──────────────────────────────────────
  const weeklyData = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    // Count projects created per day this week
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const p of projects) {
      const created = new Date(p.createdAt);
      for (let i = 0; i < 7; i++) {
        const day = addDays(weekStart, i);
        if (
          created.getFullYear() === day.getFullYear() &&
          created.getMonth() === day.getMonth() &&
          created.getDate() === day.getDate()
        ) {
          dayCounts[i]++;
          break;
        }
      }
    }

    return dayNames.map((day, idx) => ({
      name: day,
      projects: dayCounts[idx],
    }));
  }, [projects]);

  // ── Cost distribution data ────────────────────────────────────────────
  const costData = useMemo(() => {
    const ranges = [
      { label: "Under ₹5L", min: 0, max: 500000, color: "#6ee7b7" },
      { label: "₹5L – ₹10L", min: 500000, max: 1000000, color: "#34d399" },
      { label: "₹10L – ₹15L", min: 1000000, max: 1500000, color: "#10b981" },
      { label: "₹15L – ₹25L", min: 1500000, max: 25000000, color: "#059669" },
    ];

    const costsWithValues = projects
      .map((p) => p.totalProjectCost)
      .filter((c) => c > 0);

    return ranges.map((r) => {
      const count = costsWithValues.filter(
        (c) => c >= r.min && c < r.max
      ).length;
      const total = costsWithValues.length || 1;
      const percentage = Math.round((count / total) * 100);
      return { ...r, count, percentage };
    });
  }, [projects]);

  const maxCostCount = Math.max(...costData.map((d) => d.count), 1);

  // ── Bar chart config ──────────────────────────────────────────────────
  const barChartConfig: ChartConfig = {
    projects: {
      label: "Projects Created",
      color: "#10b981",
    },
  };

  // ── Empty state ───────────────────────────────────────────────────────

  if (totalProjects === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={className}
      >
        <Card className="rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm p-5">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              Project Analytics
            </h3>
          </div>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-800/30">
              <BarChart3 className="w-8 h-8 text-emerald-300 dark:text-emerald-700" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              No data yet
            </p>
            <p className="text-xs text-muted-foreground/70 max-w-[200px]">
              Create your first project to see analytics and charts here.
            </p>
          </div>
        </Card>
      </motion.div>
    );
  }

  // ── Render with data ──────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      <Card className="rounded-xl border bg-card/50 backdrop-blur-sm shadow-sm p-5">
        {/* Section heading with gradient text */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200/50 dark:ring-emerald-700/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <h3 className="text-base font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
            Project Analytics
          </h3>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* ── Status Distribution (Donut) ─────────────────────────── */}
          <motion.div variants={itemVariants} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
                <PieChartIcon className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-sm font-medium text-muted-foreground">
                Status Distribution
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <ChartContainer config={pieChartConfig} className="h-[200px] w-[200px] mx-auto">
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="statusKey"
                    innerRadius={55}
                    outerRadius={85}
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend
                    content={<ChartLegendContent nameKey="statusKey" />}
                  />
                </PieChart>
              </ChartContainer>
            </div>
            {/* Center label for total */}
            <div className="flex justify-center -mt-[140px] mb-[80px] pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums leading-none">
                  {totalProjects}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Projects
                </p>
              </div>
            </div>
            {/* Legend below */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-2">
              {statusData.map((item) => (
                <div
                  key={item.statusKey}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <span
                    className="h-2 w-2 rounded-sm shrink-0"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Weekly Activity (Bar Chart) ──────────────────────────── */}
          <motion.div variants={itemVariants} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-sm font-medium text-muted-foreground">
                Weekly Activity
              </h4>
            </div>
            <ChartContainer config={barChartConfig} className="h-[200px] w-full">
              <BarChart
                data={weeklyData}
                margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/50"
                />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <ChartTooltip
                  cursor={{ fill: "hsl(var(--muted))", radius: 4 }}
                  content={<ChartTooltipContent />}
                />
                <Bar
                  dataKey="projects"
                  fill="var(--color-projects)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ChartContainer>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Projects created per day this week
            </p>
          </motion.div>

          {/* ── Cost Distribution (Full Width) ───────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-2 space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-sm font-medium text-muted-foreground">
                Project Cost Distribution
              </h4>
            </div>
            <div className="space-y-3">
              {costData.map((range) => (
                <div key={range.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground/80">
                      {range.label}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {range.count} project{range.count !== 1 ? "s" : ""}
                      {projects.some((p) => p.totalProjectCost > 0) && (
                        <span className="ml-1.5 text-muted-foreground/60">
                          ({range.percentage}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: range.color }}
                      initial={{ width: 0 }}
                      animate={{
                        width:
                          range.count > 0
                            ? `${Math.max((range.count / maxCostCount) * 100, 8)}%`
                            : "0%",
                      }}
                      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {projects.every((p) => p.totalProjectCost <= 0) && (
              <p className="text-xs text-muted-foreground/60 text-center mt-1">
                No project costs recorded yet. Complete project profiles to see
                cost distribution.
              </p>
            )}
          </motion.div>
        </motion.div>
      </Card>
    </motion.div>
  );
}
