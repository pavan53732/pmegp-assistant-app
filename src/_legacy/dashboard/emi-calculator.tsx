"use client";

import { useState, useMemo, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calculator,
  IndianRupee,
  Percent,
  CalendarDays,
  TrendingUp,
  Banknote,
  Info,
} from "lucide-react";

const TENURE_PRESETS = [
  { label: "3 Years", value: "3" },
  { label: "5 Years", value: "5" },
  { label: "7 Years", value: "7" },
  { label: "10 Years", value: "10" },
];

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

function calculateEMI(principal: number, annualRate: number, tenureYears: number) {
  const r = annualRate / 12 / 100;
  const n = tenureYears * 12;

  if (r === 0) {
    const emi = principal / n;
    return { emi, totalPayment: principal, totalInterest: 0 };
  }

  const factor = Math.pow(1 + r, n);
  const emi = (principal * r * factor) / (factor - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;

  return {
    emi: Math.round(emi),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalInterest),
  };
}

function calculateYear1Breakdown(
  principal: number,
  annualRate: number,
  tenureYears: number,
  emi: number
) {
  const r = annualRate / 12 / 100;
  const n = tenureYears * 12;
  let balance = principal;
  let year1Interest = 0;
  let year1Principal = 0;

  for (let month = 1; month <= Math.min(12, n); month++) {
    const interestPart = balance * r;
    const principalPart = emi - interestPart;
    year1Interest += interestPart;
    year1Principal += principalPart;
    balance -= principalPart;
  }

  return {
    interest: Math.round(year1Interest),
    principal: Math.round(year1Principal),
    remainingBalance: Math.max(0, Math.round(balance)),
  };
}

export function EmiCalculator() {
  const [loanAmount, setLoanAmount] = useState<string>("");
  const [interestRate, setInterestRate] = useState<number>(12);
  const [tenure, setTenure] = useState<string>("7");
  const [isPending, startTransition] = useTransition();

  const result = useMemo(() => {
    const principal = parseFloat(loanAmount.replace(/,/g, ""));
    if (isNaN(principal) || principal <= 0) return null;

    const tenureYears = parseInt(tenure, 10);
    if (isNaN(tenureYears) || tenureYears <= 0) return null;

    const emiResult = calculateEMI(principal, interestRate, tenureYears);
    const year1Breakdown = calculateYear1Breakdown(
      principal,
      interestRate,
      tenureYears,
      emiResult.emi
    );

    const principalPercent =
      emiResult.totalPayment > 0
        ? (principal / emiResult.totalPayment) * 100
        : 100;

    return {
      ...emiResult,
      principalPercent,
      year1Breakdown,
      tenureYears,
    };
  }, [loanAmount, interestRate, tenure]);

  const handleTenureChange = (value: string) => {
    startTransition(() => {
      setTenure(value);
    });
  };

  const handleRateChange = (value: number[]) => {
    startTransition(() => {
      setInterestRate(value[0]);
    });
  };

  const handleLoanAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    startTransition(() => {
      setLoanAmount(val);
    });
  };

  const handleReset = () => {
    startTransition(() => {
      setLoanAmount("");
      setInterestRate(12);
      setTenure("7");
    });
  };

  return (
    <div className="space-y-4">
      {/* Info Callout */}
      <Alert className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20 py-2.5 px-3">
        <Info className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
          PMEGP loans are typically at bank&apos;s standard MSME lending rates
        </AlertDescription>
      </Alert>

      {/* Inputs */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Loan Amount */}
        <div className="space-y-1.5">
          <Label htmlFor="loan-amount" className="text-xs font-medium">
            Loan Amount (₹)
          </Label>
          <div className="relative">
            <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="loan-amount"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 800000"
              value={loanAmount}
              onChange={handleLoanAmountChange}
              className="pl-8"
            />
          </div>
        </div>

        {/* Loan Tenure */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Loan Tenure</Label>
          <Select value={tenure} onValueChange={handleTenureChange}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {TENURE_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Interest Rate Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Interest Rate</Label>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {interestRate.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-muted-foreground w-8 text-right">8%</span>
          <Slider
            min={8}
            max={18}
            step={0.5}
            value={[interestRate]}
            onValueChange={handleRateChange}
            className="flex-1 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-600"
          />
          <span className="text-xs text-muted-foreground w-8">18%</span>
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
          className={`rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/20 p-4 space-y-4 transition-opacity duration-200 ${isPending ? "opacity-70" : "opacity-100"}`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            <Calculator className="h-4 w-4" />
            EMI Calculation Results
          </div>

          {/* Main Results Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Monthly EMI */}
            <div className="rounded-md bg-white/60 dark:bg-white/5 p-3 border border-emerald-100 dark:border-emerald-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs text-muted-foreground">Monthly EMI</p>
              </div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatIndianCurrency(result.emi)}
              </p>
            </div>

            {/* Total Interest */}
            <div className="rounded-md bg-white/60 dark:bg-white/5 p-3 border border-amber-100 dark:border-amber-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-muted-foreground">Total Interest</p>
              </div>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                {formatIndianCurrency(result.totalInterest)}
              </p>
            </div>

            {/* Total Payment */}
            <div className="rounded-md bg-white/60 dark:bg-white/5 p-3 border border-emerald-100 dark:border-emerald-800/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Banknote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs text-muted-foreground">
                  Total Payment ({result.tenureYears}Y)
                </p>
              </div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatIndianCurrency(result.totalPayment)}
              </p>
            </div>
          </div>

          {/* Visual Breakdown Bar */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Principal vs Interest Breakdown
            </p>
            <div className="h-4 rounded-full overflow-hidden bg-muted flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${result.principalPercent}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all duration-500 ease-out"
                style={{ width: `${100 - result.principalPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-muted-foreground">
                  Principal: {result.principalPercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />
                <span className="text-muted-foreground">
                  Interest: {(100 - result.principalPercent).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Year 1 Amortization Summary */}
          <div className="rounded-md border border-border bg-white/40 dark:bg-white/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground">
                Year 1 Amortization Summary
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Interest Paid</p>
                <p className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatIndianCurrency(result.year1Breakdown.interest)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Principal Repaid</p>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatIndianCurrency(result.year1Breakdown.principal)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Balance After Y1</p>
                <p className="font-semibold tabular-nums">
                  {formatIndianCurrency(result.year1Breakdown.remainingBalance)}
                </p>
              </div>
            </div>
            {/* Year 1 mini bar */}
            <div className="h-2 rounded-full overflow-hidden bg-muted flex">
              {result.year1Breakdown.interest + result.year1Breakdown.principal >
              0 ? (
                <>
                  <div
                    className="h-full bg-amber-400 transition-all duration-500 ease-out"
                    style={{
                      width: `${
                        (result.year1Breakdown.interest /
                          (result.year1Breakdown.interest +
                            result.year1Breakdown.principal)) *
                        100
                      }%`,
                    }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                    style={{
                      width: `${
                        (result.year1Breakdown.principal /
                          (result.year1Breakdown.interest +
                            result.year1Breakdown.principal)) *
                        100
                      }%`,
                    }}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}