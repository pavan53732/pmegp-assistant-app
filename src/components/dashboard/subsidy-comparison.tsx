"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IndianRupee, Info } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface SubsidyCell {
  rate: number;
  maxAmount: number;
}

interface CategoryRow {
  category: string;
  isSpecial: boolean;
  rural: SubsidyCell;
  urban: SubsidyCell;
}

// ── Data ───────────────────────────────────────────────────────────────────

const MAX_PROJECT_COST = 2500000;

const RATE_DATA: CategoryRow[] = [
  {
    category: "General",
    isSpecial: false,
    rural: { rate: 25, maxAmount: 1250000 },
    urban: { rate: 15, maxAmount: 1000000 },
  },
  {
    category: "Women",
    isSpecial: true,
    rural: { rate: 35, maxAmount: 1500000 },
    urban: { rate: 25, maxAmount: 1250000 },
  },
  {
    category: "SC/ST",
    isSpecial: true,
    rural: { rate: 35, maxAmount: 1500000 },
    urban: { rate: 25, maxAmount: 1250000 },
  },
  {
    category: "OBC",
    isSpecial: true,
    rural: { rate: 35, maxAmount: 1500000 },
    urban: { rate: 25, maxAmount: 1250000 },
  },
  {
    category: "Minority",
    isSpecial: true,
    rural: { rate: 35, maxAmount: 1500000 },
    urban: { rate: 25, maxAmount: 1250000 },
  },
  {
    category: "Ex-Serviceman",
    isSpecial: true,
    rural: { rate: 35, maxAmount: 1500000 },
    urban: { rate: 25, maxAmount: 1250000 },
  },
  {
    category: "Physically Handicapped",
    isSpecial: true,
    rural: { rate: 35, maxAmount: 1500000 },
    urban: { rate: 25, maxAmount: 1250000 },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatIndianCurrency(amount: number): string {
  const str = Math.abs(amount).toString();
  const digits = str.padStart(3, "0");
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const formatted =
    rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `₹${formatted}`;
}

function getRateColor(rate: number, isHighlighted: boolean): string {
  if (rate === 35) {
    return isHighlighted
      ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white"
      : "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100";
  }
  if (rate === 25) {
    return isHighlighted
      ? "bg-emerald-500 text-white dark:bg-emerald-600 dark:text-white"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  return isHighlighted
    ? "bg-emerald-400 text-white dark:bg-emerald-500 dark:text-white"
    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300";
}

type CategoryFilter = "all" | "general" | "special";

// ── Component ──────────────────────────────────────────────────────────────

export function SubsidyComparison() {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [hoveredCell, setHoveredCell] = useState<{
    category: string;
    area: string;
  } | null>(null);

  const filteredData = useMemo(() => {
    if (filter === "general") return RATE_DATA.filter((r) => !r.isSpecial);
    if (filter === "special") return RATE_DATA.filter((r) => r.isSpecial);
    return RATE_DATA;
  }, [filter]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as CategoryFilter)}
          >
            <TabsList className="h-7 text-[11px]">
              <TabsTrigger value="all" className="px-2.5 text-[11px]">
                All Categories
              </TabsTrigger>
              <TabsTrigger value="general" className="px-2.5 text-[11px]">
                General
              </TabsTrigger>
              <TabsTrigger value="special" className="px-2.5 text-[11px]">
                Special
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Table */}
        <ScrollArea className="w-full">
          <div className="min-w-[400px] snap-x">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold w-[140px] bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tl-lg">
                    Category
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                    Rural
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-lg">
                    Urban
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filteredData.map((row, idx) => {
                    const isRowHighlighted =
                      hoveredCell?.category === row.category;
                    return (
                      <motion.tr
                        key={row.category}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, delay: idx * 0.03 }}
                        className="border-b border-border/40 hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-medium text-[12px] py-2.5 pl-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                                row.isSpecial
                                  ? "bg-emerald-500"
                                  : "bg-emerald-300 dark:bg-emerald-700"
                              }`}
                            />
                            <span className="truncate">{row.category}</span>
                            {row.isSpecial && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1.5 py-0 h-4 shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              >
                                Special
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {/* Rural cell */}
                        <TableCell className="text-center py-2.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                onMouseEnter={() =>
                                  setHoveredCell({
                                    category: row.category,
                                    area: "rural",
                                  })
                                }
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`
                                  inline-flex flex-col items-center justify-center
                                  min-w-[90px] px-3 py-2 rounded-lg cursor-default
                                  transition-all duration-150
                                  ${getRateColor(
                                    row.rural.rate,
                                    isRowHighlighted && hoveredCell?.area === "rural"
                                  )}
                                `}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <span className="text-sm font-bold leading-none">
                                  {row.rural.rate}%
                                </span>
                                {isRowHighlighted &&
                                  hoveredCell?.area === "rural" && (
                                    <motion.span
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      className="text-[9px] mt-1 font-medium opacity-80"
                                    >
                                      Max {formatIndianCurrency(row.rural.maxAmount)}
                                    </motion.span>
                                  )}
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="text-[11px] bg-popover border-border"
                            >
                              <div className="text-center space-y-1">
                                <p className="font-semibold">
                                  {row.category} — Rural
                                </p>
                                <p>
                                  Rate:{" "}
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {row.rural.rate}%
                                  </span>
                                </p>
                                <p>
                                  Max Subsidy:{" "}
                                  <span className="font-semibold">
                                    {formatIndianCurrency(row.rural.maxAmount)}
                                  </span>
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        {/* Urban cell */}
                        <TableCell className="text-center py-2.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.div
                                onMouseEnter={() =>
                                  setHoveredCell({
                                    category: row.category,
                                    area: "urban",
                                  })
                                }
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`
                                  inline-flex flex-col items-center justify-center
                                  min-w-[90px] px-3 py-2 rounded-lg cursor-default
                                  transition-all duration-150
                                  ${getRateColor(
                                    row.urban.rate,
                                    isRowHighlighted && hoveredCell?.area === "urban"
                                  )}
                                `}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <span className="text-sm font-bold leading-none">
                                  {row.urban.rate}%
                                </span>
                                {isRowHighlighted &&
                                  hoveredCell?.area === "urban" && (
                                    <motion.span
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      className="text-[9px] mt-1 font-medium opacity-80"
                                    >
                                      Max {formatIndianCurrency(row.urban.maxAmount)}
                                    </motion.span>
                                  )}
                              </motion.div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="text-[11px] bg-popover border-border"
                            >
                              <div className="text-center space-y-1">
                                <p className="font-semibold">
                                  {row.category} — Urban
                                </p>
                                <p>
                                  Rate:{" "}
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {row.urban.rate}%
                                  </span>
                                </p>
                                <p>
                                  Max Subsidy:{" "}
                                  <span className="font-semibold">
                                    {formatIndianCurrency(row.urban.maxAmount)}
                                  </span>
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {/* Max project cost row */}
                <TableRow className="border-t-2 border-emerald-300 dark:border-emerald-700 hover:bg-transparent bg-muted/30">
                  <TableCell className="font-semibold text-[11px] py-2.5 pl-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span>Max Project Cost</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center py-2.5">
                    <span className="text-xs font-bold text-muted-foreground">
                      {formatIndianCurrency(MAX_PROJECT_COST)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center py-2.5">
                    <span className="text-xs font-bold text-muted-foreground">
                      {formatIndianCurrency(MAX_PROJECT_COST)}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        {/* Legend */}
        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-50 dark:bg-emerald-900/25 border border-border/50" />
            15%
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-border/50" />
            25%
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-900/60 border border-border/50" />
            35%
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>Hover for details</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}