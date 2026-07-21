"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { searchNicCodes } from "@/knowledge-package";
import type { NicCodeEntry } from "@/knowledge-package";

const MAX_RESULTS = 10;
const DEBOUNCE_MS = 300;

function searchWithNicCode(query: string): NicCodeEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const descriptionResults = searchNicCodes(query);
  const seen = new Set(descriptionResults.map((r) => r.nicCode));

  // The built-in search only matches description; also include nicCode matches
  const allResults = q.length >= 2 ? searchNicCodes("") : descriptionResults;
  const nicCodeMatches = allResults.filter(
    (entry) => !seen.has(entry.nicCode) && entry.nicCode.includes(q)
  );

  return [...descriptionResults, ...nicCodeMatches].slice(0, MAX_RESULTS);
}

export function NicCodeSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NicCodeEntry[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitial = query === "";

  // Debounced search — all state updates happen inside the timeout callback
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const delay = query.trim() ? DEBOUNCE_MS : 0;
    timerRef.current = setTimeout(() => {
      setResults(searchWithNicCode(query));
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const handleCopy = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`NIC code ${code} copied to clipboard`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, []);

  const getSectorLabel = (sector: string) => {
    switch (sector) {
      case "MANUFACTURING":
        return "Manufacturing";
      case "SERVICE":
        return "Services";
      default:
        return sector;
    }
  };

  const getSubCategoryLabel = (sub: string) => {
    switch (sub) {
      case "MANUFACTURING":
        return "Manufacturing";
      case "SERVICE":
        return "Service";
      case "TRADING":
        return "Trading";
      case "TRANSPORT":
        return "Transport";
      default:
        return sub;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-emerald-600" />
        <Label
          htmlFor="nic-search"
          className="text-sm font-medium text-foreground"
        >
          NIC Code Search
        </Label>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id="nic-search"
          type="text"
          placeholder="Search by activity name, NIC code, or keyword"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 pr-3 border-emerald-200 focus-visible:ring-emerald-400 focus-visible:border-emerald-400"
        />
      </div>

      {isInitial && (
        <p className="text-xs text-muted-foreground px-1">
          Search by activity name, NIC code, or keyword
        </p>
      )}

      {!isInitial && results.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No results found
        </p>
      )}

      {!isInitial && results.length > 0 && (
        <ScrollArea className="max-h-64 overflow-y-auto rounded-md border border-emerald-100">
          <div className="p-1">
            <AnimatePresence initial={false}>
              {results.map((entry) => {
                const isCopied = copiedCode === entry.nicCode;
                const isManufacturing =
                  entry.sector === "MANUFACTURING";

                return (
                  <motion.button
                    key={entry.nicCode}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => handleCopy(entry.nicCode)}
                    className="w-full text-left rounded-md px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer group flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground tabular-nums">
                          {entry.nicCode}
                        </span>
                        <Badge
                          className={
                            isManufacturing
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
                              : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                          }
                        >
                          {getSectorLabel(entry.sector)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getSubCategoryLabel(entry.subCategory)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {entry.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0 mt-0.5">
                      {isCopied ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}