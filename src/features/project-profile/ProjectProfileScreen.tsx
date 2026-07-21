// ─── Project Profile Screen ─────────────────────────────────────────────────
// Read-only display of the canonical ProjectProfile, grouped by section
// (Applicant / Business / Location / Land / Capacity / Machinery / Raw
// Materials / Employees / Utilities / Financials / Market / Validation).
//
// "Edit" toggle switches to a JSON textarea (Wave 4 will replace this with
// a real guided-form editor — for Wave 4 shell this is the simplest "real"
// edit surface that round-trips through the repository + project engine).
//
// The Edit JSON path:
//   1. Parse the textarea string as JSON.
//   2. On parse success, call repo.updateProfile(id, profile, "COMPLETE").
//   3. Reload the project and flip back to read mode.
// Parse errors are surfaced inline (Alert) without losing the textarea
// contents so the user can fix syntax and retry.
// ───────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  IndianRupee,
  ShieldCheck,
  FileText,
  Pencil,
  Check,
  X,
  ArrowLeft,
} from "lucide-react";

import { getProjectRepository } from "@/database/project-repository";
import type { ProjectProfile as Profile } from "@/shared/types/project-profile";
import {
  formatINR,
  formatDate,
  statusLabel,
  statusBadgeClass,
} from "@/shared/format";

type Loaded = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  profile: Profile;
};

// Section definitions: title + a flat list of {label, getter} pairs.
// The getters are defensive — undefined values are rendered as "—".
type Field = { label: string; value: string };

function buildSections(p: Profile): Array<{ id: string; title: string; fields: Field[] }> {
  return [
    {
      id: "applicant",
      title: "Applicant",
      fields: [
        { label: "Name", value: p.applicant.name || "—" },
        { label: "Age", value: p.applicant.age ? String(p.applicant.age) : "—" },
        { label: "Gender", value: p.applicant.gender },
        { label: "Category", value: p.applicant.category },
        { label: "Is women", value: String(p.applicant.isWomen) },
        { label: "Education", value: p.applicant.education },
        { label: "Entity type", value: p.applicant.entityType },
        {
          label: "Prior subsidy",
          value: p.applicant.priorSubsidy ? `Yes (${p.applicant.priorSubsidyDetail ?? "no detail"})` : "No",
        },
        {
          label: "EDP completed",
          value: p.applicant.edpCompleted
            ? `Yes (cert #${p.applicant.edpCertificateNo ?? "—"})`
            : "No",
        },
        { label: "Phone", value: p.applicant.phone ?? "—" },
        { label: "Email", value: p.applicant.email ?? "—" },
        { label: "Experience", value: p.applicant.experienceYears != null ? `${p.applicant.experienceYears} yrs` : "—" },
      ],
    },
    {
      id: "business",
      title: "Business",
      fields: [
        { label: "Unit name", value: p.business.name || "—" },
        { label: "Description", value: p.business.description || "—" },
        { label: "Activity type", value: p.business.activityType },
        { label: "NIC code", value: p.business.nicCode ?? "—" },
        { label: "NIC description", value: p.business.nicDescription ?? "—" },
        { label: "Sector", value: p.business.sector },
        { label: "Sub-category", value: p.business.subCategory },
      ],
    },
    {
      id: "location",
      title: "Location",
      fields: [
        { label: "State", value: p.location.state || "—" },
        { label: "District", value: p.location.district || "—" },
        { label: "Area", value: p.location.area },
        { label: "Hill / border", value: String(p.location.isHillBorderArea) },
        { label: "Aspirational district", value: String(p.location.isAspirationalDistrict) },
        { label: "Pin code", value: p.location.pinCode ?? "—" },
        { label: "Premises address", value: p.location.premisesAddress ?? "—" },
      ],
    },
    {
      id: "land",
      title: "Land & Building",
      fields: [
        { label: "Land status", value: p.land.status },
        { label: "Building type", value: p.land.buildingType ?? "—" },
        {
          label: "Owned land value",
          value: p.land.ownedLandValue != null ? formatINR(p.land.ownedLandValue) : "—",
        },
        {
          label: "Monthly rent",
          value: p.land.monthlyRent != null ? formatINR(p.land.monthlyRent) : "—",
        },
        { label: "Area (sq ft)", value: p.land.areaSqFt != null ? String(p.land.areaSqFt) : "—" },
        {
          label: "Construction cost",
          value: p.land.constructionCost != null ? formatINR(p.land.constructionCost) : "—",
        },
      ],
    },
    {
      id: "capacity",
      title: "Capacity",
      fields: [
        {
          label: "Installed capacity",
          value:
            p.capacity.installedCapacity.value > 0
              ? `${p.capacity.installedCapacity.value} ${p.capacity.installedCapacity.unit}`
              : "—",
        },
        { label: "Projected utilization", value: `${p.capacity.projectedCapacityUtil}%` },
        { label: "Working days / month", value: String(p.capacity.workingDaysPerMonth) },
        { label: "Working hours / day", value: String(p.capacity.workingHoursPerDay) },
        { label: "Shifts", value: String(p.capacity.shifts) },
      ],
    },
    {
      id: "machinery",
      title: `Machinery (${p.machinery.items.length})`,
      fields: [
        { label: "Total cost", value: formatINR(p.machinery.totalCost) },
        ...p.machinery.items.map((m, i) => ({
          label: `Item ${i + 1}: ${m.name}`,
          value: `${m.quantity} × ${formatINR(m.unitCost, false)} = ${formatINR(m.totalCost)} [${m.source}]`,
        })),
      ],
    },
    {
      id: "raw-materials",
      title: `Raw materials (${p.rawMaterials.items.length})`,
      fields: [
        { label: "Total monthly cost", value: formatINR(p.rawMaterials.totalMonthlyCost) },
        ...p.rawMaterials.items.map((r, i) => ({
          label: `Item ${i + 1}: ${r.name}`,
          value: `${r.monthlyQuantity} ${r.unit} × ${formatINR(r.unitRate, false)} = ${formatINR(r.totalMonthlyCost)} [${r.source}]`,
        })),
      ],
    },
    {
      id: "employees",
      title: "Employees",
      fields: [
        {
          label: "Skilled (M/F)",
          value: `${p.employees.skilled.male}/${p.employees.skilled.female} × ${formatINR(p.employees.skilled.monthlyWagePerPerson, false)}/mo`,
        },
        {
          label: "Unskilled (M/F)",
          value: `${p.employees.unskilled.male}/${p.employees.unskilled.female} × ${formatINR(p.employees.unskilled.monthlyWagePerPerson, false)}/mo`,
        },
        {
          label: "Administrative",
          value: `${p.employees.administrative.count} × ${formatINR(p.employees.administrative.monthlyWagePerPerson, false)}/mo`,
        },
        { label: "Total employment", value: String(p.employees.totalEmployment) },
        { label: "Total monthly wages", value: formatINR(p.employees.totalMonthlyWages) },
      ],
    },
    {
      id: "utilities",
      title: "Utilities & Overheads",
      fields: [
        { label: "Power", value: formatINR(p.utilities.monthlyPowerCost) },
        { label: "Water", value: formatINR(p.utilities.monthlyWaterCost) },
        { label: "Rent", value: formatINR(p.utilities.monthlyRentCost) },
        { label: "Maintenance", value: formatINR(p.utilities.monthlyMaintenanceCost) },
        { label: "Transport", value: formatINR(p.utilities.monthlyTransportCost) },
        { label: "Communication", value: formatINR(p.utilities.monthlyCommunicationCost) },
        { label: "Insurance", value: formatINR(p.utilities.monthlyInsuranceCost) },
        { label: "Miscellaneous", value: formatINR(p.utilities.monthlyMiscCost) },
        { label: "Total monthly overheads", value: formatINR(p.utilities.totalMonthlyOverheads) },
      ],
    },
    {
      id: "financials",
      title: "Financials",
      fields: [
        { label: "Machinery & equipment", value: formatINR(p.financials.machineryAndEquipment) },
        { label: "Other fixed assets", value: formatINR(p.financials.otherFixedAssets) },
        { label: "Pre-operative expenses", value: formatINR(p.financials.preOperativeExpenses) },
        { label: "Building & civil works", value: formatINR(p.financials.buildingAndCivilWorks) },
        { label: "Total fixed capital", value: formatINR(p.financials.totalFixedCapital) },
        { label: "Working capital", value: formatINR(p.financials.workingCapital) },
        { label: "Total project cost", value: formatINR(p.financials.totalProjectCost) },
        { label: "Interest rate", value: `${p.financials.interestRate}%` },
        { label: "Loan tenure", value: `${p.financials.loanTenureYears} yrs` },
        { label: "Moratorium", value: `${p.financials.repaymentMoratoriumMonths} months` },
        { label: "Projected monthly sales", value: formatINR(p.financials.projectedMonthlySales) },
      ],
    },
    {
      id: "market",
      title: "Market",
      fields: [
        { label: "Target market", value: p.market.targetMarket || "—" },
        { label: "Market demand", value: p.market.marketDemand ?? "—" },
        { label: "Competition", value: p.market.competition ?? "—" },
        { label: "Marketing strategy", value: p.market.marketingStrategy ?? "—" },
        {
          label: "Selling price",
          value:
            p.market.sellingPricePerUnit != null
              ? `${formatINR(p.market.sellingPricePerUnit)} / ${p.market.sellingPriceUnit ?? "unit"}`
              : "—",
        },
      ],
    },
    {
      id: "validation",
      title: "Validation",
      fields: [
        { label: "Completeness", value: `${p.validation.completeness}%` },
        { label: "Missing fields", value: p.validation.missingFields.length ? p.validation.missingFields.join(", ") : "—" },
        { label: "Errors", value: p.validation.errors.length ? `${p.validation.errors.length} (${p.validation.errors.map(e => e.code).join(", ")})` : "—" },
        { label: "Contradictions", value: p.validation.contradictions.length ? String(p.validation.contradictions.length) : "—" },
      ],
    },
  ];
}

export function ProjectProfileScreen() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const repo = getProjectRepository();
      const row = await repo.getById(id);
      if (!row) {
        setError("Project not found.");
        setData(null);
        return;
      }
      setData({
        id: row.id,
        name: row.name,
        status: row.status,
        updatedAt: row.updatedAt.toISOString(),
        profile: row.profile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(
    () => (data ? buildSections(data.profile) : []),
    [data],
  );

  const startEdit = () => {
    if (!data) return;
    setDraft(JSON.stringify(data.profile, null, 2));
    setEditError(null);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!data) return;
    setSaving(true);
    setEditError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (err) {
      setEditError(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      setSaving(false);
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setEditError("Top-level JSON must be an object (the ProjectProfile).");
      setSaving(false);
      return;
    }
    try {
      const repo = getProjectRepository();
      await repo.updateProfile(id, parsed as Profile, "COMPLETE");
      setEditMode(false);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load project</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>
          <ArrowLeft className="size-3.5" /> Back to dashboard
        </Button>
      </Alert>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 min-h-9 text-muted-foreground"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Button>
          <h2 className="truncate text-2xl font-semibold tracking-tight">
            {data.profile.business.name || data.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.profile.business.description} · Last updated{" "}
            {formatDate(data.updatedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusBadgeClass(data.status)}>
            {statusLabel(data.status)}
          </Badge>
          {!editMode ? (
            <Button onClick={startEdit} variant="outline" className="min-h-11">
              <Pencil className="size-4" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={saveEdit}
                disabled={saving}
                className="min-h-11"
              >
                <Check className="size-4" /> {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                onClick={cancelEdit}
                variant="outline"
                disabled={saving}
                className="min-h-11"
              >
                <X className="size-4" /> Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stage shortcuts */}
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="min-h-9">
          <Link to={`/project/${data.id}/financial`}>
            <IndianRupee className="size-3.5" /> Financial review
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="min-h-9">
          <Link to={`/project/${data.id}/eligibility`}>
            <ShieldCheck className="size-3.5" /> Eligibility check
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="min-h-9">
          <Link to={`/project/${data.id}/dpr`}>
            <FileText className="size-3.5" /> Generate DPR
          </Link>
        </Button>
      </div>

      {editError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't save</AlertTitle>
          <AlertDescription>{editError}</AlertDescription>
        </Alert>
      )}

      {editMode ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit profile JSON</CardTitle>
            <CardDescription>
              Wave 4 simple editor — paste a full ProjectProfile JSON. Wave 5
              will replace this with a guided form. All fields are saved
              atomically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[480px] font-mono text-xs"
              spellCheck={false}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Project profile</CardTitle>
            <CardDescription>
              All fields grouped by section. Click a section to expand.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full" defaultValue={["applicant"]}>
              {sections.map((section) => (
                <AccordionItem key={section.id} value={section.id}>
                  <AccordionTrigger className="text-sm font-medium">
                    {section.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                      {section.fields.map((f, i) => (
                        <div key={i} className="min-w-0">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd className="break-words font-medium text-foreground">
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
