// ─── Test Helper: createTestProfile ───────────────────────────────────────
// Returns a fully valid ProjectProfile with sensible defaults.
// Each test only overrides what it's testing via Partial<ProjectProfile>.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "@/shared/types/project-profile";
import type { InterviewPhase, PhaseProgress } from "@/shared/types/interview";
import type { ProvenanceMetadata, FieldProvenance } from "@/shared/types/provenance";

/** All 7 interview phases for the completion section. */
const ALL_PHASES: InterviewPhase[] = [
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
  "REVIEW",
  "VALIDATION_COMPLETION",
];

/** Create a blank PhaseProgress for every phase. */
function blankPhaseProgress(): Record<InterviewPhase, PhaseProgress> {
  const result = {} as Record<InterviewPhase, PhaseProgress>;
  for (const phase of ALL_PHASES) {
    result[phase] = { status: "NOT_STARTED", completedFields: 0, totalFields: 0 };
  }
  return result;
}

/** Build a ProvenanceMetadata where every listed field is CONFIRMED. */
export function createConfirmedProvenance(fields: string[]): ProvenanceMetadata {
  const perField: Record<string, FieldProvenance> = {};
  for (const field of fields) {
    perField[field] = { source: "USER", verification: "CONFIRMED", confirmedAt: "2024-01-01T00:00:00.000Z" };
  }
  return { perField, aggregate: 1.0 };
}

/** All mandatory field paths as declared by the Validation Engine. */
export const MANDATORY_FIELDS = [
  "applicant.name",
  "applicant.age",
  "applicant.gender",
  "applicant.category",
  "applicant.isWomen",
  "applicant.education",
  "applicant.entityType",
  "business.name",
  "business.description",
  "business.activityType",
  "business.sector",
  "business.subCategory",
  "location.state",
  "location.district",
  "location.area",
  "land.status",
  "capacity.installedCapacity.unit",
  "capacity.installedCapacity.value",
  "capacity.projectedCapacityUtil",
  "capacity.workingDaysPerMonth",
  "capacity.workingHoursPerDay",
  "capacity.shifts",
  "financials.machineryAndEquipment",
  "financials.totalFixedCapital",
  "financials.workingCapital",
  "financials.totalProjectCost",
  "financials.interestRate",
  "financials.loanTenureYears",
  "market.targetMarket",
] as const;

/** Simple deep merge — merges overrides into base recursively. */
function deepMerge<T extends object>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
  const rec = result as Record<string, unknown>;
  const baseRec = base as Record<string, unknown>;
  const overRec = overrides as Record<string, unknown>;
  for (const key of Object.keys(overRec)) {
    const val = overRec[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val) && typeof baseRec[key] === "object" && baseRec[key] !== null && !Array.isArray(baseRec[key])) {
      rec[key] = deepMerge(
        baseRec[key] as object,
        val as object,
      );
    } else {
      rec[key] = val;
    }
  }
  return result as T;
}

/** Return a fully valid, complete ProjectProfile. */
export function createTestProfile(overrides?: Partial<ProjectProfile>): ProjectProfile {
  const base: ProjectProfile = {
    applicant: {
      name: "Rajesh Kumar",
      age: 30,
      gender: "MALE",
      category: "GEN",
      isWomen: false,
      phone: "9876543210",
      email: "rajesh@example.com",
      education: "GRADUATE",
      entityType: "INDIVIDUAL",
      priorSubsidy: false,
      edpCompleted: false,
      experienceYears: 5,
    },
    business: {
      name: "Rajesh Pickle Unit",
      description: "Manufacturing of pickles and preserved foods",
      activityType: "MANUFACTURING",
      nicCode: "103005",
      nicDescription: "Manufacture of pickles, chutney etc.",
      sector: "MANUFACTURING",
      subCategory: "MANUFACTURING",
    },
    location: {
      state: "Maharashtra",
      district: "Pune",
      area: "URBAN",
      isHillBorderArea: false,
      isAspirationalDistrict: false,
    },
    land: {
      status: "RENTED",
      monthlyRent: 10000,
      buildingType: "RENTED",
    },
    capacity: {
      installedCapacity: { unit: "kg/month", value: 500 },
      projectedCapacityUtil: 70,
      workingDaysPerMonth: 25,
      workingHoursPerDay: 8,
      shifts: 1,
    },
    machinery: {
      items: [
        {
          name: "Stainless Steel Vat",
          quantity: 2,
          unitCost: 25000,
          totalCost: 50000,
          source: "USER" as const,
        },
      ],
      totalCost: 50000,
    },
    rawMaterials: {
      items: [
        {
          name: "Raw Mango",
          monthlyQuantity: 200,
          unit: "kg",
          unitRate: 80,
          totalMonthlyCost: 16000,
          source: "USER" as const,
        },
      ],
      totalMonthlyCost: 16000,
    },
    employees: {
      skilled: { male: 1, female: 0, monthlyWagePerPerson: 15000 },
      unskilled: { male: 2, female: 0, monthlyWagePerPerson: 8000 },
      administrative: { count: 1, monthlyWagePerPerson: 12000 },
      totalMonthlyWages: 43000,
      totalEmployment: 4,
    },
    utilities: {
      monthlyPowerCost: 5000,
      monthlyWaterCost: 2000,
      monthlyRentCost: 10000,
      monthlyMaintenanceCost: 3000,
      monthlyTransportCost: 4000,
      monthlyCommunicationCost: 1000,
      monthlyInsuranceCost: 2000,
      monthlyMiscCost: 2000,
      totalMonthlyOverheads: 29000,
    },
    financials: {
      machineryAndEquipment: 50000,
      otherFixedAssets: 10000,
      preOperativeExpenses: 5000,
      buildingAndCivilWorks: 20000,
      totalFixedCapital: 85000,
      workingCapital: 25000,
      totalProjectCost: 110000,
      interestRate: 12,
      loanTenureYears: 7,
      repaymentMoratoriumMonths: 6,
      projectedMonthlySales: 50000,
    },
    workingCapitalDetail: {
      rawMaterialDays: 30,
      workInProgressDays: 7,
      finishedGoodsDays: 15,
      creditorsDays: 15,
      method: "USER_PROVIDED",
    },
    market: {
      targetMarket: "Local retail shops and supermarkets in Pune city",
      sellingPricePerUnit: 200,
      sellingPriceUnit: "per kg",
    },
    attachments: { items: [] },
    validation: {
      completeness: 100,
      missingFields: [],
      errors: [],
      contradictions: [],
    },
    provenance: {
      perField: {},
      aggregate: 1.0,
    },
    completion: {
      currentPhase: "APPLICANT_DISCOVERY",
      phaseProgress: blankPhaseProgress(),
      startedAt: "2024-01-01T00:00:00.000Z",
      lastUpdatedAt: "2024-01-01T00:00:00.000Z",
      interactionCount: 0,
    },
  };

  if (!overrides) return base;
  return deepMerge(base, overrides);
}

/**
 * Create a profile where ALL mandatory fields are missing
 * (null / undefined / empty string / 0-for-non-totals).
 * Used to test completeness = 0.
 */
export function createEmptyProfile(): ProjectProfile {
  // We use type assertions to force null/undefined where the type says otherwise.
  // The validation engine accesses these dynamically.
  return {
    applicant: {
      name: "",
      age: 0,
      gender: "" as unknown as "MALE",
      category: "" as unknown as "GEN",
      isWomen: null as unknown as boolean,
      education: "" as unknown as "GRADUATE",
      entityType: "" as unknown as "INDIVIDUAL",
      priorSubsidy: null as unknown as boolean,
      edpCompleted: null as unknown as boolean,
    },
    business: {
      name: "",
      description: "",
      activityType: "" as unknown as "MANUFACTURING",
      sector: "" as unknown as "MANUFACTURING",
      subCategory: "" as unknown as "MANUFACTURING",
    },
    location: {
      state: "",
      district: "",
      area: "" as unknown as "URBAN",
      isHillBorderArea: false,
      isAspirationalDistrict: false,
    },
    land: { status: "" as unknown as "OWN" },
    capacity: {
      installedCapacity: { unit: "", value: 0 },
      projectedCapacityUtil: 0,
      workingDaysPerMonth: 0,
      workingHoursPerDay: 0,
      shifts: 0,
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
      monthlyPowerCost: 0, monthlyWaterCost: 0, monthlyRentCost: 0,
      monthlyMaintenanceCost: 0, monthlyTransportCost: 0,
      monthlyCommunicationCost: 0, monthlyInsuranceCost: 0, monthlyMiscCost: 0,
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
      loanTenureYears: 0,
      repaymentMoratoriumMonths: 6,
      projectedMonthlySales: 0,
    },
    workingCapitalDetail: {
      rawMaterialDays: 30, workInProgressDays: 7,
      finishedGoodsDays: 15, creditorsDays: 15,
      method: "USER_PROVIDED",
    },
    market: { targetMarket: "" },
    attachments: { items: [] },
    validation: { completeness: 0, missingFields: [], errors: [], contradictions: [] },
    provenance: { perField: {}, aggregate: 0 },
    completion: {
      currentPhase: "APPLICANT_DISCOVERY",
      phaseProgress: blankPhaseProgress(),
      startedAt: "2024-01-01T00:00:00.000Z",
      lastUpdatedAt: "2024-01-01T00:00:00.000Z",
      interactionCount: 0,
    },
  };
}