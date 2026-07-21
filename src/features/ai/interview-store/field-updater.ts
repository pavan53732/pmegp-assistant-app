import type { ProjectProfile } from "@/shared/types/project-profile";
import type { FieldProvenance } from "@/shared/types/provenance";

/** Set a value at a dot-notation path. Returns a NEW profile (immutable). */
export function setFieldValue(profile: ProjectProfile, fieldPath: string, value: unknown): ProjectProfile {
  const newProfile = JSON.parse(JSON.stringify(profile)) as ProjectProfile;
  const parts = fieldPath.split(".");
  let current: Record<string, unknown> = newProfile as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
  return newProfile;
}

/** Get a value at a dot-notation path. */
export function getFieldValue(profile: ProjectProfile, fieldPath: string): unknown {
  const parts = fieldPath.split(".");
  let current: unknown = profile;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Update provenance for a field. Returns a NEW map (immutable). */
export function updateProvenance(
  map: Record<string, FieldProvenance>,
  fieldPath: string,
  source: "USER" | "AI" | "OCR" | "KNOWLEDGE" | null,
  verification: "UNVERIFIED" | "CONFIRMED" | "VALIDATED" = "UNVERIFIED"
): Record<string, FieldProvenance> {
  return {
    ...map,
    [fieldPath]: {
      source,
      verification,
      confirmedAt: verification === "CONFIRMED" ? new Date().toISOString() : undefined,
    },
  };
}

/** Stamp ALL fields with verification=CONFIRMED (for "Confirm Project" button). */
export function stampAllConfirmed(map: Record<string, FieldProvenance>): Record<string, FieldProvenance> {
  const now = new Date().toISOString();
  const result: Record<string, FieldProvenance> = {};
  for (const [field, p] of Object.entries(map)) {
    if (p.source !== null) result[field] = { ...p, verification: "CONFIRMED" as const, confirmedAt: now };
  }
  return result;
}

/** Stamp ALL fields with verification=VALIDATED. */
export function stampAllValidated(map: Record<string, FieldProvenance>): Record<string, FieldProvenance> {
  const result: Record<string, FieldProvenance> = {};
  for (const [field, p] of Object.entries(map)) {
    if (p.source !== null) result[field] = { ...p, verification: "VALIDATED" as const };
  }
  return result;
}

// ── Derived field helpers ──────────────────────────────────────────────────

/** Safely sum an array of numeric values, treating null/undefined items as 0. */
function safeSum(values: (number | undefined | null)[]): number {
  return Math.round(values.reduce<number>((acc, v) => acc + (v ?? 0), 0));
}

/**
 * Compute all derived (rollup / aggregate) fields from the individual items
 * that users or AI have filled in.  The function mutates a single deep-cloned
 * copy so every computation is O(1) after the initial clone.
 *
 * Fields computed:
 *  ─────────────────────────────────────────────────────────────────────────
 *  Identity:
 *    applicant.isWomen                ← applicant.gender === "FEMALE"
 *
 *  Machinery:
 *    machinery.totalCost              ← Σ machinery.items[].totalCost
 *
 *  Raw Materials:
 *    rawMaterials.totalMonthlyCost    ← Σ rawMaterials.items[].totalMonthlyCost
 *
 *  Employees:
 *    employees.totalEmployment        ← skilled + unskilled + administrative headcount
 *    employees.totalMonthlyWages      ← Σ (headcount × wage) per category
 *
 *  Utilities:
 *    utilities.totalMonthlyOverheads  ← Σ all monthly utility line-items
 *
 *  Financials:
 *    financials.machineryAndEquipment ← alias of machinery.totalCost
 *    financials.buildingAndCivilWorks ← land.constructionCost (if any)
 *    financials.totalFixedCapital     ← Σ (machinery + building + otherFixed + preOp)
 *    financials.totalProjectCost      ← totalFixedCapital + workingCapital
 *  ─────────────────────────────────────────────────────────────────────────
 */
export function computeDerivedFields(profile: ProjectProfile): ProjectProfile {
  // Single deep clone — all subsequent mutations are on this copy.
  const p: ProjectProfile = JSON.parse(JSON.stringify(profile)) as ProjectProfile;

  // ── 1. Identity: isWomen from gender ─────────────────────────────────────
  p.applicant.isWomen = p.applicant.gender === "FEMALE";

  // ── 2. Machinery total ──────────────────────────────────────────────────
  // Sum of all machinery item line-totals.
  p.machinery.totalCost = safeSum(
    (p.machinery.items ?? []).map((item) => item.totalCost)
  );

  // ── 3. Raw Materials monthly total ───────────────────────────────────────
  // Sum of all raw-material item monthly costs.
  p.rawMaterials.totalMonthlyCost = safeSum(
    (p.rawMaterials.items ?? []).map((item) => item.totalMonthlyCost)
  );

  // ── 4. Employee totals ───────────────────────────────────────────────────
  const skilledCount = (p.employees.skilled?.male ?? 0) + (p.employees.skilled?.female ?? 0);
  const unskilledCount = (p.employees.unskilled?.male ?? 0) + (p.employees.unskilled?.female ?? 0);
  const adminCount = p.employees.administrative?.count ?? 0;

  p.employees.totalEmployment = skilledCount + unskilledCount + adminCount;

  // Monthly wages = (headcount × per-person wage) for each category.
  const skilledWages = skilledCount * (p.employees.skilled?.monthlyWagePerPerson ?? 0);
  const unskilledWages = unskilledCount * (p.employees.unskilled?.monthlyWagePerPerson ?? 0);
  const adminWages = adminCount * (p.employees.administrative?.monthlyWagePerPerson ?? 0);

  p.employees.totalMonthlyWages = safeSum([skilledWages, unskilledWages, adminWages]);

  // ── 5. Utilities total monthly overheads ─────────────────────────────────
  const u = p.utilities;
  p.utilities.totalMonthlyOverheads = safeSum([
    u?.monthlyPowerCost,
    u?.monthlyWaterCost,
    u?.monthlyRentCost,
    u?.monthlyMaintenanceCost,
    u?.monthlyTransportCost,
    u?.monthlyCommunicationCost,
    u?.monthlyInsuranceCost,
    u?.monthlyMiscCost,
  ]);

  // ── 6. Financial rollups ────────────────────────────────────────────────

  // 6a. Machinery & Equipment mirrors the machinery section total.
  p.financials.machineryAndEquipment = p.machinery.totalCost;

  // 6b. Building & Civil Works comes from the land section's construction cost.
  p.financials.buildingAndCivilWorks = p.land?.constructionCost ?? 0;

  // 6c. Total Fixed Capital = sum of all fixed-capital components.
  p.financials.totalFixedCapital = safeSum([
    p.financials.machineryAndEquipment,
    p.financials.buildingAndCivilWorks,
    p.financials.otherFixedAssets,
    p.financials.preOperativeExpenses,
  ]);

  // 6d. Total Project Cost = Fixed Capital + Working Capital.
  p.financials.totalProjectCost = safeSum([
    p.financials.totalFixedCapital,
    p.financials.workingCapital,
  ]);

  return p;
}