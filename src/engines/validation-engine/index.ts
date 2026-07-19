// ─── Validation Engine ──────────────────────────────────────────────────
// Pure business logic — NO UI, NO AI, NO I/O side effects.
// See doc 16 §2.3 — this engine owns only validation.* fields.
// Same input → always the same output. No mutations.
// ───────────────────────────────────────────────────────────────────────────

import type {
  ProjectProfile,
  ValidationError,
  Contradiction,
} from "../../shared/types/project-profile";
import type { FieldProvenance } from "../../shared/types/provenance";

// ── Public Result Type ──────────────────────────────────────────────────────

export interface ValidationResult {
  /** 0–100 percentage of mandatory fields that have a value. */
  completeness: number;
  /** Mandatory fields with no value (null / undefined / empty / 0 for non-totals). */
  missingFields: string[];
  /** Mandatory fields not yet CONFIRMED or VALIDATED in provenance. */
  nonEngineReadyMandatoryFields: string[];
  /** Business-rule violations (from the existing ValidationError type). */
  errors: ValidationError[];
  /** Cross-field consistency issues. */
  contradictions: Contradiction[];
  /** DATA GATE — true when all mandatory fields are filled and no errors. */
  canEnterReview: boolean;
  /** CONFIRMATION GATE — true when canEnterReview && all mandatory engine-ready. */
  canValidate: boolean;
  /** Weighted average provenance score across mandatory fields (0–1). */
  aggregateProvenance: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Project cost ceilings in whole rupees. */
const COST_CEILINGS: Record<string, number> = {
  MANUFACTURING: 50_00_000, // ₹50 Lakh
  SERVICE: 25_00_000, // ₹25 Lakh
};

const AGE_MIN = 18;
const AGE_MAX = 65;

/** Projects above this cost require at least 8TH_PASS education. */
const EDUCATION_THRESHOLD_COST = 10_00_000; // ₹10 Lakh

const MIN_EDUCATION_FOR_HIGH_COST = new Set<string>([
  "8TH_PASS",
  "10TH_PASS",
  "12TH_PASS",
  "GRADUATE",
  "POST_GRADUATE",
  "PROFESSIONAL",
  "OTHER",
]);

const INTEREST_RATE_MIN = 0;
const INTEREST_RATE_MAX = 30;

const LOAN_TENURE_MIN = 1;
const LOAN_TENURE_MAX = 15;

// ── Mandatory Field Paths (dot-notation) ────────────────────────────────────

const MANDATORY_FIELDS: readonly string[] = [
  // ── Applicant ──────────────────────────────────────────────────────────
  "applicant.name",
  "applicant.age",
  "applicant.gender",
  "applicant.category",
  "applicant.isWomen",
  "applicant.education",
  "applicant.entityType",

  // ── Business ───────────────────────────────────────────────────────────
  "business.name",
  "business.description",
  "business.activityType",
  "business.sector",
  "business.subCategory",

  // ── Location ───────────────────────────────────────────────────────────
  "location.state",
  "location.district",
  "location.area",

  // ── Land ───────────────────────────────────────────────────────────────
  "land.status",

  // ── Capacity ───────────────────────────────────────────────────────────
  "capacity.installedCapacity.unit",
  "capacity.installedCapacity.value",
  "capacity.projectedCapacityUtil",
  "capacity.workingDaysPerMonth",
  "capacity.workingHoursPerDay",
  "capacity.shifts",

  // ── Financials ─────────────────────────────────────────────────────────
  "financials.machineryAndEquipment",
  "financials.totalFixedCapital",
  "financials.workingCapital",
  "financials.totalProjectCost",
  "financials.interestRate",
  "financials.loanTenureYears",

  // ── Market ─────────────────────────────────────────────────────────────
  "market.targetMarket",
] as const;

/**
 * Numeric field paths representing computed totals / sums.
 * For these fields, 0 is a *valid* value (not treated as missing).
 * All other numeric mandatory fields treat 0 as missing.
 */
const TOTAL_FIELD_PATHS = new Set<string>([
  "financials.machineryAndEquipment",
  "financials.otherFixedAssets",
  "financials.totalFixedCapital",
  "financials.workingCapital",
  "financials.totalProjectCost",
  "financials.projectedMonthlySales",
  "machinery.totalCost",
  "rawMaterials.totalMonthlyCost",
  "employees.totalMonthlyWages",
  "employees.totalEmployment",
  "utilities.totalMonthlyOverheads",
]);

// ── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Traverse a nested object by dot-notation path.
 * Returns `undefined` if any segment along the path is null, undefined,
 * or a non-object primitive.
 */
function getFieldValue(profile: ProjectProfile, fieldPath: string): unknown {
  const parts = fieldPath.split(".");
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
 * Determine whether a field value counts as "missing".
 *
 * Missing = null | undefined | empty/whitespace-only string.
 * For numeric fields: 0 is ALSO missing UNLESS the field is a computed
 * total (listed in TOTAL_FIELD_PATHS).
 */
function isFieldMissing(value: unknown, fieldPath: string): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (
    typeof value === "number" &&
    value === 0 &&
    !TOTAL_FIELD_PATHS.has(fieldPath)
  ) {
    return true;
  }
  return false;
}

/**
 * Look up the provenance record for a dot-path field.
 * Returns `undefined` when no provenance entry exists.
 */
function getFieldProvenance(
  profile: ProjectProfile,
  fieldPath: string
): FieldProvenance | undefined {
  return profile.provenance?.perField?.[fieldPath];
}

/**
 * Compute a single field's provenance contribution (0–1).
 *
 * - source is null (or provenance absent) → 0
 * - verification is VALIDATED              → 1.0
 * - verification is CONFIRMED              → 1.0
 * - source is non-null, verification UNVERIFIED → 0.5
 */
function fieldProvenanceScore(
  provenance: FieldProvenance | undefined
): number {
  if (!provenance || provenance.source === null) return 0;
  if (
    provenance.verification === "VALIDATED" ||
    provenance.verification === "CONFIRMED"
  ) {
    return 1.0;
  }
  return 0.5;
}

/**
 * A field is "engine-ready" when its provenance verification is
 * CONFIRMED or VALIDATED.
 */
function isEngineReady(provenance: FieldProvenance | undefined): boolean {
  if (!provenance) return false;
  return (
    provenance.verification === "CONFIRMED" ||
    provenance.verification === "VALIDATED"
  );
}

// ── Business-Rule Checks ────────────────────────────────────────────────────

/**
 * Evaluate all business rules against the profile.
 * Returns arrays of `ValidationError` and `Contradiction` (existing types
 * — no extra fields).
 */
function runBusinessRules(profile: ProjectProfile): {
  errors: ValidationError[];
  contradictions: Contradiction[];
} {
  const errors: ValidationError[] = [];
  const contradictions: Contradiction[] = [];

  const { applicant, business, land, financials, machinery } = profile;

  // 1. Project cost ceiling ──────────────────────────────────────────────
  const ceiling = COST_CEILINGS[business.activityType];
  if (ceiling !== undefined && financials.totalProjectCost > ceiling) {
    errors.push({
      fieldPath: "financials.totalProjectCost",
      code: "COST_CEILING_EXCEEDED",
      message: `Total project cost ₹${financials.totalProjectCost.toLocaleString("en-IN")} exceeds the ${business.activityType.toLowerCase()} ceiling of ₹${ceiling.toLocaleString("en-IN")}.`,
    });
  }

  // 2. Age range (18–65) ─────────────────────────────────────────────────
  if (applicant.age < AGE_MIN || applicant.age > AGE_MAX) {
    errors.push({
      fieldPath: "applicant.age",
      code: "AGE_OUT_OF_RANGE",
      message: `Applicant age ${applicant.age} is outside the eligible range of ${AGE_MIN}–${AGE_MAX}.`,
    });
  }

  // 3. Education requirement for projects > ₹10 Lakh ─────────────────────
  if (
    financials.totalProjectCost > EDUCATION_THRESHOLD_COST &&
    !MIN_EDUCATION_FOR_HIGH_COST.has(applicant.education)
  ) {
    errors.push({
      fieldPath: "applicant.education",
      code: "INSUFFICIENT_EDUCATION",
      message: `Projects above ₹${EDUCATION_THRESHOLD_COST.toLocaleString("en-IN")} require a minimum education of 8TH_PASS.`,
    });
  }

  // 4. NIC code must be present for validation ────────────────────────────
  if (!business.nicCode || business.nicCode.trim() === "") {
    errors.push({
      fieldPath: "business.nicCode",
      code: "NIC_CODE_REQUIRED",
      message: "NIC code is required to validate the project.",
    });
  }

  // 5. Prior subsidy detail required when priorSubsidy = true ────────────
  if (
    applicant.priorSubsidy &&
    (!applicant.priorSubsidyDetail || applicant.priorSubsidyDetail.trim() === "")
  ) {
    errors.push({
      fieldPath: "applicant.priorSubsidyDetail",
      code: "PRIOR_SUBSIDY_DETAIL_REQUIRED",
      message:
        "Prior subsidy details are required when priorSubsidy is true.",
    });
  }

  // 6. EDP certificate required when edpCompleted = true ─────────────────
  if (
    applicant.edpCompleted &&
    (!applicant.edpCertificateNo || applicant.edpCertificateNo.trim() === "")
  ) {
    errors.push({
      fieldPath: "applicant.edpCertificateNo",
      code: "EDP_CERTIFICATE_REQUIRED",
      message:
        "EDP certificate number is required when EDP training is completed.",
    });
  }

  // 7. Entity registration required for non-INDIVIDUAL types ──────────────
  if (
    applicant.entityType !== "INDIVIDUAL" &&
    (!applicant.entityRegistrationNo ||
      applicant.entityRegistrationNo.trim() === "")
  ) {
    errors.push({
      fieldPath: "applicant.entityRegistrationNo",
      code: "ENTITY_REGISTRATION_REQUIRED",
      message: `Entity registration number is required for ${applicant.entityType} type.`,
    });
  }

  // 8. Interest rate reasonable (0–30 %) ─────────────────────────────────
  if (
    financials.interestRate < INTEREST_RATE_MIN ||
    financials.interestRate > INTEREST_RATE_MAX
  ) {
    errors.push({
      fieldPath: "financials.interestRate",
      code: "INTEREST_RATE_OUT_OF_RANGE",
      message: `Interest rate ${financials.interestRate}% is outside the reasonable range of ${INTEREST_RATE_MIN}–${INTEREST_RATE_MAX}%.`,
    });
  }

  // 9. Loan tenure reasonable (1–15 years) ───────────────────────────────
  if (
    financials.loanTenureYears < LOAN_TENURE_MIN ||
    financials.loanTenureYears > LOAN_TENURE_MAX
  ) {
    errors.push({
      fieldPath: "financials.loanTenureYears",
      code: "LOAN_TENURE_OUT_OF_RANGE",
      message: `Loan tenure of ${financials.loanTenureYears} year(s) is outside the reasonable range of ${LOAN_TENURE_MIN}–${LOAN_TENURE_MAX} years.`,
    });
  }

  // 10. Working capital must be non-negative ──────────────────────────────
  if (financials.workingCapital < 0) {
    errors.push({
      fieldPath: "financials.workingCapital",
      code: "WORKING_CAPITAL_NEGATIVE",
      message: "Working capital cannot be negative.",
    });
  }

  // 11. At least one machinery item ───────────────────────────────────────
  if (!machinery.items || machinery.items.length === 0) {
    errors.push({
      fieldPath: "machinery.items",
      code: "MACHINERY_REQUIRED",
      message: "At least one machinery/equipment item is required.",
    });
  }

  // 12. Land status consistency ──────────────────────────────────────────
  if (land.status === "OWN") {
    if (land.ownedLandValue === undefined || land.ownedLandValue === null) {
      contradictions.push({
        fields: ["land.status", "land.ownedLandValue"],
        description:
          "Land status is OWN but owned land value is not provided.",
      });
    }
  }

  if (land.status === "RENTED") {
    if (land.monthlyRent === undefined || land.monthlyRent === null) {
      contradictions.push({
        fields: ["land.status", "land.monthlyRent"],
        description:
          "Land status is RENTED but monthly rent is not provided.",
      });
    }
  }

  return { errors, contradictions };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a `ProjectProfile`.
 *
 * **Pure function** — same input always produces the same output.
 * No I/O, no side effects, no mutation of the input object.
 *
 * Computes completeness, missing fields, engine-readiness, business-rule
 * errors, contradictions, aggregate provenance, and two gate booleans
 * (`canEnterReview` and `canValidate`).
 */
export function validateProject(profile: ProjectProfile): ValidationResult {
  // ── 1. Mandatory-field presence check ──────────────────────────────────
  const missingFields: string[] = [];
  for (const fieldPath of MANDATORY_FIELDS) {
    const value = getFieldValue(profile, fieldPath);
    if (isFieldMissing(value, fieldPath)) {
      missingFields.push(fieldPath);
    }
  }

  // ── 2. Completeness percentage (0–100) ────────────────────────────────
  const total = MANDATORY_FIELDS.length;
  const filled = total - missingFields.length;
  const completeness = total > 0 ? Math.round((filled / total) * 100) : 100;

  // ── 3. Engine-readiness of filled mandatory fields ─────────────────────
  const nonEngineReadyMandatoryFields: string[] = [];
  for (const fieldPath of MANDATORY_FIELDS) {
    // Only consider fields that have a value
    if (missingFields.includes(fieldPath)) continue;
    const prov = getFieldProvenance(profile, fieldPath);
    if (!isEngineReady(prov)) {
      nonEngineReadyMandatoryFields.push(fieldPath);
    }
  }

  // ── 4. Business-rule validation ────────────────────────────────────────
  const { errors, contradictions } = runBusinessRules(profile);

  // ── 5. Aggregate provenance score (0–1) ───────────────────────────────
  //     Average across all mandatory fields that actually have a value.
  let provSum = 0;
  let provCount = 0;
  for (const fieldPath of MANDATORY_FIELDS) {
    if (missingFields.includes(fieldPath)) continue;
    const prov = getFieldProvenance(profile, fieldPath);
    provSum += fieldProvenanceScore(prov);
    provCount++;
  }
  const aggregateProvenance = provCount > 0 ? provSum / provCount : 0;

  // ── 6. Gate booleans ──────────────────────────────────────────────────
  // DATA GATE: every mandatory field is filled AND no business-rule errors.
  const canEnterReview = missingFields.length === 0 && errors.length === 0;

  // CONFIRMATION GATE: can enter review AND every mandatory field is
  // engine-ready (CONFIRMED or VALIDATED provenance).
  const canValidate =
    canEnterReview && nonEngineReadyMandatoryFields.length === 0;

  return {
    completeness,
    missingFields,
    nonEngineReadyMandatoryFields,
    errors,
    contradictions,
    canEnterReview,
    canValidate,
    aggregateProvenance,
  };
}