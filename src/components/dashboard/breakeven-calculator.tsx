"use client";

import { useState, useMemo, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calculator,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Info,
} from "lucide-react";

function formatIndianCurrency(amount: number): string {
  const str = Math.abs(Math.round(amount)).toString();
  if (str === "0") return "₹0";
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted =
    rest.length > 0
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
  return `₹${formatted}`;
}

function formatIndianCurrencySigned(amount: number): string {
  const prefix = amount < 0 ? "-₹" : "₹";
  const str = Math.abs(Math.round(amount)).toString();
  if (str === "0") return "₹0";
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted =
    rest.length > 0
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
  return `${prefix}${formatted}`;
}

function formatNumber(num: number): string {
  if (!isFinite(num)) return "—";
  const rounded = Math.round(num);
  return rounded.toLocaleString("en-IN");
}

export function BreakevenCalculator() {
  const [fixedCosts, setFixedCosts] = useState<string>("");
  const [variableCost, setVariableCost] = useState<string>("");
  const [sellingPrice, setSellingPrice] = useState<string>("");
  const [expectedUnits, setExpectedUnits] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const result = useMemo(() => {
    const fc = parseFloat(fixedCosts.replace(/,/g, ""));
    const vc = parseFloat(variableCost.replace(/,/g, ""));
    const sp = parseFloat(sellingPrice.replace(/,/g, ""));
    const eu = parseFloat(expectedUnits.replace(/,/g, ""));

    if (isNaN(fc) || isNaN(vc) || isNaN(sp) || fc <= 0 || sp <= 0) return null;

    const contributionPerUnit = sp - vc;

    // If contribution per unit is <= 0, break-even is impossible
    if (contributionPerUnit <= 0) {
      return {
        bepUnits: Infinity,
        bepRevenue: Infinity,
        profitLoss: isNaN(eu) ? null : contributionPerUnit * eu - fc,
        marginPerUnit: contributionPerUnit,
        cmRatio: 0,
        isViable: false,
        expectedUnits: isNaN(eu) ? 0 : eu,
        fixedCosts: fc,
        variableCost: vc,
        sellingPrice: sp,
        totalCostAtBep: fc,
        revenueAtBep: Infinity,
      };
    }

    const bepUnits = fc / contributionPerUnit;
    const bepRevenue = bepUnits * sp;
    const expectedUnitsVal = isNaN(eu) || eu <= 0 ? 0 : eu;
    const profitLoss = contributionPerUnit * expectedUnitsVal - fc;
    const cmRatio = (contributionPerUnit / sp) * 100;

    // For visual bar at break-even: total cost = revenue at BEP
    const totalCostAtBep = fc + vc * bepUnits;
    const revenueAtBep = sp * bepUnits;

    return {
      bepUnits,
      bepRevenue,
      profitLoss,
      marginPerUnit: contributionPerUnit,
      cmRatio,
      isViable: true,
      expectedUnits: expectedUnitsVal,
      fixedCosts: fc,
      variableCost: vc,
      sellingPrice: sp,
      totalCostAtBep,
      revenueAtBep,
    };
  }, [fixedCosts, variableCost, sellingPrice, expectedUnits]);

  const handleInputChange = (
    setter: (val: string) => void,
    allowDecimal: boolean = false
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = allowDecimal
      ? e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1")
      : e.target.value.replace(/[^0-9]/g, "");
    startTransition(() => {
      setter(val);
    });
  };

  const handleReset = () => {
    startTransition(() => {
      setFixedCosts("");
      setVariableCost("");
      setSellingPrice("");
      setExpectedUnits("");
    });
  };

  // Visual bar: at break-even, cost = revenue. Show cost breakdown.
  const fixedPortion =
    result && result.isViable && result.revenueAtBep > 0
      ? (result.fixedCosts / result.revenueAtBep) * 100
      : 0;
  const variablePortion =
    result && result.isViable && result.revenueAtBep > 0
      ? ((result.totalCostAtBep - result.fixedCosts) / result.revenueAtBep) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* Info Callout */}
      <Alert className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20 py-2.5 px-3">
        <Info className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
          Break-even analysis helps determine the minimum sales volume needed to
          cover all costs
        </AlertDescription>
      </Alert>

      {/* Inputs */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Fixed Costs */}
        <div className="space-y-1.5">
          <Label htmlFor="fixed-costs" className="text-xs font-medium">
            Fixed Costs / month (₹)
          </Label>
          <div className="relative">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="fixed-costs"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 50000"
              value={fixedCosts}
              onChange={handleInputChange(setFixedCosts)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Variable Cost per Unit */}
        <div className="space-y-1.5">
          <Label htmlFor="variable-cost" className="text-xs font-medium">
            Variable Cost / Unit (₹)
          </Label>
          <div className="relative">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="variable-cost"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 120"
              value={variableCost}
              onChange={handleInputChange(setVariableCost, true)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Selling Price per Unit */}
        <div className="space-y-1.5">
          <Label htmlFor="selling-price" className="text-xs font-medium">
            Selling Price / Unit (₹)
          </Label>
          <div className="relative">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="selling-price"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 200"
              value={sellingPrice}
              onChange={handleInputChange(setSellingPrice, true)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Expected Monthly Units Sold */}
        <div className="space-y-1.5">
          <Label htmlFor="expected-units" className="text-xs font-medium">
            Expected Monthly Units Sold
          </Label>
          <Input
            id="expected-units"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 500"
            value={expectedUnits}
            onChange={handleInputChange(setExpectedUnits)}
          />
        </div>
      </div>

      {/* Reset */}
      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs"
        onClick={handleReset}
      >
        Reset
      </Button>

      {/* Results */}
      {result && (
        <div
          className={`rounded-lg border bg-white/50 dark:bg-white/5 p-4 space-y-4 transition-opacity duration-200 ${isPending ? "opacity-70" : "opacity-100"} ${
            !result.isViable
              ? "border-rose-200 dark:border-rose-800"
              : result.profitLoss !== null && result.profitLoss >= 0
                ? "border-emerald-200 dark:border-emerald-800"
                : "border-rose-200 dark:border-rose-800"
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <Calculator className="h-4 w-4" />
            Break-Even Analysis
          </div>

          {/* Not Viable Warning */}
          {!result.isViable && (
            <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                  Not Viable — No Break-Even Possible
                </p>
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400">
                Selling price ({formatIndianCurrency(result.sellingPrice)}) is
                less than or equal to variable cost (
                {formatIndianCurrency(result.variableCost)}). Each unit sold
                generates a negative contribution margin. Consider increasing
                prices or reducing variable costs.
              </p>
              {result.profitLoss !== null && (
                <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-800">
                  <p className="text-xs text-muted-foreground">
                    Monthly Loss at {formatNumber(result.expectedUnits)} units
                  </p>
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatIndianCurrencySigned(result.profitLoss)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Viable Results */}
          {result.isViable && (
            <>
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* BEP Units */}
                <div className="rounded-md bg-white/60 dark:bg-white/5 p-3 border border-emerald-100 dark:border-emerald-800/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-muted-foreground">
                      Break-Even (Units)
                    </p>
                  </div>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatNumber(result.bepUnits)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    units / month
                  </p>
                </div>

                {/* BEP Revenue */}
                <div className="rounded-md bg-white/60 dark:bg-white/5 p-3 border border-emerald-100 dark:border-emerald-800/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-muted-foreground">
                      Break-Even (Revenue)
                    </p>
                  </div>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatIndianCurrency(result.bepRevenue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    / month
                  </p>
                </div>

                {/* Margin per Unit */}
                <div className="rounded-md bg-white/60 dark:bg-white/5 p-3 border border-emerald-100 dark:border-emerald-800/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-muted-foreground">
                      Margin / Unit
                    </p>
                  </div>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatIndianCurrency(result.marginPerUnit)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    contribution
                  </p>
                </div>

                {/* CM Ratio */}
                <div className="rounded-md bg-white/60 dark:bg-white/5 p-3 border border-emerald-100 dark:border-emerald-800/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-muted-foreground">
                      Contribution Margin
                    </p>
                  </div>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {result.cmRatio.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    of selling price
                  </p>
                </div>
              </div>

              {/* Visual Bar: Cost Breakdown at Break-Even */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Cost Breakdown at Break-Even Point
                </p>
                <div className="h-4 rounded-full overflow-hidden bg-muted flex">
                  <div
                    className="h-full bg-rose-400 transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(fixedPortion, 100)}%`,
                    }}
                  />
                  <div
                    className="h-full bg-amber-400 transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(variablePortion, 100)}%`,
                    }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.max(0, 100 - fixedPortion - variablePortion)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-400" />
                    <span className="text-muted-foreground">
                      Fixed: {fixedPortion.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
                    <span className="text-muted-foreground">
                      Variable: {variablePortion.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-muted-foreground">
                      Profit: 0.0%
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Profit/Loss at Expected Volume */}
              {result.expectedUnits > 0 && (
                <div
                  className={`rounded-md p-3 space-y-1 border ${
                    result.profitLoss >= 0
                      ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-900/20"
                      : "border-rose-200 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-900/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {result.profitLoss >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      )}
                      <p className="text-xs font-medium text-muted-foreground">
                        Monthly {result.profitLoss >= 0 ? "Profit" : "Loss"} at{" "}
                        {formatNumber(result.expectedUnits)} units
                      </p>
                    </div>
                    <p
                      className={`text-base font-bold tabular-nums ${
                        result.profitLoss >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {formatIndianCurrencySigned(result.profitLoss)}
                    </p>
                  </div>

                  {/* Safety margin info */}
                  <p className="text-[10px] text-muted-foreground">
                    {result.expectedUnits >= result.bepUnits
                      ? `Selling ${formatNumber(result.expectedUnits - result.bepUnits)} units above break-even (${((result.expectedUnits - result.bepUnits) / result.expectedUnits * 100).toFixed(1)}% safety margin)`
                      : `Need ${formatNumber(Math.ceil(result.bepUnits) - result.expectedUnits)} more units to break even`}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}