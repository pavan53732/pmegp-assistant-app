// ─── Eligibility Engine ────────────────────────────────────────────────────
// Determines PMEGP eligibility based on category, age, education, project
// cost ceiling, negative list, prior assistance, and entity type.
//
// Pure, deterministic function.  Same input → same output.
// NO AI, NO I/O, NO network calls.
// "AI never calculates" — this engine never imports the AI layer.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile, Education, EntityType } from "@/shared/types/project-profile";

// ── Public Types ───────────────────────────────────────────────────────────

export interface EligibilityCheck {
  criterionId: string;
  label: string;
  passed: boolean;
  actual?: string | number;
  required?: string | number;
  reason: string;
}

export interface EligibilityResult {
  eligible: boolean;
  checks: EligibilityCheck[];
  blockers: string[];
  warnings: string[];
}

// ── PMEGP Scheme Constants ─────────────────────────────────────────────────

const MIN_AGE = 18;
const MAX_AGE = 65;

/** Cost ceilings in whole rupees. */
const COST_CEILING: Record<string, number> = {
  MANUFACTURING: 50_00_000, // ₹50,00,000
  SERVICE: 25_00_000,       // ₹25,00,000
};

/**
 * Education levels ordered from lowest to highest qualification.
 * Index 0 = none, index increases with higher qualification.
 * "OTHER" is excluded from ordering — handled separately.
 */
const EDUCATION_RANK: Record<string, number> = {
  NONE: 0,
  BELOW_8TH: 1,
  "8TH_PASS": 2,
  "10TH_PASS": 3,
  "12TH_PASS": 4,
  GRADUATE: 5,
  POST_GRADUATE: 6,
  PROFESSIONAL: 7,
};

const MIN_EDUCATION_RANK_FOR_HIGH_COST = EDUCATION_RANK["8TH_PASS"];
const HIGH_COST_THRESHOLD = 10_00_000; // ₹10,00,000

/**
 * Entity types permitted under PMEGP.
 * LLP and PRIVATE_LIMITED are not eligible for PMEGP subsidy.
 */
const PERMITTED_ENTITY_TYPES: EntityType[] = [
  "INDIVIDUAL",
  "SHG",
  "TRUST",
  "SOCIETY",
  "COOP",
  "PARTNERSHIP",
];

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

// ── Individual Check Functions ──────────────────────────────────────────────

function checkAgeMin(profile: ProjectProfile): EligibilityCheck {
  const age = profile.applicant.age;
  const passed = age >= MIN_AGE;
  return {
    criterionId: "age.min",
    label: "Minimum age requirement",
    passed,
    actual: age,
    required: `>= ${MIN_AGE} years`,
    reason: passed
      ? `Applicant age (${age}) meets the minimum age requirement of ${MIN_AGE} years.`
      : `Applicant age (${age}) is below the minimum age requirement of ${MIN_AGE} years.`,
  };
}

function checkAgeMax(profile: ProjectProfile): EligibilityCheck {
  const age = profile.applicant.age;
  const passed = age <= MAX_AGE;
  return {
    criterionId: "age.max",
    label: "Maximum age requirement",
    passed,
    actual: age,
    required: `<= ${MAX_AGE} years`,
    reason: passed
      ? `Applicant age (${age}) is within the maximum age limit of ${MAX_AGE} years.`
      : `Applicant age (${age}) exceeds the maximum age limit of ${MAX_AGE} years.`,
  };
}

function checkNegativeList(profile: ProjectProfile): EligibilityCheck {
  // The negative_list.json is currently empty. This check always passes.
  // When the negative list is populated, matching would occur by NIC code
  // or keyword against the business description / NIC code.
  const nicCode = profile.business.nicCode ?? "not yet resolved";
  const description = profile.business.nicDescription ?? profile.business.description;

  return {
    criterionId: "activity.negative-list",
    label: "Activity not on negative list",
    passed: true,
    actual: `NIC ${nicCode} — ${description}`,
    reason:
      "No negative list entries are currently configured. " +
      "This check will be enforced when the negative list is populated with excluded NIC codes or activity keywords.",
  };
}

function checkCostCeiling(profile: ProjectProfile): EligibilityCheck {
  const activityType = profile.business.activityType;
  const totalCost = profile.financials.totalProjectCost;
  const ceiling = COST_CEILING[activityType] ?? 25_00_000;
  const passed = totalCost <= ceiling;

  return {
    criterionId: "cost.ceiling",
    label: "Project cost within ceiling",
    passed,
    actual: formatRupees(totalCost),
    required: `<= ${formatRupees(ceiling)} (${activityType})`,
    reason: passed
      ? `Total project cost (${formatRupees(totalCost)}) is within the ${activityType.toLowerCase()} ceiling of ${formatRupees(ceiling)}.`
      : `Total project cost (${formatRupees(totalCost)}) exceeds the ${activityType.toLowerCase()} ceiling of ${formatRupees(ceiling)} by ${formatRupees(totalCost - ceiling)}.`,
  };
}

function checkPriorAssistance(profile: ProjectProfile): EligibilityCheck {
  const priorSubsidy = profile.applicant.priorSubsidy;
  const passed = !priorSubsidy;

  return {
    criterionId: "applicant.prior-assistance",
    label: "No prior PMEGP/PMRY subsidy",
    passed,
    actual: priorSubsidy ? "Yes — prior subsidy availed" : "No prior subsidy",
    required: "No prior PMEGP or PMRY subsidy",
    reason: passed
      ? "Applicant has not availed PMEGP or PMRY subsidy previously."
      : `Applicant has previously availed PMEGP/PMRY subsidy${profile.applicant.priorSubsidyDetail ? ` (${profile.applicant.priorSubsidyDetail})` : ""}. This makes them ineligible for a fresh PMEGP subsidy.`,
  };
}

function checkEntityType(profile: ProjectProfile): EligibilityCheck {
  const entityType = profile.applicant.entityType;
  const passed = PERMITTED_ENTITY_TYPES.includes(entityType);

  return {
    criterionId: "applicant.entity-type",
    label: "Permitted entity type",
    passed,
    actual: entityTypeLabel(entityType),
    required: PERMITTED_ENTITY_TYPES.map(entityTypeLabel).join(", "),
    reason: passed
      ? `Entity type "${entityTypeLabel(entityType)}" is permitted under PMEGP.`
      : `Entity type "${entityTypeLabel(entityType)}" is not permitted under PMEGP. Only ${PERMITTED_ENTITY_TYPES.map(entityTypeLabel).join(", ")} are eligible.`,
  };
}

function checkEducation(profile: ProjectProfile): EligibilityCheck {
  const education = profile.applicant.education;
  const totalCost = profile.financials.totalProjectCost;
  const isHighCost = totalCost > HIGH_COST_THRESHOLD;

  // "OTHER" education — cannot rank automatically. If high-cost project, it's a warning
  // asking for manual review rather than a hard fail, since the actual qualification
  // may be at or above 8th pass.
  if (education === "OTHER") {
    return {
      criterionId: "education",
      label: "Education qualification",
      passed: !isHighCost,
      actual: `Other (${profile.applicant.educationDetail ?? "detail not specified"})`,
      required: isHighCost ? "At least 8th pass (for projects above " + formatRupees(HIGH_COST_THRESHOLD) + ")" : "No minimum for projects up to " + formatRupees(HIGH_COST_THRESHOLD),
      reason: isHighCost
        ? "Education marked as 'Other'. Manual verification required to confirm qualification is at least 8th pass for projects exceeding " + formatRupees(HIGH_COST_THRESHOLD) + "."
        : "Education marked as 'Other' — acceptable for projects up to " + formatRupees(HIGH_COST_THRESHOLD) + ".",
    };
  }

  // Not a high-cost project — education check is not a hard requirement.
  if (!isHighCost) {
    return {
      criterionId: "education",
      label: "Education qualification",
      passed: true,
      actual: educationLabel(education),
      required: "No minimum for projects up to " + formatRupees(HIGH_COST_THRESHOLD),
      reason: `Project cost (${formatRupees(totalCost)}) is within ${formatRupees(HIGH_COST_THRESHOLD)}, so no minimum education qualification is required. Applicant education: ${educationLabel(education)}.`,
    };
  }

  // High-cost project — education must be >= 8TH_PASS.
  const rank = EDUCATION_RANK[education] ?? -1;
  const passed = rank >= MIN_EDUCATION_RANK_FOR_HIGH_COST;

  return {
    criterionId: "education",
    label: "Education qualification",
    passed,
    actual: educationLabel(education),
    required: "At least 8th pass (for projects above " + formatRupees(HIGH_COST_THRESHOLD) + ")",
    reason: passed
      ? `Applicant education (${educationLabel(education)}) meets the minimum requirement of 8th pass for projects above ${formatRupees(HIGH_COST_THRESHOLD)}.`
      : `Applicant education (${educationLabel(education)}) does not meet the minimum requirement of 8th pass for projects above ${formatRupees(HIGH_COST_THRESHOLD)}.`,
  };
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Evaluate all PMEGP eligibility criteria against the given ProjectProfile.
 *
 * Pure function — same input always produces the same output.
 * Returns ALL checks (passing and failing) so the UI and DPR can render
 * a complete eligibility statement.
 *
 * Criteria evaluated:
 *   1. age.min          — Applicant age >= 18 (hard)
 *   2. age.max          — Applicant age <= 65 (hard)
 *   3. activity.negative-list — Not on the negative list (hard when match found)
 *   4. cost.ceiling     — Total project cost within sector ceiling (hard)
 *   5. applicant.prior-assistance — No prior PMEGP/PMRY subsidy (hard for NEW)
 *   6. applicant.entity-type — Entity type is permitted (hard)
 *   7. education        — For projects > ₹10L, education >= 8th pass (hard)
 */
export function checkEligibility(profile: ProjectProfile): EligibilityResult {
  const checks: EligibilityCheck[] = [
    checkAgeMin(profile),
    checkAgeMax(profile),
    checkNegativeList(profile),
    checkCostCeiling(profile),
    checkPriorAssistance(profile),
    checkEntityType(profile),
    checkEducation(profile),
  ];

  // A check is a "blocker" when it fails and the criterion is hard.
  // All seven criteria are hard under PMEGP.
  const blockers = checks
    .filter((c) => !c.passed)
    .map((c) => `${c.label}: ${c.reason}`);

  // Warnings are soft signals — none of the current criteria produce warnings,
  // but the structure is preserved for future use (e.g. EDP not completed).
  const warnings: string[] = [];

  // No EDP certificate is a warning, not a blocker
  if (!profile.applicant.edpCompleted) {
    warnings.push(
      "EDP (Entrepreneurship Development Programme) training has not been completed. " +
        "This is recommended but not a hard eligibility requirement."
    );
  }

  return {
    eligible: blockers.length === 0,
    checks,
    blockers,
    warnings,
  };
}