"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator, IndianRupee } from "lucide-react";

const SUBSIDY_RATES: Record<string, Record<string, number>> = {
  GENERAL: { URBAN: 0.15, RURAL: 0.25 },
  SPECIAL: { URBAN: 0.25, RURAL: 0.35 },
};

const SPECIAL_CATEGORIES = [
  "SC/ST",
  "Women",
  "Ex-Serviceman",
  "Physically Handicapped",
];

export function SubsidyCalculator() {
  const [projectCost, setProjectCost] = useState<string>("");
  const [category, setCategory] = useState<string>("GENERAL");
  const [area, setArea] = useState<string>("RURAL");

  const result = useMemo(() => {
    const cost = parseFloat(projectCost.replace(/,/g, ""));
    if (isNaN(cost) || cost <= 0) return null;

    const categoryKey = SPECIAL_CATEGORIES.includes(category) ? "SPECIAL" : "GENERAL";
    const rate = SUBSIDY_RATES[categoryKey]?.[area] ?? 0;
    const subsidy = Math.round(cost * rate);
    const borrowerContribution = cost - subsidy;
    const maxSubsidy = 2500000; // 25 lakh max project cost
    const effectiveSubsidy = Math.min(subsidy, maxSubsidy * rate);
    const isOverMax = cost > maxSubsidy;

    return {
      rate,
      subsidy: isOverMax ? effectiveSubsidy : subsidy,
      borrowerContribution: isOverMax ? cost - effectiveSubsidy : borrowerContribution,
      isOverMax,
      maxProjectCost: maxSubsidy,
    };
  }, [projectCost, category, area]);

  const formatCurrency = (amount: number) => {
    const str = Math.abs(amount).toString();
    const digits = str.padStart(3, "0");
    const lastThree = digits.slice(-3);
    const rest = digits.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
    return `₹${formatted}`;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="project-cost" className="text-xs font-medium">
            Project Cost (₹)
          </Label>
          <div className="relative">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="project-cost"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1000000"
              value={projectCost}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                setProjectCost(val);
              }}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERAL">General</SelectItem>
              <SelectItem value="SC/ST">SC / ST</SelectItem>
              <SelectItem value="Women">Women</SelectItem>
              <SelectItem value="Ex-Serviceman">Ex-Serviceman</SelectItem>
              <SelectItem value="Physically Handicapped">Physically Handicapped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Area</Label>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="URBAN">Urban</SelectItem>
              <SelectItem value="RURAL">Rural</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={() => {
              setProjectCost("");
              setCategory("GENERAL");
              setArea("RURAL");
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <Calculator className="h-4 w-4" />
            Subsidy Calculation
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Subsidy Rate</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400">
                {(result.rate * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estimated Subsidy</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">
                {formatCurrency(result.subsidy)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your Contribution</p>
              <p className="font-medium">{formatCurrency(result.borrowerContribution)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Project Cost</p>
              <p className="font-medium">
                {formatCurrency(parseFloat(projectCost.replace(/,/g, "")))}
              </p>
            </div>
          </div>

          {result.isOverMax && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
              ⚠️ Project cost exceeds the PMEGP maximum of {formatCurrency(result.maxProjectCost)}. 
              Subsidy is capped at the maximum eligible amount.
            </p>
          )}
        </div>
      )}
    </div>
  );
}