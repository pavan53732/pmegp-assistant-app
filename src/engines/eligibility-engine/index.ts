// ─── Eligibility Engine ────────────────────────────────────────────────────
// Determines PMEGP eligibility based on category, age, education, project
// cost ceiling, negative list, prior assistance, and entity type.
//
// Pure, deterministic function.  Same input → same output.
// NO AI, NO I/O, NO network calls.
// "AI never calculates" — this engine never imports the AI layer.
//
// All scheme thresholds are injected via SchemeParams from the Knowledge
// Engine (DESIGN_PRINCIPLES §12).  No hardcoded PMEGP values.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile, Education, EntityType } from "@/shared/types/project-profile";
import {
  AGE_LIMITS,
  COST_CEILINGS,
  EDUCATION_RANK,
  MIN_EDUCATION_RANK_FOR_HIGH_COST,
  EDUCATION_THRESHOLD,
  PERMITTED_ENTITY_TYPES,
  isNegativeList,
  SCHEME_VERSION,
  SCHEME_SOURCE,
} from "../knowledge-engine/scheme-params";

// ── Public Types ───────────────────────────────────────────────────────────

export interface EligibilityCheck {
  criterionId: string;
  label: string;
  passed: boolean;
  actual?: string | number;
  required?: string | number;
  reason: string;
  source: { clause: string; version: string };
}

export interface EligibilityResult {
  eligible: boolean;
  asOfDate: string;
  scheme: string;
  checks: EligibilityCheck[];
  blockers: string[];
  warnings: string[];
}

export interface EligibilityInput {
  asOfDate: string; // ISO date; caller supplies, engine never reads clock
  scheme: string;   // scheme key — engine is scheme-parameterized
  profile: ProjectProfile;
}

// ── Formatting Helpers ─────────────────────────────────────────────────────

/** Format a whole-rupee number in Indian notation (e.g. "₹25,00,000"). */
function formatRupees(amount: number): string {
  const str = Math.abs(amount).toString();
  if (str.length <= 3) return `₹${amount.toLocaleString("en-IN")}`;
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `₹${amount < 0 ? "-" : ""}${formatted}`;
}

/** Human-readable label for an Education enum value. */
function educationLabel(edu: Education): string {
  const labels: Record<Education, string> = {
    NONE: "None",
    BELOW_8TH: "Below 8th pass",
    "8TH_PASS": "8th pass",
    "10TH_PASS": "10th pass",
    "12TH_PASS": "12th pass",
    GRADUATE: "Graduate",
    POST_GRADUATE: "Post-graduate",
    PROFESSIONAL: "Professional degree/diploma",
    OTHER: "Other qualification",
  };
  return labels[edu];
}

/** Human-readable label for an EntityType enum value. */
function entityTypeLabel(type: EntityType): string {
  const labels: Record<EntityType, string> = {
    INDIVIDUAL: "Individual",
    SHG: "Self-Help Group (SHG)",
    TRUST: "Trust",
    SOCIETY: "Society",
    COOP: "Co-operative Society",
    PARTNERSHIP: "Partnership Firm",
    LLP: "Limited Liability Partnership (LLP)",
    PRIVATE_LIMITED: "Private Limited Company",
  };
  return labels[type];
}

/** Build a source citation for auditability. */
function cite(clause: string): { clause: string; version: string } {
  return { clause, version: `${SCHEME_SOURCE} v${SCHEME_VERSION}` };
}

// ── Individual Check Functions ─────────────────────────────────────────────

function checkAgeMin(input: EligibilityInput): EligibilityCheck {
  const age = input.profile.applicant.age;
  const passed = age >= AGE_LIMITS.MIN;
  return {
    criterionId: "age.min",
    label: "Minimum age requirement",
    passed,
    actual: age,
    required: `>= ${AGE_LIMITS.MIN} years`,
    reason: passed
      ? `Applicant age (${age}) meets the minimum age requirement of ${AGE_LIMITS.MIN} years.`
      : `Applicant age (${age}) is below the minimum age requirement of ${AGE_LIMITS.MIN} years.`,
    source: cite("Age eligibility clause"),
  };
}

function checkAgeMax(input: EligibilityInput): EligibilityCheck {
  const age = input.profile.applicant.age;
  const passed = age <= AGE_LIMITS.MAX;
  return {
    criterionId: "age.max",
    label: "Maximum age requirement",
    passed,
    actual: age,
    required: `<= ${AGE_LIMITS.MAX} years`,
    reason: passed
      ? `Applicant age (${age}) is within the maximum age limit of ${AGE_LIMITS.MAX} years.`
      : `Applicant age (${age}) exceeds the maximum age limit of ${AGE_LIMITS.MAX} years.`,
    source: cite("Age eligibility clause"),
  };
}

function checkPriorSubsidy(input: EligibilityInput): EligibilityCheck {
  const prior = input.profile.applicant.priorSubsidy;
  const passed = !prior;
  return {
    criterionId: "applicant.prior-assistance",
    label: "No prior government subsidy",
    passed,
    actual: prior ? "Yes — has availed subsidy" : "No — first-time applicant",
    required: "No prior PMEGP/PMRY/other subsidy",
    reason: passed
      ? "Applicant has not availed any prior government subsidy."
      : `Applicant has availed a prior subsidy (${input.profile.applicant.priorSubsidyDetail || "details not provided"}).`,
    source: cite("One-time assistance clause"),
  };
}

function checkEntityType(input: EligibilityInput): EligibilityCheck {
  const type = input.profile.applicant.entityType;
  const passed = PERMITTED_ENTITY_TYPES.includes(type);
  return {
    criterionId: "applicant.entity-type",
    label: "Permitted entity type",
    passed,
    actual: entityTypeLabel(type),
    required: PERMITTED_ENTITY_TYPES.map(entityTypeLabel).join(", "),
    reason: passed
      ? `${entityTypeLabel(type)} is a permitted entity type under the scheme.`
      : `${entityTypeLabel(type)} is NOT a permitted entity type. Only ${PERMITTED_ENTITY_TYPES.map(entityTypeLabel).join(", ")} are eligible.`,
    source: cite("Entity type eligibility clause"),
  };
}

function checkActivityNegativeList(input: EligibilityInput): EligibilityCheck {
  const nic = input.profile.business.nicCode;
  if (!nic) {
    return {
      criterionId: "activity.negative-list",
      label: "Activity not on negative list",
      passed: false,
      reason: "NIC code not provided — cannot verify negative list.",
      source: cite("Negative list clause"),
    };
  }
  const negative = isNegativeList(nic);
  const passed = !negative;
  return {
    criterionId: "activity.negative-list",
    label: "Activity not on negative list",
    passed,
    actual: negative ? negative.description : "Not listed",
    required: "Activity must not be on the excluded list",
    reason: passed
      ? `NIC code ${nic} is not on the negative list.`
      : `NIC code ${nic} (${negative?.description}) is on the negative list: ${negative?.reason}.`,
    source: cite("Negative list clause"),
  };
}

function checkCostCeiling(input: EligibilityInput): EligibilityCheck {
  const activityType = input.profile.business.activityType;
  const cost = input.profile.financials.totalProjectCost;
  const ceiling = COST_CEILINGS[activityType] ?? COST_CEILINGS.SERVICE;
  const passed = cost <= ceiling;
  return {
    criterionId: "cost.ceiling",
    label: "Project cost within scheme ceiling",
    passed,
    actual: formatRupees(cost),
    required: `<= ${formatRupees(ceiling)} for ${activityType}`,
    reason: passed
      ? `Project cost ${formatRupees(cost)} is within the ${activityType} ceiling of ${formatRupees(ceiling)}.`
      : `Project cost ${formatRupees(cost)} exceeds the ${activityType} ceiling of ${formatRupees(ceiling)}.`,
    source: cite("Project cost ceiling clause"),
  };
}

function checkEducation(input: EligibilityInput): EligibilityCheck {
  const education = input.profile.applicant.education;
  const cost = input.profile.financials.totalProjectCost;
  const rank = EDUCATION_RANK[education] ?? -1;
  const highCost = cost > EDUCATION_THRESHOLD.HIGH_COST;
  const passed = !highCost || rank >= MIN_EDUCATION_RANK_FOR_HIGH_COST;

  return {
    criterionId: "education",
    label: "Minimum education requirement",
    passed,
    actual: educationLabel(education),
    required: highCost ? "At least 8th pass for projects above ₹10,00,000" : "No minimum for projects below ₹10,00,000",
    reason: passed
      ? highCost
        ? `Education (${educationLabel(education)}) meets the minimum requirement for high-cost projects.`
        : `Project cost is below ₹10,00,000; no minimum education requirement applies.`
      : `Education (${educationLabel(education)}) does not meet the minimum requirement for projects above ₹10,00,000.`,
    source: cite("Education eligibility clause"),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Evaluate PMEGP eligibility for a project profile.
 *
 * @param input — structured input with asOfDate, scheme key, and profile
 * @returns EligibilityResult with per-criterion checks, blockers, warnings
 *
 * Deterministic: same input → same output.  No side effects.
 */
export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const checks: EligibilityCheck[] = [
    checkAgeMin(input),
    checkAgeMax(input),
    checkPriorSubsidy(input),
    checkEntityType(input),
    checkActivityNegativeList(input),
    checkCostCeiling(input),
    checkEducation(input),
  ];

  const blockers = checks.filter((c) => !c.passed).map((c) => c.criterionId);
  const warnings: string[] = [];

  // Soft warnings
  if (input.profile.applicant.education === "OTHER") {
    warnings.push("education.self-declared");
  }

  const eligible = blockers.length === 0;

  return {
    eligible,
    asOfDate: input.asOfDate,
    scheme: input.scheme,
    checks,
    blockers,
    warnings,
  };
}

// ── Backward-Compatible Wrapper ────────────────────────────────────────────

/**
 * Convenience wrapper that calls evaluateEligibility with default asOfDate
 * and scheme.  Maintains backward compatibility with existing callers.
 *
 * @deprecated Use evaluateEligibility({ asOfDate, scheme, profile }) for new code.
 */
export function checkEligibility(profile: ProjectProfile): EligibilityResult {
  return evaluateEligibility({
    asOfDate: new Date().toISOString().split("T")[0],
    scheme: "PMEGP",
    profile,
  });
}
