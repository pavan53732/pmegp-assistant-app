// ─── DPR Preview Screen ────────────────────────────────────────────────────
// Loads the project, runs `checkEligibility(profile)` then
// `computeFinancials(profile)` (the DPR engine needs both), then calls
// `generateDPR(profile, financials, eligibility)`.
//
// Renders the 18 DPR sections in an accordion. Each section shows its
// markdown content (rendered as preformatted text — Wave 5 may add a real
// Markdown renderer) plus any embedded tables.
//
// "Download PDF" button calls `generatePdf(dpr)` (async) → ArrayBuffer →
// Blob → object URL → anchor click → download as `pmegp-dpr-<id>.pdf`.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  IndianRupee,
  ShieldCheck,
  FileText,
  Download,
  Loader2,
} from "lucide-react";

import { getProjectRepository } from "@/database/project-repository";
import type { ProjectProfile } from "@/shared/types/project-profile";
import { computeFinancials } from "@/engines/financial-engine";
import { checkEligibility } from "@/engines/eligibility-engine";
import {
  generateDPR,
  type DprDocument,
  type DprTable,
} from "@/engines/dpr-engine";
import { generatePdf } from "@/engines/pdf-engine";
import { formatDateTime, formatINR } from "@/shared/format";

export function DprScreen() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProjectProfile | null>(null);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfDone, setPdfDone] = useState(false);

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

  const dpr: DprDocument | null = useMemo(() => {
    if (!profile) return null;
    try {
      const financials = computeFinancials(profile);
      const eligibility = checkEligibility(profile);
      return generateDPR(profile, financials, eligibility);
    } catch (err) {
      // Bubble up as a top-level error.
      throw err instanceof Error ? err : new Error(String(err));
    }
  }, [profile]);

  // If dpr computation throws, capture it in the error state.
  useEffect(() => {
    if (!dpr && profile) {
      // Will have been thrown by useMemo; recompute-and-capture to surface.
      try {
        computeFinancials(profile);
        checkEligibility(profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, [dpr, profile]);

  const handleDownloadPdf = async () => {
    if (!dpr) return;
    setPdfBusy(true);
    setPdfError(null);
    setPdfDone(false);
    try {
      const buffer = await generatePdf(dpr);
      const blob = new Blob([buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pmegp-dpr-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so the browser has time to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
      setPdfDone(true);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfBusy(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't generate DPR</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
          <ArrowLeft className="size-3.5" /> Back to dashboard
        </Button>
      </Alert>
    );
  }

  if (!profile || !dpr) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
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
            DPR preview · {projectName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Generated {formatDateTime(dpr.generatedAt)} · {dpr.sections.length} sections ·{" "}
            {dpr.wordCount.toLocaleString("en-IN")} words.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-9">
            <Link to={`/project/${id}/financial`}>
              <IndianRupee className="size-3.5" /> Financial
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-9">
            <Link to={`/project/${id}/eligibility`}>
              <ShieldCheck className="size-3.5" /> Eligibility
            </Link>
          </Button>
          <Button
            onClick={handleDownloadPdf}
            disabled={pdfBusy}
            className="min-h-11"
          >
            {pdfBusy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Generating PDF…
              </>
            ) : (
              <>
                <Download className="size-4" /> Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {pdfError && (
        <Alert variant="destructive">
          <AlertTitle>PDF generation failed</AlertTitle>
          <AlertDescription>{pdfError}</AlertDescription>
        </Alert>
      )}

      {pdfDone && (
        <Alert>
          <FileText className="size-4" />
          <AlertTitle>PDF downloaded</AlertTitle>
          <AlertDescription>
            Your browser should have started downloading{" "}
            <code className="text-xs">pmegp-dpr-{id}.pdf</code>.
          </AlertDescription>
        </Alert>
      )}

      {/* Headline summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Eligibility"
          value={dpr.eligibilityResult.eligible ? "Eligible" : "Not eligible"}
          tone={dpr.eligibilityResult.eligible ? "good" : "bad"}
        />
        <SummaryCard
          label="Total project cost"
          value={formatINR(dpr.financialResult.totalProjectCost)}
        />
        <SummaryCard
          label="Subsidy"
          value={`${formatINR(dpr.financialResult.subsidyAmount)} (${dpr.financialResult.subsidyRate}%)`}
        />
        <SummaryCard
          label="EMI"
          value={formatINR(dpr.financialResult.emi)}
          sub={`${dpr.financialResult.loanTenureMonths} mo`}
        />
      </div>

      {/* Sections accordion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">DPR sections</CardTitle>
          <CardDescription>
            All {dpr.sections.length} sections generated by the DPR Engine.
            Click to expand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {dpr.sections.map((section) => (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="text-sm font-medium">
                  <span className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {section.order}
                    </Badge>
                    {section.title}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
                      {section.content}
                    </pre>
                    {section.tables?.map((table, i) => (
                      <DprTableView key={i} table={table} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <Card className="gap-2 py-4">
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-base font-semibold ${toneClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DprTableView({ table }: { table: DprTable }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{table.caption}</p>
      <Table>
        {table.headers.length > 0 && (
          <TableHeader>
            <TableRow>
              {table.headers.map((h, i) => (
                <TableHead key={i}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {table.rows.map((row, i) => (
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
    </div>
  );
}
