"use client";

import { useState, lazy, Suspense, type ComponentType } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calculator,
  CreditCard,
  Target,
  SearchCode,
  ClipboardCheck,
  FileCheck2,
  BookOpen,
  ArrowUpDown,
  ChevronDown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

// ── Lazy-loaded tool panels ──────────────────────────────────────────────

const SubsidyCalculator = lazy(() =>
  import("@/components/dashboard/subsidy-calculator").then((m) => ({ default: m.SubsidyCalculator }))
);
const EmiCalculator = lazy(() =>
  import("@/components/dashboard/emi-calculator").then((m) => ({ default: m.EmiCalculator }))
);
const BreakevenCalculator = lazy(() =>
  import("@/components/dashboard/breakeven-calculator").then((m) => ({ default: m.BreakevenCalculator }))
);
const NicCodeSearch = lazy(() =>
  import("@/components/dashboard/nic-code-search").then((m) => ({ default: m.NicCodeSearch }))
);
const EligibilityChecker = lazy(() =>
  import("@/components/dashboard/eligibility-checker").then((m) => ({ default: m.EligibilityChecker }))
);
const DocumentChecklist = lazy(() =>
  import("@/components/dashboard/document-checklist").then((m) => ({ default: m.DocumentChecklist }))
);
const SchemeInfo = lazy(() =>
  import("@/components/dashboard/scheme-info").then((m) => ({ default: m.SchemeInfo }))
);
const SubsidyComparison = lazy(() =>
  import("@/components/dashboard/subsidy-comparison").then((m) => ({ default: m.SubsidyComparison }))
);

// ── Types ─────────────────────────────────────────────────────────────────

/** A lazy-loaded tool component rendered inside a collapsible card. */
interface ToolDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Lazy-loaded React component for the tool content. */
  Component: ComponentType;
}

// ── Tool definitions ─────────────────────────────────────────────────────

const TOOLS: ToolDef[] = [
  {
    id: "calculator",
    title: "Subsidy Calculator",
    description: "Estimate your PMEGP subsidy based on project cost, category, and area.",
    icon: Calculator,
    Component: SubsidyCalculator,
  },
  {
    id: "emi",
    title: "EMI Calculator",
    description: "Calculate monthly loan EMI, interest breakdown, and amortization.",
    icon: CreditCard,
    Component: EmiCalculator,
  },
  {
    id: "breakeven",
    title: "Break-Even Analysis",
    description: "Find your break-even point, safety margin, and profit/loss projection.",
    icon: Target,
    Component: BreakevenCalculator,
  },
  {
    id: "nic",
    title: "NIC Code Search",
    description: "Find the right NIC code for your business activity.",
    icon: SearchCode,
    Component: NicCodeSearch,
  },
  {
    id: "checker",
    title: "Eligibility Checker",
    description: "Check if you meet PMEGP eligibility criteria.",
    icon: ClipboardCheck,
    Component: EligibilityChecker,
  },
  {
    id: "docs",
    title: "Document Checklist",
    description: "Track all required documents for your PMEGP application.",
    icon: FileCheck2,
    Component: DocumentChecklist,
  },
  {
    id: "scheme",
    title: "Scheme Info",
    description: "Key facts about the PMEGP scheme — limits, rates, and more.",
    icon: BookOpen,
    Component: SchemeInfo,
  },
  {
    id: "comparison",
    title: "Subsidy Rate Comparison",
    description: "Compare PMEGP subsidy rates across categories and areas.",
    icon: ArrowUpDown,
    Component: SubsidyComparison,
  },
];

// ── Inline loading fallback ──────────────────────────────────────────────

function ToolSkeleton() {
  return (
    <div className="space-y-2.5 pt-1">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Grid of collapsible quick-tool cards. Each tool panel is lazy-loaded so
 * that none of the heavy calculator / checker components are bundled until
 * the user actually expands a card.
 */
export function QuickTools() {
  const [openTool, setOpenTool] = useState<string | null>(null);

  return (
    <section aria-labelledby="tools-heading" className="mb-10">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-emerald-600" />
        <h2 id="tools-heading" className="text-lg font-semibold">
          Quick Tools
        </h2>
        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full ml-1">
          {TOOLS.length} tools
        </span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {TOOLS.map((tool) => {
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
                    <Suspense fallback={<ToolSkeleton />}>
                      <tool.Component />
                    </Suspense>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </section>
  );
}