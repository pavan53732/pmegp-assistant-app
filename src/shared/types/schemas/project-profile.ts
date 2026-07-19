// ─── Zod Schemas ─────────────────────────────────────────────────────────
// Zod schemas that mirror the TypeScript types in shared/types exactly.
// Used for runtime validation of the Structured Project Profile.
// ───────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ── Provenance Schema ─────────────────────────────────────────────────────

export const fieldProvenanceSchema = z.object({
  source: z.enum(["USER", "AI", "OCR", "KNOWLEDGE"]).nullable(),
  verification: z.enum(["UNVERIFIED", "CONFIRMED", "VALIDATED"]),
  confirmedAt: z.string().optional(),
  extractConfidence: z.number().min(0).max(1).optional(),
  knowledgeSource: z.string().optional(),
});

export const provenanceMetadataSchema = z.object({
  perField: z.record(z.string(), fieldProvenanceSchema),
  aggregate: z.number().min(0).max(1),
});

// ── State Machine Schema ──────────────────────────────────────────────────

export const projectStatusSchema = z.enum([
  "EMPTY",
  "PARTIAL",
  "DISCOVERING",
  "COMPLETE",
  "REVIEW_PENDING",
  "VALIDATED",
  "ELIGIBILITY_READY",
  "FINANCIAL_READY",
  "DPR_READY",
]);

export const itemSourceSchema = z.enum(["USER", "AI", "KNOWLEDGE", "OCR"]);

// ── Interview Schema ──────────────────────────────────────────────────────

export const interviewPhaseSchema = z.enum([
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
  "REVIEW",
  "VALIDATION_COMPLETION",
]);

export const phaseProgressSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "NEEDS_REVIEW"]),
  completedFields: z.number().int().min(0),
  totalFields: z.number().int().min(0),
});

// ── Applicant Schema ──────────────────────────────────────────────────────

export const applicantSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(18).max(100),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  category: z.enum([
    "GEN",
    "SC",
    "ST",
    "OBC",
    "MINORITY",
    "EX_SERVICEMEN",
    "PH",
    "NER",
  ]),
  isWomen: z.boolean(),
  phone: z.string().optional(),
  email: z.string().optional(),
  education: z.enum([
    "NONE",
    "BELOW_8TH",
    "8TH_PASS",
    "10TH_PASS",
    "12TH_PASS",
    "GRADUATE",
    "POST_GRADUATE",
    "PROFESSIONAL",
    "OTHER",
  ]),
  educationDetail: z.string().optional(),
  entityType: z.enum([
    "INDIVIDUAL",
    "SHG",
    "TRUST",
    "SOCIETY",
    "COOP",
    "PARTNERSHIP",
    "LLP",
    "PRIVATE_LIMITED",
  ]),
  entityRegistrationNo: z.string().optional(),
  aadhaarNo: z.string().optional(),
  panNo: z.string().optional(),
  priorSubsidy: z.boolean(),
  priorSubsidyDetail: z.string().optional(),
  edpCompleted: z.boolean(),
  edpCertificateNo: z.string().optional(),
  experienceYears: z.number().int().min(0).optional(),
  experienceDetail: z.string().optional(),
});

// ── Business Schema ───────────────────────────────────────────────────────

export const businessSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  activityType: z.enum(["MANUFACTURING", "SERVICE"]),
  nicCode: z.string().optional(),
  nicDescription: z.string().optional(),
  sector: z.enum(["MANUFACTURING", "SERVICE"]),
  subCategory: z.enum(["MANUFACTURING", "SERVICE", "TRADING", "TRANSPORT"]),
});

// ── Location Schema ───────────────────────────────────────────────────────

export const locationSchema = z.object({
  state: z.string().min(1),
  district: z.string().min(1),
  mandal: z.string().optional(),
  village: z.string().optional(),
  pinCode: z.string().optional(),
  area: z.enum(["URBAN", "RURAL"]),
  premisesAddress: z.string().optional(),
  isHillBorderArea: z.boolean(),
  isAspirationalDistrict: z.boolean(),
  industrialAreaName: z.string().optional(),
  industrialAreaType: z
    .enum(["INDUSTRIAL_ESTATE", "SEZ", "CLUSTER", "DAC", "OTHER"])
    .nullable()
    .optional(),
});

// ── Land Schema ───────────────────────────────────────────────────────────

export const landSchema = z.object({
  status: z.enum(["OWN", "RENTED", "LEASED", "NONE", "FAMILY"]),
  areaSqFt: z.number().min(0).optional(),
  areaSqMt: z.number().min(0).optional(),
  ownedLandValue: z.number().int().min(0).optional(),
  monthlyRent: z.number().int().min(0).optional(),
  leaseAmount: z.number().int().min(0).optional(),
  leaseYears: z.number().int().min(0).optional(),
  buildingType: z.enum(["OWN", "RENTED", "CONSTRUCT"]).optional(),
  buildingAreaSqFt: z.number().min(0).optional(),
  constructionCost: z.number().int().min(0).optional(),
});

// ── Capacity Schema ───────────────────────────────────────────────────────

export const capacitySchema = z.object({
  installedCapacity: z.object({
    unit: z.string().min(1),
    value: z.number().min(0),
  }),
  projectedCapacityUtil: z.number().min(0).max(100),
  workingDaysPerMonth: z.number().int().min(1).max(31),
  workingHoursPerDay: z.number().min(1).max(24),
  shifts: z.number().int().min(1).max(3),
});

// ── Machinery Schema ──────────────────────────────────────────────────────

export const machineryItemSchema = z.object({
  name: z.string().min(1),
  specification: z.string().optional(),
  quantity: z.number().int().min(1),
  unitCost: z.number().int().min(0),
  totalCost: z.number().int().min(0),
  supplier: z.string().optional(),
  quotationRef: z.string().optional(),
  source: itemSourceSchema,
});

export const machinerySchema = z.object({
  items: z.array(machineryItemSchema),
  totalCost: z.number().int().min(0),
});

// ── Raw Materials Schema ──────────────────────────────────────────────────

export const rawMaterialItemSchema = z.object({
  name: z.string().min(1),
  specification: z.string().optional(),
  monthlyQuantity: z.number().min(0),
  unit: z.string().min(1),
  unitRate: z.number().int().min(0),
  totalMonthlyCost: z.number().int().min(0),
  source: itemSourceSchema,
});

export const rawMaterialsSchema = z.object({
  items: z.array(rawMaterialItemSchema),
  totalMonthlyCost: z.number().int().min(0),
});

// ── Employees Schema ──────────────────────────────────────────────────────

export const employeesSchema = z.object({
  skilled: z.object({
    male: z.number().int().min(0),
    female: z.number().int().min(0),
    monthlyWagePerPerson: z.number().int().min(0),
  }),
  unskilled: z.object({
    male: z.number().int().min(0),
    female: z.number().int().min(0),
    monthlyWagePerPerson: z.number().int().min(0),
  }),
  administrative: z.object({
    count: z.number().int().min(0),
    monthlyWagePerPerson: z.number().int().min(0),
  }),
  totalMonthlyWages: z.number().int().min(0),
  totalEmployment: z.number().int().min(0),
});

// ── Utilities Schema ──────────────────────────────────────────────────────

export const utilitiesSchema = z.object({
  monthlyPowerCost: z.number().int().min(0),
  monthlyWaterCost: z.number().int().min(0),
  monthlyRentCost: z.number().int().min(0),
  monthlyMaintenanceCost: z.number().int().min(0),
  monthlyTransportCost: z.number().int().min(0),
  monthlyCommunicationCost: z.number().int().min(0),
  monthlyInsuranceCost: z.number().int().min(0),
  monthlyMiscCost: z.number().int().min(0),
  totalMonthlyOverheads: z.number().int().min(0),
});

// ── Financials Schema ─────────────────────────────────────────────────────

export const financialsSchema = z.object({
  machineryAndEquipment: z.number().int().min(0),
  otherFixedAssets: z.number().int().min(0),
  preOperativeExpenses: z.number().int().min(0),
  buildingAndCivilWorks: z.number().int().min(0),
  totalFixedCapital: z.number().int().min(0),
  workingCapital: z.number().int().min(0),
  totalProjectCost: z.number().int().min(0),
  interestRate: z.number().min(0),
  loanTenureYears: z.number().int().min(1).max(30),
  repaymentMoratoriumMonths: z.number().int().min(0),
  collateralOffered: z.string().optional(),
  projectedMonthlySales: z.number().int().min(0),
});

// ── Working Capital Detail Schema ─────────────────────────────────────────

export const workingCapitalDetailSchema = z.object({
  rawMaterialDays: z.number().int().min(0),
  workInProgressDays: z.number().int().min(0),
  finishedGoodsDays: z.number().int().min(0),
  creditorsDays: z.number().int().min(0),
  computedWorkingCapital: z.number().int().min(0).optional(),
  method: z.enum([
    "USER_PROVIDED",
    "DAYS_BASED",
    "PERCENTAGE_OF_PROJECT_COST",
  ]),
});

// ── Market Schema ─────────────────────────────────────────────────────────

export const marketSchema = z.object({
  targetMarket: z.string().min(1),
  marketDemand: z.string().optional(),
  competition: z.string().optional(),
  marketingStrategy: z.string().optional(),
  sellingPricePerUnit: z.number().int().min(0).optional(),
  sellingPriceUnit: z.string().optional(),
});

// ── Attachments Schema ────────────────────────────────────────────────────

export const attachmentRefSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "QUOTATION",
    "IDENTITY_PROOF",
    "ADDRESS_PROOF",
    "LAND_DOCUMENT",
    "EDP_CERTIFICATE",
    "OTHER",
  ]),
  fileName: z.string().min(1),
  ocrExtractedFields: z.record(z.string(), z.string()).optional(),
  linkedMachineryIndex: z.number().int().min(0).optional(),
  status: z.enum(["PENDING_REVIEW", "CONFIRMED", "REJECTED"]),
});

export const attachmentsSchema = z.object({
  items: z.array(attachmentRefSchema),
});

// ── Validation Schema ─────────────────────────────────────────────────────

export const validationErrorSchema = z.object({
  fieldPath: z.string(),
  code: z.string(),
  message: z.string(),
});

export const contradictionSchema = z.object({
  fields: z.array(z.string()),
  description: z.string(),
});

export const validationSchema = z.object({
  completeness: z.number().min(0).max(100),
  missingFields: z.array(z.string()),
  errors: z.array(validationErrorSchema),
  contradictions: z.array(contradictionSchema),
});

// ── Completion Schema ─────────────────────────────────────────────────────

export const completionSchema = z.object({
  currentPhase: interviewPhaseSchema,
  phaseProgress: z.record(interviewPhaseSchema, phaseProgressSchema),
  startedAt: z.string(),
  lastUpdatedAt: z.string(),
  interactionCount: z.number().int().min(0),
});

// ── Full Project Profile Schema ───────────────────────────────────────────

export const projectProfileSchema = z.object({
  applicant: applicantSchema,
  business: businessSchema,
  location: locationSchema,
  land: landSchema,
  capacity: capacitySchema,
  machinery: machinerySchema,
  rawMaterials: rawMaterialsSchema,
  employees: employeesSchema,
  utilities: utilitiesSchema,
  financials: financialsSchema,
  workingCapitalDetail: workingCapitalDetailSchema,
  market: marketSchema,
  attachments: attachmentsSchema,
  validation: validationSchema,
  provenance: provenanceMetadataSchema,
  completion: completionSchema,
});

// ── Inferred TypeScript types from schemas ────────────────────────────────

export type InferProjectProfile = z.infer<typeof projectProfileSchema>;
export type InferApplicant = z.infer<typeof applicantSchema>;
export type InferBusiness = z.infer<typeof businessSchema>;
export type InferLocation = z.infer<typeof locationSchema>;
export type InferLand = z.infer<typeof landSchema>;
export type InferCapacity = z.infer<typeof capacitySchema>;
export type InferMachinery = z.infer<typeof machinerySchema>;
export type InferRawMaterials = z.infer<typeof rawMaterialsSchema>;
export type InferEmployees = z.infer<typeof employeesSchema>;
export type InferUtilities = z.infer<typeof utilitiesSchema>;
export type InferFinancials = z.infer<typeof financialsSchema>;
export type InferWorkingCapitalDetail = z.infer<
  typeof workingCapitalDetailSchema
>;
export type InferMarket = z.infer<typeof marketSchema>;
export type InferAttachments = z.infer<typeof attachmentsSchema>;
export type InferValidation = z.infer<typeof validationSchema>;
export type InferProvenanceMetadata = z.infer<typeof provenanceMetadataSchema>;
export type InferCompletion = z.infer<typeof completionSchema>;
export type InferFieldProvenance = z.infer<typeof fieldProvenanceSchema>;