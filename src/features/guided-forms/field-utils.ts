// ─── Guided Forms — Field Utilities ───────────────────────────────────────
// Pure helpers that bridge between the canonical `ProjectProfile` (nested,
// strongly-typed) and the flat dot-path key/value shape that react-hook-form
// consumes for a single interview phase.
//
// **Invariant:** the guided wizard and the AI interview MUST produce an
// identical `ProjectProfile` for the same inputs. To guarantee that:
//   1. Both paths read field definitions from the SAME `PHASE_CONFIGS` (re-exported here).
//   2. Both paths run the SAME `validateProject` on the resulting profile.
//   3. Both paths call the SAME `InterviewStore.confirmProject()` for confirmation.
//   4. Both paths set `provenance.perField[fieldPath].source` identically
//      (USER for manual entry, KNOWLEDGE for prefilled suggestions).
//
// These helpers are pure (no I/O, no React, no globals). They are safe to unit
// test in isolation.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "@/shared/types/project-profile";
import type { FieldProvenance } from "@/shared/types/provenance";
import type { InterviewPhase } from "@/shared/types/interview";
import type { FieldConfig } from "@/features/ai/interview/types";
import { PHASE_CONFIGS } from "@/features/ai/interview/question-planner";

// ── Phase order (mirrors question-planner.PHASE_ORDER) ────────────────────

export const PHASE_ORDER: readonly InterviewPhase[] = [
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
  "REVIEW",
  "VALIDATION_COMPLETION",
] as const;

// ── Dot-path get / set ────────────────────────────────────────────────────

/**
 * Read a value at a dot-notation path. Returns `undefined` if any segment is
 * missing or non-object.  Mirrors the logic in
 * `@/features/ai/interview-store/field-updater.ts` and
 * `@/engines/validation-engine` so the guided wizard sees exactly the same
 * value the AI path would see for the same profile.
 */
export function getFieldValue(profile: ProjectProfile, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = profile;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Immutable set: deep-clones the profile, writes the value at the dot-path,
 * returns the new profile. Mirrors `setFieldValue` in
 * `@/features/ai/interview-store/field-updater.ts`.
 */
export function setFieldValue(
  profile: ProjectProfile,
  dotPath: string,
  value: unknown,
): ProjectProfile {
  const next = JSON.parse(JSON.stringify(profile)) as ProjectProfile;
  const parts = dotPath.split(".");
  let cursor = next as unknown as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cursor[key] === null || cursor[key] === undefined || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

// ── Empty profile ─────────────────────────────────────────────────────────

/**
 * Deterministic timestamp used by the empty-profile template. Mirrors
 * `EMPTY_PROFILE_TIMESTAMP` in `@/engines/project-engine` and
 * `@/database/sqlite/repositories` so the guided-wizard empty profile is
 * byte-identical to what those layers produce.
 */
const EMPTY_PROFILE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

function buildEmptyPhaseProgress(): ProjectProfile["completion"]["phaseProgress"] {
  return {
    APPLICANT_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    BUSINESS_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    ACTIVITY_RESOLUTION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    PROJECT_SIZING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    FINANCIAL_PLANNING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    REVIEW: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
    VALIDATION_COMPLETION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
  };
}

/**
 * Build the canonical empty `ProjectProfile`. Mirrors `buildEmptyProfile` in
 * `@/engines/project-engine/index.ts` and the DB layer so the guided wizard
 * starts from the same shape the AI interview starts from.
 */
export function buildInitialProfile(): ProjectProfile {
  return {
    applicant: {
      name: "",
      age: 0,
      gender: "MALE",
      category: "GEN",
      isWomen: false,
      education: "NONE",
      entityType: "INDIVIDUAL",
      priorSubsidy: false,
      edpCompleted: false,
    },
    business: {
      name: "",
      description: "",
      activityType: "MANUFACTURING",
      sector: "MANUFACTURING",
      subCategory: "MANUFACTURING",
    },
    location: {
      state: "",
      district: "",
      area: "RURAL",
      isHillBorderArea: false,
      isAspirationalDistrict: false,
    },
    land: { status: "NONE" },
    capacity: {
      installedCapacity: { unit: "", value: 0 },
      projectedCapacityUtil: 0,
      workingDaysPerMonth: 25,
      workingHoursPerDay: 8,
      shifts: 1,
    },
    machinery: { items: [], totalCost: 0 },
    rawMaterials: { items: [], totalMonthlyCost: 0 },
    employees: {
      skilled: { male: 0, female: 0, monthlyWagePerPerson: 0 },
      unskilled: { male: 0, female: 0, monthlyWagePerPerson: 0 },
      administrative: { count: 0, monthlyWagePerPerson: 0 },
      totalMonthlyWages: 0,
      totalEmployment: 0,
    },
    utilities: {
      monthlyPowerCost: 0,
      monthlyWaterCost: 0,
      monthlyRentCost: 0,
      monthlyMaintenanceCost: 0,
      monthlyTransportCost: 0,
      monthlyCommunicationCost: 0,
      monthlyInsuranceCost: 0,
      monthlyMiscCost: 0,
      totalMonthlyOverheads: 0,
    },
    financials: {
      machineryAndEquipment: 0,
      otherFixedAssets: 0,
      preOperativeExpenses: 0,
      buildingAndCivilWorks: 0,
      totalFixedCapital: 0,
      workingCapital: 0,
      totalProjectCost: 0,
      interestRate: 0,
      loanTenureYears: 7,
      repaymentMoratoriumMonths: 6,
      projectedMonthlySales: 0,
    },
    workingCapitalDetail: {
      rawMaterialDays: 30,
      workInProgressDays: 15,
      finishedGoodsDays: 15,
      creditorsDays: 15,
      method: "USER_PROVIDED",
    },
    market: { targetMarket: "" },
    attachments: { items: [] },
    validation: {
      completeness: 0,
      missingFields: [],
      errors: [],
      contradictions: [],
    },
    provenance: { perField: {}, aggregate: 0 },
    completion: {
      currentPhase: "APPLICANT_DISCOVERY",
      phaseProgress: buildEmptyPhaseProgress(),
      startedAt: EMPTY_PROFILE_TIMESTAMP,
      lastUpdatedAt: EMPTY_PROFILE_TIMESTAMP,
      interactionCount: 0,
    },
  };
}

// ── Phase → field resolution ──────────────────────────────────────────────

/** Returns all `FieldConfig`s defined for the given phase. */
export function getPhaseFields(phase: InterviewPhase): FieldConfig[] {
  return PHASE_CONFIGS[phase].fieldGroups.flatMap((g) => g.fields);
}

/** Returns the dot-paths collected by the given phase. */
export function getPhaseDotPaths(phase: InterviewPhase): string[] {
  return getPhaseFields(phase).map((f) => f.dotPath);
}

/**
 * Phases that actually collect data (REVIEW and VALIDATION_COMPLETION are
 * pure presentation / validation phases — they have no field groups).
 */
export const DATA_PHASES: readonly InterviewPhase[] = [
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
] as const;

/** Returns true if the phase collects structured data (has field groups). */
export function isDataPhase(phase: InterviewPhase): boolean {
  return PHASE_CONFIGS[phase].fieldGroups.length > 0;
}

// ── Flatten / unflatten (profile ↔ react-hook-form) ───────────────────────

/**
 * Shape of a flat form record. Keys are dot-paths, values are the field
 * values in their canonical (typed) form. react-hook-form accepts this
 * shape via `useForm({ defaultValues })` and `form.watch()` / `form.getValues()`.
 */
export type FlatFormData = Record<string, unknown>;

/**
 * Pull the values for a single phase's fields out of the nested
 * `ProjectProfile` into a flat `{ "applicant.name": "Rajesh", ... }` map.
 *
 * - TEXT / ENUM / DATE → string (defaults to "")
 * - NUMBER / CURRENCY → number (defaults to 0)
 * - BOOLEAN → boolean (defaults to false)
 *
 * Machinery / raw-material items arrays are handled separately by the
 * wizard (list editor) and are NOT included in this flat map.
 */
export function profileToFormData(
  profile: ProjectProfile,
  phase: InterviewPhase,
): FlatFormData {
  const out: FlatFormData = {};
  for (const field of getPhaseFields(phase)) {
    if (field.dotPath === "machinery.items" || field.dotPath === "rawMaterials.items") {
      // Array fields are handled by a dedicated list editor.
      continue;
    }
    const raw = getFieldValue(profile, field.dotPath);
    out[field.dotPath] = normaliseForForm(raw, field);
  }
  return out;
}

/**
 * Merge a flat form record back into a nested `ProjectProfile`.
 *
 * Returns a NEW profile (immutable). Coerces string values back into the
 * correct runtime type for the field (e.g. NUMBER inputs become numbers).
 *
 * NOTE: this function trusts that the flat data was produced for the given
 * phase (i.e. only that phase's dot-paths are present). Other phases' data
 * in `baseProfile` is preserved unchanged.
 */
export function formDataToProfile(
  baseProfile: ProjectProfile,
  phase: InterviewPhase,
  formData: FlatFormData,
): ProjectProfile {
  let next = baseProfile;
  for (const field of getPhaseFields(phase)) {
    if (field.dotPath === "machinery.items" || field.dotPath === "rawMaterials.items") {
      continue;
    }
    if (!(field.dotPath in formData)) continue;
    const rawFormValue = formData[field.dotPath];
    const coerced = coerceFromForm(rawFormValue, field);
    next = setFieldValue(next, field.dotPath, coerced);
  }
  return next;
}

// ── Provenance helpers ────────────────────────────────────────────────────

/**
 * Stamp the provenance entry for a single field. Returns a NEW profile.
 * Matches the contract used by `InterviewStore.updateField` so the
 * resulting `provenance.perField[fieldPath].source` is identical to what
 * the AI interview would set for the same edit.
 */
export function stampFieldProvenance(
  profile: ProjectProfile,
  dotPath: string,
  source: "USER" | "KNOWLEDGE",
  knowledgeSource?: string,
): ProjectProfile {
  const existing: FieldProvenance =
    profile.provenance.perField[dotPath] ?? {
      source: null,
      verification: "UNVERIFIED",
    };
  const updated: FieldProvenance = {
    ...existing,
    source,
    verification: "UNVERIFIED",
    confirmedAt: undefined,
    knowledgeSource: source === "KNOWLEDGE" ? knowledgeSource : existing.knowledgeSource,
  };
  return {
    ...profile,
    provenance: {
      ...profile.provenance,
      perField: { ...profile.provenance.perField, [dotPath]: updated },
    },
  };
}

/**
 * Bulk-stamp provenance for every field collected by a phase. Used after
 * the user clicks "Next" on a phase to record the source of every value
 * just collected.
 */
export function stampPhaseProvenance(
  profile: ProjectProfile,
  phase: InterviewPhase,
  sourceForField: (dotPath: string) => "USER" | "KNOWLEDGE",
): ProjectProfile {
  let next = profile;
  for (const field of getPhaseFields(phase)) {
    next = stampFieldProvenance(next, field.dotPath, sourceForField(field.dotPath));
  }
  return next;
}

// ── Downstream invalidation (Project-Engine canEdit equivalent) ───────────

/**
 * When the user navigates BACK to an earlier phase and edits any field,
 * every downstream phase's `verification` must reset to UNVERIFIED. This
 * mirrors the Project Engine's monotonic `canEdit` rule: you may always go
 * back, but going back breaks the chain of CONFIRMED fields downstream.
 *
 * This function does NOT clear the values themselves — only the
 * verification marker. The user must walk forward again and re-confirm.
 */
export function invalidateDownstreamPhases(
  profile: ProjectProfile,
  fromPhaseExclusive: InterviewPhase,
): ProjectProfile {
  const startIdx = PHASE_ORDER.indexOf(fromPhaseExclusive);
  if (startIdx < 0) return profile;

  const downstreamPhases = PHASE_ORDER.slice(startIdx + 1);
  const downstreamDotPaths = new Set<string>();
  for (const phase of downstreamPhases) {
    for (const path of getPhaseDotPaths(phase)) {
      downstreamDotPaths.add(path);
    }
  }

  const newPerField: Record<string, FieldProvenance> = {};
  for (const [path, prov] of Object.entries(profile.provenance.perField)) {
    if (downstreamDotPaths.has(path) && prov.source !== null) {
      newPerField[path] = { ...prov, verification: "UNVERIFIED", confirmedAt: undefined };
    } else {
      newPerField[path] = prov;
    }
  }

  return {
    ...profile,
    provenance: { ...profile.provenance, perField: newPerField },
  };
}

/**
 * Return whether a phase is "complete" (every required field is filled).
 * Uses the same `isFieldFilled` semantics as the question planner:
 * a field is filled if provenance.source is non-null OR the value is
 * non-empty (string non-blank, number > 0, boolean always considered
 * unfilled unless provenance confirms, arrays length > 0).
 */
export function isPhaseComplete(
  profile: ProjectProfile,
  phase: InterviewPhase,
): boolean {
  for (const field of getPhaseFields(phase)) {
    if (!field.required) continue;
    if (!isFieldFilled(profile, field)) return false;
  }
  return true;
}

function isFieldFilled(profile: ProjectProfile, config: FieldConfig): boolean {
  const prov = profile.provenance.perField[config.dotPath];
  if (prov && prov.source !== null) return true;

  const value = getFieldValue(profile, config.dotPath);
  if (Array.isArray(value)) return value.length > 0;

  switch (config.type) {
    case "TEXT":
    case "ENUM":
    case "DATE":
      return typeof value === "string" && value.length > 0;
    case "NUMBER":
    case "CURRENCY":
      return typeof value === "number" && value > 0;
    case "BOOLEAN":
      return false;
    default:
      return value !== null && value !== undefined;
  }
}

// ── Coercion helpers ──────────────────────────────────────────────────────

/**
 * Convert a raw profile value into the form-friendly representation.
 * Empty/missing values become the field's "zero" so controlled inputs
 * never see `undefined`.
 */
function normaliseForForm(raw: unknown, field: FieldConfig): unknown {
  switch (field.type) {
    case "TEXT":
    case "ENUM":
    case "DATE":
      return typeof raw === "string" ? raw : "";
    case "NUMBER":
    case "CURRENCY":
      return typeof raw === "number" && !Number.isNaN(raw) ? raw : 0;
    case "BOOLEAN":
      return typeof raw === "boolean" ? raw : false;
    default:
      return raw ?? "";
  }
}

/**
 * Convert a form-input value back into the canonical runtime type for the
 * field. NUMBER/CURRENCY inputs come back as strings from `<input type="number">`
 * when empty — those become 0.
 */
function coerceFromForm(raw: unknown, field: FieldConfig): unknown {
  switch (field.type) {
    case "TEXT":
    case "ENUM":
    case "DATE":
      return typeof raw === "string" ? raw : String(raw ?? "");
    case "NUMBER":
    case "CURRENCY": {
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
      if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed === "") return 0;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    }
    case "BOOLEAN":
      return Boolean(raw);
    default:
      return raw;
  }
}

// ── Re-export PHASE_CONFIGS for the wizard ───────────────────────────────

export { PHASE_CONFIGS };
