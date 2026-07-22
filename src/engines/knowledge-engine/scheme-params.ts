// ─── Scheme Parameters ───────────────────────────────────────────────────
// Centralized, knowledge-driven scheme configuration.
// All engines import constants from here — NEVER hardcode scheme values.
// See DESIGN_PRINCIPLES §12 (scheme-parameterized).
// ───────────────────────────────────────────────────────────────────────────

import type { ActivityType, ApplicantCategory, UrbanRural } from "@/shared/types/project-profile";
import subsidyMatrixData from "../../knowledge-package/data/pmegp_subsidy_matrix.json";
import negativeListData from "../../knowledge-package/data/pmegp_negative_list.json";

// ── Version & Source Provenance ────────────────────────────────────────────

export const SCHEME_VERSION = subsidyMatrixData.version ?? "1.0";
export const SCHEME_SOURCE = subsidyMatrixData.source ?? "PMEGP Guidelines";

// ── Cost Ceilings ──────────────────────────────────────────────────────────

export interface CostCeilings {
  MANUFACTURING: number;
  SERVICE: number;
}

export const COST_CEILINGS: CostCeilings = {
  MANUFACTURING: (subsidyMatrixData.notes?.manufacturingCeiling as number) ?? 50_00_000,
  SERVICE: (subsidyMatrixData.notes?.serviceCeiling as number) ?? 25_00_000,
};

// ── Age Limits ─────────────────────────────────────────────────────────────

export const AGE_LIMITS = {
  MIN: 18,
  MAX: 65,
};

// ── Education Requirements ─────────────────────────────────────────────────

export const EDUCATION_THRESHOLD = {
  HIGH_COST: 10_00_000, // ₹10L — projects above this need 8th pass minimum
  MIN_EDUCATION_FOR_HIGH_COST: [
    "8TH_PASS",
    "10TH_PASS",
    "12TH_PASS",
    "GRADUATE",
    "POST_GRADUATE",
    "PROFESSIONAL",
    "OTHER",
  ] as const,
};

// ── Interest & Loan Limits ─────────────────────────────────────────────────

export const INTEREST_RATE_LIMITS = {
  MIN: 0,
  MAX: 30,
};

export const LOAN_TENURE_LIMITS = {
  MIN: 1,
  MAX: 15,
};

// ── Subsidy Matrix Lookup ──────────────────────────────────────────────────

export interface SubsidyEntry {
  category: string;
  area: UrbanRural;
  subsidyRate: number; // percentage of bank finance
  maxProjectCost: number;
  ownContributionPercent: number;
}

const matrix = (subsidyMatrixData.matrix ?? []) as Array<{
  category: string;
  area: string;
  subsidyRate: number;
  maxProjectCost: number;
  ownContributionPercent: number;
  specialCategories?: string[];
}>;

/**
 * Look up the subsidy entry for a given applicant category + area.
 * Special categories (SC, ST, OBC, etc.) are mapped to the SPECIAL row.
 */
export function getSubsidyEntry(
  category: ApplicantCategory,
  area: UrbanRural
): SubsidyEntry | undefined {
  const isSpecial =
    category !== "GEN" &&
    matrix.some((row) =>
      row.specialCategories?.includes(category)
    );

  const searchCategory = isSpecial ? "SPECIAL" : "GENERAL";
  const row = matrix.find(
    (r) => r.category === searchCategory && r.area === area
  );

  if (!row) return undefined;

  return {
    category: searchCategory,
    area,
    subsidyRate: row.subsidyRate,
    maxProjectCost: row.maxProjectCost,
    ownContributionPercent: row.ownContributionPercent,
  };
}

/**
 * Get the cost ceiling for an activity type.
 */
export function getCostCeiling(activityType: ActivityType): number {
  return COST_CEILINGS[activityType] ?? COST_CEILINGS.SERVICE;
}

// ── Negative List ──────────────────────────────────────────────────────────

export interface NegativeListItem {
  nicCode: string;
  description: string;
  reason: string;
}

export const NEGATIVE_LIST: NegativeListItem[] = (
  negativeListData.excludedActivities ?? []
).map((item: { nicCode: string; description: string; reason: string }) => ({
  nicCode: item.nicCode,
  description: item.description,
  reason: item.reason,
}));

/**
 * Check if a NIC code is on the negative list.
 */
export function isNegativeList(nicCode: string): NegativeListItem | undefined {
  return NEGATIVE_LIST.find((item) => item.nicCode === nicCode);
}

// ── Permitted Entity Types ─────────────────────────────────────────────────

import type { EntityType } from "@/shared/types/project-profile";

/**
 * Entity types eligible for PMEGP subsidy.
 * LLP and PRIVATE_LIMITED are NOT eligible.
 */
export const PERMITTED_ENTITY_TYPES: EntityType[] = [
  "INDIVIDUAL",
  "SHG",
  "TRUST",
  "SOCIETY",
  "COOP",
  "PARTNERSHIP",
];

// ── Education Ranking ──────────────────────────────────────────────────────

export const EDUCATION_RANK: Record<string, number> = {
  NONE: 0,
  BELOW_8TH: 1,
  "8TH_PASS": 2,
  "10TH_PASS": 3,
  "12TH_PASS": 4,
  GRADUATE: 5,
  POST_GRADUATE: 6,
  PROFESSIONAL: 7,
};

export const MIN_EDUCATION_RANK_FOR_HIGH_COST = EDUCATION_RANK["8TH_PASS"];
