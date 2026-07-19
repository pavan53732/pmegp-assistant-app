// ─── Structured Project Profile ────────────────────────────────────────────
// The canonical data contract between the interview layer and every
// downstream engine. See doc 16 §2.
//
// Both the AI interview and guided forms produce an identical instance
// of this object. Downstream engines consume ONLY this object.
//
// Money fields are always integer (whole rupees). Never float.
// ───────────────────────────────────────────────────────────────────────────

import type { FieldProvenance, ProvenanceMetadata } from "./provenance";
import type { InterviewPhase, PhaseProgress } from "./interview";
import type { ItemSource } from "./state-machine";

// ── Applicant ─────────────────────────────────────────────────────────────

export type Gender = "MALE" | "FEMALE" | "OTHER";

export type ApplicantCategory =
  | "GEN"
  | "SC"
  | "ST"
  | "OBC"
  | "MINORITY"
  | "EX_SERVICEMEN"
  | "PH"
  | "NER";

export type Education =
  | "NONE"
  | "BELOW_8TH"
  | "8TH_PASS"
  | "10TH_PASS"
  | "12TH_PASS"
  | "GRADUATE"
  | "POST_GRADUATE"
  | "PROFESSIONAL"
  | "OTHER";

export type EntityType =
  | "INDIVIDUAL"
  | "SHG"
  | "TRUST"
  | "SOCIETY"
  | "COOP"
  | "PARTNERSHIP"
  | "LLP"
  | "PRIVATE_LIMITED";

export interface Applicant {
  name: string;
  age: number;
  gender: Gender;
  category: ApplicantCategory;
  /** Derived from gender; stored for subsidy calculation. */
  isWomen: boolean;
  phone?: string;
  email?: string;
  education: Education;
  /** Free text when education is "OTHER". */
  educationDetail?: string;
  entityType: EntityType;
  entityRegistrationNo?: string;
  /** Stored encrypted, masked in logs/prompts. */
  aadhaarNo?: string;
  panNo?: string;
  /** Has the applicant availed PMEGP/PMRY/other govt subsidy before? */
  priorSubsidy: boolean;
  priorSubsidyDetail?: string;
  /** Has EDP (Entrepreneurship Development Programme) training been completed? */
  edpCompleted: boolean;
  edpCertificateNo?: string;
  experienceYears?: number;
  experienceDetail?: string;
}

// ── Business ──────────────────────────────────────────────────────────────

export type ActivityType = "MANUFACTURING" | "SERVICE";

export type Sector = "MANUFACTURING" | "SERVICE";

export type SubCategory = "MANUFACTURING" | "SERVICE" | "TRADING" | "TRANSPORT";

export interface Business {
  /** Proposed unit/project name. */
  name: string;
  /** What the beneficiary wants to do, in their words. */
  description: string;
  /** Fixed after activity resolution (Phase 3). */
  activityType: ActivityType;
  /** 6-digit NIC code. Fixed after activity resolution. */
  nicCode?: string;
  /** Human-readable NIC label. Fixed after activity resolution. */
  nicDescription?: string;
  /** Derived from NIC code. Fixed after activity resolution. */
  sector: Sector;
  /** Derived from NIC code. Fixed after activity resolution. */
  subCategory: SubCategory;
}

// ── Location ──────────────────────────────────────────────────────────────

export type UrbanRural = "URBAN" | "RURAL";

export type IndustrialAreaType =
  | "INDUSTRIAL_ESTATE"
  | "SEZ"
  | "CLUSTER"
  | "DAC"
  | "OTHER";

export interface Location {
  state: string;
  district: string;
  mandal?: string;
  village?: string;
  pinCode?: string;
  area: UrbanRural;
  premisesAddress?: string;
  /** Hill & Border Area — affects subsidy categorization. */
  isHillBorderArea: boolean;
  /** Aspirational District. */
  isAspirationalDistrict: boolean;
  industrialAreaName?: string;
  industrialAreaType?: IndustrialAreaType | null;
}

// ── Land ──────────────────────────────────────────────────────────────────

export type LandStatus = "OWN" | "RENTED" | "LEASED" | "NONE" | "FAMILY";

export type BuildingType = "OWN" | "RENTED" | "CONSTRUCT";

export interface Land {
  status: LandStatus;
  areaSqFt?: number;
  areaSqMt?: number;
  /** In rupees — for project cost. */
  ownedLandValue?: number;
  /** In rupees — monthly. */
  monthlyRent?: number;
  /** In rupees. */
  leaseAmount?: number;
  leaseYears?: number;
  buildingType?: BuildingType;
  buildingAreaSqFt?: number;
  /** In rupees — for project cost. */
  constructionCost?: number;
}

// ── Capacity & Production ─────────────────────────────────────────────────

export interface InstalledCapacity {
  /** e.g. "kg/month", "units/month", "litres/day". */
  unit: string;
  value: number;
}

export interface Capacity {
  installedCapacity: InstalledCapacity;
  /** Percentage, typically 60-80%. */
  projectedCapacityUtil: number;
  /** Typically 25-26. */
  workingDaysPerMonth: number;
  /** Typically 8. */
  workingHoursPerDay: number;
  /** 1, 2, or 3. */
  shifts: number;
}

// ── Machinery & Equipment ─────────────────────────────────────────────────

export interface MachineryItem {
  name: string;
  specification?: string;
  quantity: number;
  /** In rupees. */
  unitCost: number;
  /** quantity × unitCost. In rupees. */
  totalCost: number;
  supplier?: string;
  /** Links to attachment if OCR'd quotation exists. */
  quotationRef?: string;
  source: ItemSource;
}

export interface Machinery {
  items: MachineryItem[];
  /** Sum of items. In rupees — authoritative for project cost. */
  totalCost: number;
}

// ── Raw Materials ─────────────────────────────────────────────────────────

export interface RawMaterialItem {
  name: string;
  specification?: string;
  monthlyQuantity: number;
  unit: string;
  /** In rupees. */
  unitRate: number;
  /** quantity × unitRate. In rupees. */
  totalMonthlyCost: number;
  source: ItemSource;
}

export interface RawMaterials {
  items: RawMaterialItem[];
  /** Sum of items. In rupees. */
  totalMonthlyCost: number;
}

// ── Employees ─────────────────────────────────────────────────────────────

export interface EmployeeGroup {
  male: number;
  female: number;
  /** In rupees. */
  monthlyWagePerPerson: number;
}

export interface AdministrativeStaff {
  count: number;
  /** In rupees. */
  monthlyWagePerPerson: number;
}

export interface Employees {
  skilled: EmployeeGroup;
  unskilled: EmployeeGroup;
  administrative: AdministrativeStaff;
  /** Computed sum. In rupees. */
  totalMonthlyWages: number;
  /** Total persons. */
  totalEmployment: number;
}

// ── Utilities & Overheads ─────────────────────────────────────────────────

export interface Utilities {
  /** In rupees. */
  monthlyPowerCost: number;
  monthlyWaterCost: number;
  monthlyRentCost: number;
  monthlyMaintenanceCost: number;
  monthlyTransportCost: number;
  monthlyCommunicationCost: number;
  monthlyInsuranceCost: number;
  monthlyMiscCost: number;
  /** Computed sum. In rupees. */
  totalMonthlyOverheads: number;
}

// ── Financial Assumptions ─────────────────────────────────────────────────

export interface Financials {
  /** Alias for machinery.totalCost. In rupees. */
  machineryAndEquipment: number;
  /** In rupees. */
  otherFixedAssets: number;
  /** In rupees. */
  preOperativeExpenses: number;
  /** In rupees. */
  buildingAndCivilWorks: number;
  /** Computed sum of the above. In rupees. */
  totalFixedCapital: number;
  /** In rupees. */
  workingCapital: number;
  /** totalFixedCapital + workingCapital. In rupees. */
  totalProjectCost: number;
  /** Annual % — user-provided or Knowledge Package default. */
  interestRate: number;
  loanTenureYears: number;
  /** Typically 6. */
  repaymentMoratoriumMonths: number;
  collateralOffered?: string;
  /** In rupees. */
  projectedMonthlySales: number;
}

// ── Working Capital Breakdown ─────────────────────────────────────────────

export type WorkingCapitalMethod =
  | "USER_PROVIDED"
  | "DAYS_BASED"
  | "PERCENTAGE_OF_PROJECT_COST";

export interface WorkingCapitalDetail {
  /** Typically 30-45. */
  rawMaterialDays: number;
  /** Typically 7-15. */
  workInProgressDays: number;
  /** Typically 15-30. */
  finishedGoodsDays: number;
  /** Typically 15-30. */
  creditorsDays: number;
  /** Days-based calculation result. In rupees. */
  computedWorkingCapital?: number;
  method: WorkingCapitalMethod;
}

// ── Market ────────────────────────────────────────────────────────────────

export interface Market {
  /** Description of target customers/area. */
  targetMarket: string;
  marketDemand?: string;
  competition?: string;
  marketingStrategy?: string;
  /** In rupees. */
  sellingPricePerUnit?: number;
  sellingPriceUnit?: string;
}

// ── Attachments ───────────────────────────────────────────────────────────

export type AttachmentType =
  | "QUOTATION"
  | "IDENTITY_PROOF"
  | "ADDRESS_PROOF"
  | "LAND_DOCUMENT"
  | "EDP_CERTIFICATE"
  | "OTHER";

export type AttachmentStatus = "PENDING_REVIEW" | "CONFIRMED" | "REJECTED";

export interface AttachmentRef {
  id: string;
  type: AttachmentType;
  fileName: string;
  /** From OCR engine — extracted field values. */
  ocrExtractedFields?: Record<string, string>;
  /** Index into machinery.items[]. */
  linkedMachineryIndex?: number;
  status: AttachmentStatus;
}

export interface Attachments {
  items: AttachmentRef[];
}

// ── Validation Metadata ───────────────────────────────────────────────────

export interface ValidationError {
  /** Dot-path e.g. "applicant.age". */
  fieldPath: string;
  code: string;
  message: string;
}

export interface Contradiction {
  /** Dot-paths of the contradicting fields. */
  fields: string[];
  description: string;
}

export interface Validation {
  /** 0-100, computed by Validation Engine. */
  completeness: number;
  /** Mandatory fields not yet filled. */
  missingFields: string[];
  errors: ValidationError[];
  contradictions: Contradiction[];
}

// ── Completion Metadata ───────────────────────────────────────────────────

export interface Completion {
  /** Which interview phase is active. */
  currentPhase: InterviewPhase;
  /** Progress per interview phase. */
  phaseProgress: Record<InterviewPhase, PhaseProgress>;
  /** ISO timestamp. */
  startedAt: string;
  /** ISO timestamp. */
  lastUpdatedAt: string;
  /** Number of AI or form interactions. */
  interactionCount: number;
}

// ── The Canonical Project Profile ─────────────────────────────────────────

export interface ProjectProfile {
  applicant: Applicant;
  business: Business;
  location: Location;
  land: Land;
  capacity: Capacity;
  machinery: Machinery;
  rawMaterials: RawMaterials;
  employees: Employees;
  utilities: Utilities;
  financials: Financials;
  workingCapitalDetail: WorkingCapitalDetail;
  market: Market;
  attachments: Attachments;
  validation: Validation;
  provenance: ProvenanceMetadata;
  completion: Completion;
}

// ── Convenience: union of all item source types ───────────────────────────

export { type ItemSource } from "./state-machine";