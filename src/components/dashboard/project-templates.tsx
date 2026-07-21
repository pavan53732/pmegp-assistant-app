"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectTemplate {
  id: string;
  name: string;
  emoji: string;
  sector: "Manufacturing" | "Service";
  nicCode: string;
  area: "Rural" | "Urban";
  category: "General" | "Women" | "SC/ST";
  projectCost: number;
  projectCostLabel: string;
}

// ---------------------------------------------------------------------------
// Template data
// ---------------------------------------------------------------------------

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "papad-making",
    name: "Papad Making Unit",
    emoji: "\u{1FAD5}",
    sector: "Manufacturing",
    nicCode: "10709",
    area: "Rural",
    category: "General",
    projectCost: 500000,
    projectCostLabel: "\u20B95,00,000",
  },
  {
    id: "tailoring-shop",
    name: "Tailoring Shop",
    emoji: "\uD83D\uDC57",
    sector: "Service",
    nicCode: "14101",
    area: "Urban",
    category: "Women",
    projectCost: 300000,
    projectCostLabel: "\u20B93,00,000",
  },
  {
    id: "agarbatti-manufacturing",
    name: "Agarbatti Manufacturing",
    emoji: "\uD83E\uDEE6",
    sector: "Manufacturing",
    nicCode: "20299",
    area: "Rural",
    category: "SC/ST",
    projectCost: 800000,
    projectCostLabel: "\u20B98,00,000",
  },
  {
    id: "small-bakery",
    name: "Small Bakery",
    emoji: "\uD83C\uDF5E",
    sector: "Manufacturing",
    nicCode: "10701",
    area: "Urban",
    category: "General",
    projectCost: 1000000,
    projectCostLabel: "\u20B910,00,000",
  },
  {
    id: "bindi-making",
    name: "Bindi Making Unit",
    emoji: "\uD83D\uDCA1",
    sector: "Manufacturing",
    nicCode: "20299",
    area: "Rural",
    category: "Women",
    projectCost: 400000,
    projectCostLabel: "\u20B94,00,000",
  },
  {
    id: "candle-making",
    name: "Candle Making",
    emoji: "\uD83D\uDD6F\uFE0F",
    sector: "Manufacturing",
    nicCode: "20299",
    area: "Urban",
    category: "General",
    projectCost: 350000,
    projectCostLabel: "\u20B93,50,000",
  },
  {
    id: "photocopy-dtp",
    name: "Photocopy & DTP Center",
    emoji: "\uD83D\uDDA8\uFE0F",
    sector: "Service",
    nicCode: "18109",
    area: "Urban",
    category: "General",
    projectCost: 500000,
    projectCostLabel: "\u20B95,00,000",
  },
  {
    id: "vermicompost",
    name: "Vermicompost Unit",
    emoji: "\uD83C\uDF31",
    sector: "Manufacturing",
    nicCode: "01430",
    area: "Rural",
    category: "General",
    projectCost: 600000,
    projectCostLabel: "\u20B96,00,000",
  },
];

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const sectorBadgeClass: Record<string, string> = {
  Manufacturing:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
  Service:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800",
};

const areaBadgeClass: Record<string, string> = {
  Rural: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 border-teal-200 dark:border-teal-800",
  Urban: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/30 border-slate-200 dark:border-slate-800",
};

const categoryBadgeClass: Record<string, string> = {
  General: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800",
  Women: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/30 border-pink-200 dark:border-pink-800",
  "SC/ST": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 border-orange-200 dark:border-orange-800",
};

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectTemplates({
  onSelectTemplate,
}: {
  onSelectTemplate: (template: ProjectTemplate) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  return (
    <section
      className="rounded-xl border border-t-2 border-t-emerald-500 bg-card p-6"
      aria-labelledby="project-templates-title"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          <h2
            id="project-templates-title"
            className="text-lg font-semibold"
          >
            Quick-Start Templates
          </h2>
        </div>

        {/* Scroll arrows (hidden when not needed) */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            aria-label="Scroll templates left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            aria-label="Scroll templates right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mb-5 text-sm text-muted-foreground">
        Get started quickly with pre-configured templates for popular PMEGP
        business types.
      </p>

      {/* Scrollable container */}
      <div className="relative">
        {/* Left gradient fade */}
        {canScrollLeft && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-card to-transparent" />
        )}

        <motion.div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {PROJECT_TEMPLATES.map((template) => (
            <motion.div
              key={template.id}
              variants={cardVariants}
              className="w-[220px] shrink-0 snap-start"
              whileHover={{ scale: 1.03, y: -4 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Card className="h-full gap-0 py-0 overflow-hidden transition-shadow duration-200 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-300 dark:hover:border-emerald-700">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  {/* Emoji + Name */}
                  <div className="flex items-start gap-2.5">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-xl"
                      aria-hidden="true"
                    >
                      {template.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">
                        {template.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        NIC {template.nicCode}
                      </p>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${sectorBadgeClass[template.sector]}`}
                    >
                      {template.sector}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${areaBadgeClass[template.area]}`}
                    >
                      {template.area}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${categoryBadgeClass[template.category]}`}
                    >
                      {template.category}
                    </Badge>
                  </div>

                  {/* Cost */}
                  <div className="mt-auto pt-1">
                    <p className="text-[11px] text-muted-foreground">
                      Est. Project Cost
                    </p>
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                      {template.projectCostLabel}
                    </p>
                  </div>

                  {/* Use Template button */}
                  <Button
                    size="sm"
                    className="mt-1 w-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTemplate(template);
                    }}
                  >
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Right gradient fade */}
        {canScrollRight && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-card to-transparent" />
        )}
      </div>
    </section>
  );
}