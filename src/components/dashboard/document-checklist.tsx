"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  FileCheck2,
  FileText,
  GraduationCap,
  Building2,
  Banknote,
  MoreHorizontal,
  CheckCheck,
  XCircle,
} from "lucide-react";

interface DocItem {
  id: string;
  label: string;
}

interface DocCategory {
  id: string;
  title: string;
  icon: React.ElementType;
  items: DocItem[];
}

const STORAGE_KEY = "pmegp-doc-checklist";

const categories: DocCategory[] = [
  {
    id: "identity",
    title: "Identity & Category Proof",
    icon: FileText,
    items: [
      { id: "aadhaar", label: "Aadhaar Card" },
      { id: "pan", label: "PAN Card" },
      {
        id: "category-cert",
        label: "Category Certificate (SC/ST/OBC/Minority) — if applicable",
      },
      {
        id: "ex-serviceman",
        label: "Ex-Serviceman Certificate — if applicable",
      },
      { id: "disability", label: "Disability Certificate — if applicable" },
    ],
  },
  {
    id: "education",
    title: "Education & Experience",
    icon: GraduationCap,
    items: [
      { id: "edu-qualification", label: "Educational Qualification Certificate" },
      { id: "training", label: "Training Certificate (if any)" },
      { id: "experience", label: "Experience Certificate (if any)" },
    ],
  },
  {
    id: "business",
    title: "Business & Land",
    icon: Building2,
    items: [
      { id: "business-plan", label: "Business Plan / Project Report" },
      { id: "land-ownership", label: "Land Ownership / Lease Agreement" },
      { id: "landlord-noc", label: "NOC from Landlord (if rented)" },
      { id: "site-plan", label: "Site Plan / Layout Plan" },
      { id: "location-photos", label: "Photographs of Business Location" },
    ],
  },
  {
    id: "financial",
    title: "Financial",
    icon: Banknote,
    items: [
      {
        id: "bank-statement",
        label: "Bank Account Statement (last 6 months)",
      },
      {
        id: "machinery-quotes",
        label: "Quotations for Machinery & Equipment",
      },
      { id: "raw-material-quotes", label: "Quotations for Raw Materials" },
      { id: "self-contribution", label: "Self Contribution Proof" },
    ],
  },
  {
    id: "other",
    title: "Other",
    icon: MoreHorizontal,
    items: [
      { id: "gdp-reg", label: "GDP Registration (if applicable)" },
      { id: "udyam-reg", label: "Udyam Registration" },
      { id: "municipal-noc", label: "Municipal/Nagar Palika NOC" },
      { id: "pollution-noc", label: "Pollution Control NOC (if applicable)" },
    ],
  },
];

const allItemIds = categories.flatMap((c) => c.items.map((i) => i.id));

// ---- External store for localStorage-backed checked state ----

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    const filtered: Record<string, boolean> = {};
    for (const id of allItemIds) {
      if (parsed[id]) filtered[id] = true;
    }
    return filtered;
  } catch {
    return {};
  }
}

function getServerSnapshot(): Record<string, boolean> {
  return {};
}

function writeToStore(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore write errors
  }
  emitChange();
}

// ---- Component ----

export function DocumentChecklist() {
  const checked = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {
      identity: true,
      education: false,
      business: false,
      financial: false,
      other: false,
    }
  );

  const totalItems = allItemIds.length;
  const checkedCount = allItemIds.filter((id) => checked[id]).length;
  const progressPercent =
    totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  const toggleItem = useCallback((id: string) => {
    const current = getSnapshot();
    writeToStore({ ...current, [id]: !current[id] });
  }, []);

  const toggleCategory = useCallback(
    (categoryId: string, value: boolean) => {
      setOpenCategories((prev) => ({ ...prev, [categoryId]: value }));
    },
    []
  );

  const checkAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const id of allItemIds) next[id] = true;
    writeToStore(next);
  }, []);

  const clearAll = useCallback(() => {
    writeToStore({});
  }, []);

  const getCategoryCheckedCount = (category: DocCategory) =>
    category.items.filter((i) => checked[i.id]).length;

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium">
              {checkedCount} of {totalItems} documents checked
            </span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <Progress
          value={progressPercent}
          className="h-2 [&>[data-slot=progress-indicator]]:bg-emerald-600 dark:[&>[data-slot=progress-indicator]]:bg-emerald-500"
        />
        {progressPercent === 100 && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            All documents collected! You&apos;re ready to apply.
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          onClick={checkAll}
        >
          <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
          Check All
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-8"
          onClick={clearAll}
        >
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Clear All
        </Button>
      </div>

      {/* Category sections */}
      <div className="space-y-2">
        {categories.map((category) => {
          const catChecked = getCategoryCheckedCount(category);
          const catTotal = category.items.length;
          const allCatChecked = catChecked === catTotal;
          const IconComp = category.icon;
          const isOpen = openCategories[category.id] ?? false;

          return (
            <Collapsible
              key={category.id}
              open={isOpen}
              onOpenChange={(value) => toggleCategory(category.id, value)}
            >
              <CollapsibleTrigger className="w-full flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left text-sm hover:bg-accent/50 transition-colors group">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    allCatChecked
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <IconComp className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs leading-tight">
                    {category.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {catChecked}/{catTotal} completed
                  </p>
                </div>
                {allCatChecked && (
                  <span className="shrink-0 text-emerald-600 dark:text-emerald-400">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="mt-1 ml-1 space-y-1 border-l-2 border-emerald-200 dark:border-emerald-800/60 pl-4 py-2">
                  {category.items.map((item) => (
                    <label
                      key={item.id}
                      htmlFor={`doc-${item.id}`}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        id={`doc-${item.id}`}
                        checked={checked[item.id] ?? false}
                        onCheckedChange={() => toggleItem(item.id)}
                        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 dark:data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:border-emerald-500"
                      />
                      <span
                        className={`text-xs leading-snug ${
                          checked[item.id]
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}