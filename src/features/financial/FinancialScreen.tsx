// ─── Financial Review Screen ────────────────────────────────────────────────
// Loads the project, calls `computeFinancials(profile)` from the financial
// engine, and renders:
//   1. A headline KPI strip (project cost, own contribution, subsidy, EMI,
//      DSCR, break-even).
//   2. A full financial figures table (means of finance + loan + profitability
//      + ratios).
//   3. A Recharts bar chart of the project-cost breakdown (machinery, building,
//      working capital, etc.).
//   4. A Recharts line chart of the loan repayment schedule (closing balance
//      over months).
//
// The financial engine is pure and synchronous, so the computation happens
// inside a useMemo on the loaded profile. Errors (missing project, bad
// profile) are surfaced via a shadcn Alert.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  IndianRupee,
  TrendingUp,
} from "lucide-react";

import { getProjectRepository } from "@/database/project-repository";
import type { ProjectProfile } from "@/shared/types/project-profile";
import {
  computeFinancials,
  type FinancialResult,
} from "@/engines/financial-engine";
import { formatINR, formatNumber, formatPercent } from "@/shared/format";

export function FinancialScreen() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProjectProfile | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repo = getProjectRepository();
        const row = await repo.getById(id);
        if (cancelled) return;
        if (!row) {
          setError("Project not found.");
          return;
        }
        setProfile(row.profile);
        setProjectName(row.businessName || row.name);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const result: FinancialResult | null = useMemo(
    () => (profile ? computeFinancials(profile) : null),
    [profile],
  );

  // Chart datasets — only built when result is present.
  const costBreakdown = useMemo(() => {
    if (!profile || !result) return [];
    return [
      {
        name: "Machinery",
        value: profile.financials.machineryAndEquipment,
      },
      {
        name: "Building",
        value: profile.financials.buildingAndCivilWorks,
      },
      {
        name: "Other fixed",
        value: profile.financials.otherFixedAssets,
      },
      {
        name: "Pre-op expenses",
        value: profile.financials.preOperativeExpenses,
      },
      {
        name: "Working capital",
        value: profile.financials.workingCapital,
      },
    ];
  }, [profile, result]);

  const scheduleData = useMemo(() => {
    if (!result) return [];
    // Downsample for very long schedules: every 6th month, plus the last one.
    const sched = result.loanSchedule;
    if (sched.length <= 24) return sched;
    const out = sched.filter((e, i) => i % 6 === 0 || i === sched.length - 1);
    return out;
  }, [result]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load financials</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
          <ArrowLeft className="size-3.5" /> Back to dashboard
        </Button>
      </Alert>
    );
  }

  if (!profile || !result) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 min-h-9 text-muted-foreground"
            onClick={() => navigate(`/project/${id}`)}
          >
            <ArrowLeft className="size-3.5" /> Profile
          </Button>
          <h2 className="truncate text-2xl font-semibold tracking-tight">
            Financial review · {projectName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Computed by the pure, deterministic Financial Engine — integer
            rupees, no floats.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-9">
            <Link to={`/project/${id}/eligibility`}>
              <ShieldCheck className="size-3.5" /> Eligibility
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-9">
            <Link to={`/project/${id}/dpr`}>
              <FileText className="size-3.5" /> DPR
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total project cost"
          value={formatINR(result.totalProjectCost)}
        />
        <KpiCard
          label="Own contribution"
          value={formatINR(result.ownContribution)}
          sub={`${result.ownContributionPercent}%`}
        />
        <KpiCard
          label="Subsidy"
          value={formatINR(result.subsidyAmount)}
          sub={`${result.subsidyRate}% margin`}
        />
        <KpiCard
          label="EMI"
          value={formatINR(result.emi)}
          sub={`${result.loanTenureMonths} mo`}
        />
        <KpiCard
          label="DSCR"
          value={formatNumber(result.dscr)}
          sub={result.dscr >= 1.5 ? "healthy" : result.dscr >= 1.0 ? "marginal" : "weak"}
          tone={result.dscr >= 1.5 ? "good" : result.dscr >= 1.0 ? "warn" : "bad"}
        />
        <KpiCard
          label="Break-even"
          value={formatPercent(result.breakEvenPercent)}
          sub="of revenue"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project cost breakdown</CardTitle>
            <CardDescription>
              How the total project cost is split across fixed capital and
              working capital components.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costBreakdown} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => formatINR(Number(v), false)}
                    tick={{ fontSize: 11 }}
                    width={70}
                  />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="value" name="Cost" fill="oklch(0.55 0.15 163)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan repayment schedule</CardTitle>
            <CardDescription>
              Closing balance over the loan tenure (downsampled to every 6th
              month for readability).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scheduleData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.5 0 0 / 0.2)" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(v) => `M${v}`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v) => formatINR(Number(v), false)}
                    tick={{ fontSize: 11 }}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v: number) => formatINR(v)}
                    labelFormatter={(v) => `Month ${v}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="closingBalance"
                    name="Closing balance"
                    stroke="oklch(0.6 0.18 200)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="emi"
                    name="EMI"
                    stroke="oklch(0.7 0.15 60)"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full figures table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <IndianRupee className="size-4" /> All financial figures
          </CardTitle>
          <CardDescription>
            Means of finance, loan, profitability and ratios — straight from
            the engine output.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">Metric</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <GroupRow label="Means of finance" />
              <Row label="Total project cost" value={formatINR(result.totalProjectCost)} />
              <Row label="Own contribution" value={`${formatINR(result.ownContribution)} (${result.ownContributionPercent}%)`} />
              <Row label="Subsidy amount" value={`${formatINR(result.subsidyAmount)} (${result.subsidyRate}% margin)`} />
              <Row label="Total bank finance" value={formatINR(result.bankFinance)} />
              <Row label="Bank term loan" value={formatINR(result.bankTermLoan)} />
              <Row label="Bank working capital loan" value={formatINR(result.bankWorkingCapital)} />

              <GroupRow label="Loan" />
              <Row label="EMI (monthly)" value={formatINR(result.emi)} />
              <Row label="Loan tenure" value={`${result.loanTenureMonths} months`} />
              <Row label="Moratorium" value={`${result.repaymentMoratoriumMonths} months`} />
              <Row label="Total interest payable" value={formatINR(result.totalInterest)} />
              <Row label="Total repayment" value={formatINR(result.totalRepayment)} />

              <GroupRow label="Profitability" />
              <Row label="Monthly operating costs" value={formatINR(result.monthlyOperatingCosts)} />
              <Row label="Annual revenue (projected)" value={formatINR(result.annualRevenue)} />
              <Row label="Annual expenditure" value={formatINR(result.annualExpenditure)} />
              <Row label="Annual net profit" value={formatINR(result.annualNetProfit)} />
              <Row label="Annual depreciation" value={formatINR(result.annualDepreciation)} />

              <GroupRow label="Ratios" />
              <Row label="DSCR" value={formatNumber(result.dscr)} />
              <Row label="Break-even %" value={formatPercent(result.breakEvenPercent)} />
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Schedule preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" /> Repayment schedule
          </CardTitle>
          <CardDescription>
            Month-by-month amortization. {result.loanSchedule.length} rows
            total — showing the first 12.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Opening</TableHead>
                <TableHead>EMI</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.loanSchedule.slice(0, 12).map((e) => (
                <TableRow key={e.month}>
                  <TableCell>M{e.month}</TableCell>
                  <TableCell className="font-mono text-xs">{formatINR(e.openingBalance, false)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatINR(e.emi, false)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatINR(e.interest, false)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatINR(e.principal, false)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatINR(e.closingBalance, false)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function GroupRow({ label }: { label: string }) {
  return (
    <TableRow className="bg-muted/40 hover:bg-muted/40">
      <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{label}</TableCell>
      <TableCell className="font-medium">{value}</TableCell>
    </TableRow>
  );
}
