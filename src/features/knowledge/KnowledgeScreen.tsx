// ─── Knowledge Search Screen ────────────────────────────────────────────────
// Search the bundled Knowledge Package for NIC codes via the Knowledge Engine.
//
// User types a query (free-text, e.g. "pickle" or "10621" or "spinning mill"),
// we call `resolveActivity(query)` to get ActivitySuggestion[] (each with NIC
// code, description, sector, sub-category, match score, match reason).
//
// Clicking a suggestion loads:
//   • `suggestMachinery(nicCode)`     — MachinerySuggestion[]
//   • `suggestRawMaterials(nicCode)`  — RawMaterialSuggestion[]
//   • `suggestEmployees(nicCode)`     — EmployeeSuggestion[]
//   • `suggestUtilities(nicCode)`     — UtilitySuggestion[]
//   • `isOnNegativeList(nicCode)`     — null | NegativeListEntry
//
// All synchronous — no async loading states needed.
// ───────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Package, Wrench, Leaf, Users, Zap, AlertOctagon } from "lucide-react";

import {
  resolveActivity,
  suggestMachinery,
  suggestRawMaterials,
  suggestEmployees,
  suggestUtilities,
  isOnNegativeList,
  type ActivitySuggestion,
} from "@/engines/knowledge-engine";
import { formatINR } from "@/shared/format";

const SUGGESTED_QUERIES = [
  "pickle",
  "spinning mill",
  "bakery",
  "dairy",
  "pottery",
  "tamil nadu rice mill",
];

export function KnowledgeScreen() {
  const [query, setQuery] = useState("pickle");
  const [submitted, setSubmitted] = useState("pickle");
  const [selectedNic, setSelectedNic] = useState<string | null>(null);

  const suggestions: ActivitySuggestion[] = useMemo(() => {
    if (!submitted.trim()) return [];
    try {
      return resolveActivity(submitted);
    } catch {
      return [];
    }
  }, [submitted]);

  // Auto-select the first result on a fresh search.
  const effectiveSelected = selectedNic ?? suggestions[0]?.nicCode ?? null;

  const machinery = useMemo(
    () => (effectiveSelected ? suggestMachinery(effectiveSelected) : []),
    [effectiveSelected],
  );
  const rawMaterials = useMemo(
    () => (effectiveSelected ? suggestRawMaterials(effectiveSelected) : []),
    [effectiveSelected],
  );
  const employees = useMemo(
    () => (effectiveSelected ? suggestEmployees(effectiveSelected) : []),
    [effectiveSelected],
  );
  const utilities = useMemo(
    () => (effectiveSelected ? suggestUtilities(effectiveSelected) : []),
    [effectiveSelected],
  );
  const negativeEntry = useMemo(
    () => (effectiveSelected ? isOnNegativeList(effectiveSelected) : null),
    [effectiveSelected],
  );

  const selectedSuggestion = suggestions.find(
    (s) => s.nicCode === effectiveSelected,
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedNic(null);
    setSubmitted(query);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Knowledge search
        </h2>
        <p className="text-sm text-muted-foreground">
          Search the bundled PMEGP Knowledge Package for NIC codes, machinery,
          raw materials, employees and utilities.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search activities</CardTitle>
          <CardDescription>
            Try an activity name (e.g. "pickle"), a NIC code prefix (e.g.
            "1030"), or a related keyword.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-60">
              <Label htmlFor="kb-query" className="sr-only">
                Query
              </Label>
              <Input
                id="kb-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="pickle, bakery, spinning mill, NIC 103005…"
                className="min-h-11"
              />
            </div>
            <Button type="submit" className="min-h-11">
              <Search className="size-4" /> Search
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTED_QUERIES.map((q) => (
              <Button
                key={q}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9"
                onClick={() => {
                  setQuery(q);
                  setSelectedNic(null);
                  setSubmitted(q);
                }}
              >
                {q}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {submitted.trim() && suggestions.length === 0 && (
        <Alert>
          <AlertTitle>No matches</AlertTitle>
          <AlertDescription>
            The Knowledge Engine found no NIC codes matching{" "}
            <code className="text-xs">{submitted}</code>. Try a different
            keyword.
          </AlertDescription>
        </Alert>
      )}

      {suggestions.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          {/* Results list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4" /> Results ({suggestions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.nicCode}
                  type="button"
                  onClick={() => setSelectedNic(s.nicCode)}
                  className={`w-full rounded-md border p-2.5 text-left transition-colors ${
                    s.nicCode === effectiveSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.nicCode}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {(s.matchScore * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-sm font-medium leading-snug">
                    {s.description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.sector} · {s.subCategory}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Detail panel */}
          <div className="space-y-4">
            {selectedSuggestion && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedSuggestion.description}
                  </CardTitle>
                  <CardDescription>
                    NIC {selectedSuggestion.nicCode} ·{" "}
                    {selectedSuggestion.sector} /{" "}
                    {selectedSuggestion.subCategory}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {selectedSuggestion.matchReason}
                  </p>
                </CardContent>
              </Card>
            )}

            {negativeEntry && (
              <Alert variant="destructive">
                <AlertOctagon className="size-4" />
                <AlertTitle>On negative list</AlertTitle>
                <AlertDescription>
                  NIC {negativeEntry.nicCode} ({negativeEntry.description}) is
                  excluded from PMEGP: {negativeEntry.reason}
                </AlertDescription>
              </Alert>
            )}

            <DetailTable
              title="Machinery"
              icon={<Wrench className="size-4" />}
              emptyText="No machinery suggestions for this NIC prefix."
              headers={["Name", "Spec", "Qty", "Unit cost", "Category"]}
              rows={machinery.map((m) => [
                m.name,
                m.specification ?? "—",
                String(m.typicalQuantity),
                `${formatINR(m.estimatedUnitCost)} (range ${formatINR(m.estimatedUnitCostRange[0])}–${formatINR(m.estimatedUnitCostRange[1])})`,
                `${m.category}${m.isEssential ? " · essential" : ""}`,
              ])}
            />

            <DetailTable
              title="Raw materials"
              icon={<Leaf className="size-4" />}
              emptyText="No raw material suggestions for this NIC prefix."
              headers={["Name", "Spec", "Monthly qty", "Unit rate"]}
              rows={rawMaterials.map((r) => [
                r.name,
                r.specification ?? "—",
                `${r.typicalMonthlyQuantity} ${r.unit}`,
                `${formatINR(r.estimatedUnitRate)} (range ${formatINR(r.estimatedUnitRateRange[0])}–${formatINR(r.estimatedUnitRateRange[1])})`,
              ])}
            />

            <DetailTable
              title="Employees"
              icon={<Users className="size-4" />}
              emptyText="No employee suggestions for this NIC prefix."
              headers={["Role", "Category", "Count", "Monthly wage"]}
              rows={employees.map((e) => [
                e.role,
                e.category,
                `${e.typicalCount.min}–${e.typicalCount.max}`,
                `${formatINR(e.estimatedMonthlyWage)} (range ${formatINR(e.estimatedMonthlyWageRange[0])}–${formatINR(e.estimatedMonthlyWageRange[1])})`,
              ])}
            />

            <DetailTable
              title="Utilities & overheads"
              icon={<Zap className="size-4" />}
              emptyText="No utility suggestions for this NIC prefix."
              headers={["Type", "Description", "Monthly cost"]}
              rows={utilities.map((u) => [
                u.type,
                u.description,
                `${formatINR(u.estimatedMonthlyCost)} (range ${formatINR(u.estimatedMonthlyCostRange[0])}–${formatINR(u.estimatedMonthlyCostRange[1])})`,
              ])}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailTable({
  title,
  icon,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {rows.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {row.map((cell, j) => (
                    <TableCell key={j} className="text-xs">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
