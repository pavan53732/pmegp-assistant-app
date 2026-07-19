// ─── Review Handler ──────────────────────────────────────────────────────────
// Builds a structured review summary of the entire project profile
// for the REVIEW phase. Pure functions only — no I/O, no AI calls.
// ───────────────────────────────────────────────────────────────────────────────

import type {
  ProjectProfile,
  Gender,
  ApplicantCategory,
  Education,
  EntityType,
  ActivityType,
  UrbanRural,
  LandStatus,
  BuildingType,
  WorkingCapitalMethod,
} from "@/shared/types/project-profile";
import type { InterviewPhase } from "@/shared/types/interview";
import type { FieldProvenance } from "@/shared/types/provenance";
import type {
  ReviewSummary,
  ReviewSection,
  ReviewFieldEntry,
} from "./types";

// ── Enum Label Maps ─────────────────────────────────────────────────────────

const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const CATEGORY_LABELS: Record<ApplicantCategory, string> = {
  GEN: "General",
  SC: "Scheduled Caste",
  ST: "Scheduled Tribe",
  OBC: "Other Backward Class",
  MINORITY: "Minority",
  EX_SERVICEMEN: "Ex-Servicemen",
  PH: "Persons with Disability",
  NER: "North Eastern Region",
};

const EDUCATION_LABELS: Record<Education, string> = {
  NONE: "No Formal Education",
  BELOW_8TH: "Below 8th Standard",
  "8TH_PASS": "8th Pass",
  "10TH_PASS": "10th Pass",
  "12TH_PASS": "12th Pass",
  GRADUATE: "Graduate",
  POST_GRADUATE: "Post-Graduate",
  PROFESSIONAL: "Professional Degree",
  OTHER: "Other",
};

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  INDIVIDUAL: "Individual",
  SHG: "Self Help Group",
  TRUST: "Trust",
  SOCIETY: "Society",
  COOP: "Cooperative",
  PARTNERSHIP: "Partnership",
  LLP: "LLP",
  PRIVATE_LIMITED: "Private Limited",
};

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  MANUFACTURING: "Manufacturing",
  SERVICE: "Service",
};

const SECTOR_LABELS: Record<string, string> = {
  MANUFACTURING: "Manufacturing",
  SERVICE: "Service",
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
  MANUFACTURING: "Manufacturing",
  SERVICE: "Service",
  TRADING: "Trading",
  TRANSPORT: "Transport",
};

const URBAN_RURAL_LABELS: Record<UrbanRural, string> = {
  URBAN: "Urban",
  RURAL: "Rural",
};

const LAND_STATUS_LABELS: Record<LandStatus, string> = {
  OWN: "Own",
  RENTED: "Rented",
  LEASED: "Leased",
  NONE: "No Land Required",
  FAMILY: "Family Land",
};

const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  OWN: "Own Building",
  RENTED: "Rented Building",
  CONSTRUCT: "New Construction",
};

const WC_METHOD_LABELS: Record<WorkingCapitalMethod, string> = {
  USER_PROVIDED: "User Provided",
  DAYS_BASED: "Days-Based Calculation",
  PERCENTAGE_OF_PROJECT_COST: "% of Project Cost",
};

// ── PII Fields (masked in all summaries) ─────────────────────────────────────

const PII_PATHS = new Set(["applicant.aadhaarNo", "applicant.panNo"]);

// ── Field Definitions ────────────────────────────────────────────────────────

type FieldType = "TEXT" | "NUMBER" | "CURRENCY" | "PERCENTAGE" | "BOOLEAN" | "ENUM" | "DATE";

interface FieldDef {
  dotPath: string;
  label: string;
  type: FieldType;
  required?: boolean;
  enumMap?: Record<string, string>;
  pii?: boolean;
}

interface PhaseSectionDef {
  phase: InterviewPhase;
  label: string;
  fields: FieldDef[];
}

/**
 * Ordered field definitions per interview phase.
 * REVIEW and VALIDATION_COMPLETION are excluded — they don't collect data.
 */
const PHASE_FIELD_DEFS: PhaseSectionDef[] = [
  {
    phase: "APPLICANT_DISCOVERY",
    label: "Applicant Information",
    fields: [
      { dotPath: "applicant.name", label: "Name", type: "TEXT", required: true },
      { dotPath: "applicant.age", label: "Age", type: "TEXT" },
      { dotPath: "applicant.gender", label: "Gender", type: "ENUM", enumMap: GENDER_LABELS },
      { dotPath: "applicant.category", label: "Category", type: "ENUM", enumMap: CATEGORY_LABELS },
      { dotPath: "applicant.isWomen", label: "Women Applicant", type: "BOOLEAN" },
      { dotPath: "applicant.education", label: "Education", type: "ENUM", enumMap: EDUCATION_LABELS, required: true },
      { dotPath: "applicant.educationDetail", label: "Education Details", type: "TEXT" },
      { dotPath: "applicant.entityType", label: "Entity Type", type: "ENUM", enumMap: ENTITY_TYPE_LABELS, required: true },
      { dotPath: "applicant.entityRegistrationNo", label: "Registration No.", type: "TEXT" },
      { dotPath: "applicant.phone", label: "Phone", type: "TEXT" },
      { dotPath: "applicant.email", label: "Email", type: "TEXT" },
      { dotPath: "applicant.aadhaarNo", label: "Aadhaar No.", type: "TEXT", pii: true },
      { dotPath: "applicant.panNo", label: "PAN No.", type: "TEXT", pii: true },
      { dotPath: "applicant.priorSubsidy", label: "Prior Subsidy Availed", type: "BOOLEAN" },
      { dotPath: "applicant.priorSubsidyDetail", label: "Prior Subsidy Details", type: "TEXT" },
      { dotPath: "applicant.edpCompleted", label: "EDP Training Completed", type: "BOOLEAN" },
      { dotPath: "applicant.edpCertificateNo", label: "EDP Certificate No.", type: "TEXT" },
      { dotPath: "applicant.experienceYears", label: "Experience (years)", type: "NUMBER" },
      { dotPath: "applicant.experienceDetail", label: "Experience Details", type: "TEXT" },
    ],
  },
  {
    phase: "BUSINESS_DISCOVERY",
    label: "Business Details",
    fields: [
      { dotPath: "business.name", label: "Unit Name", type: "TEXT", required: true },
      { dotPath: "business.description", label: "Description", type: "TEXT", required: true },
    ],
  },
  {
    phase: "ACTIVITY_RESOLUTION",
    label: "Activity & Classification",
    fields: [
      { dotPath: "business.activityType", label: "Activity Type", type: "ENUM", enumMap: ACTIVITY_TYPE_LABELS, required: true },
      { dotPath: "business.nicCode", label: "NIC Code", type: "TEXT", required: true },
      { dotPath: "business.nicDescription", label: "NIC Description", type: "TEXT", required: true },
      { dotPath: "business.sector", label: "Sector", type: "ENUM", enumMap: SECTOR_LABELS },
      { dotPath: "business.subCategory", label: "Sub-Category", type: "ENUM", enumMap: SUB_CATEGORY_LABELS },
    ],
  },
  {
    phase: "PROJECT_SIZING",
    label: "Location",
    fields: [
      { dotPath: "location.state", label: "State", type: "TEXT", required: true },
      { dotPath: "location.district", label: "District", type: "TEXT", required: true },
      { dotPath: "location.mandal", label: "Mandal/Taluka", type: "TEXT" },
      { dotPath: "location.village", label: "Village/Area", type: "TEXT" },
      { dotPath: "location.pinCode", label: "PIN Code", type: "TEXT" },
      { dotPath: "location.area", label: "Area", type: "ENUM", enumMap: URBAN_RURAL_LABELS, required: true },
      { dotPath: "location.premisesAddress", label: "Premises Address", type: "TEXT" },
      { dotPath: "location.isHillBorderArea", label: "Hill/Border Area", type: "BOOLEAN" },
      { dotPath: "location.isAspirationalDistrict", label: "Aspirational District", type: "BOOLEAN" },
      { dotPath: "location.industrialAreaName", label: "Industrial Area", type: "TEXT" },
      { dotPath: "location.industrialAreaType", label: "Industrial Area Type", type: "TEXT" },
    ],
  },
  {
    phase: "PROJECT_SIZING",
    label: "Land & Building",
    fields: [
      { dotPath: "land.status", label: "Land Status", type: "ENUM", enumMap: LAND_STATUS_LABELS },
      { dotPath: "land.areaSqFt", label: "Land Area (sq ft)", type: "NUMBER" },
      { dotPath: "land.areaSqMt", label: "Land Area (sq mt)", type: "NUMBER" },
      { dotPath: "land.ownedLandValue", label: "Land Value", type: "CURRENCY" },
      { dotPath: "land.monthlyRent", label: "Monthly Rent", type: "CURRENCY" },
      { dotPath: "land.leaseAmount", label: "Lease Amount", type: "CURRENCY" },
      { dotPath: "land.leaseYears", label: "Lease Period (years)", type: "NUMBER" },
      { dotPath: "land.buildingType", label: "Building Type", type: "ENUM", enumMap: BUILDING_TYPE_LABELS },
      { dotPath: "land.buildingAreaSqFt", label: "Building Area (sq ft)", type: "NUMBER" },
      { dotPath: "land.constructionCost", label: "Construction Cost", type: "CURRENCY" },
    ],
  },
  {
    phase: "PROJECT_SIZING",
    label: "Capacity & Production",
    fields: [
      { dotPath: "capacity.installedCapacity.value", label: "Installed Capacity", type: "NUMBER" },
      { dotPath: "capacity.installedCapacity.unit", label: "Capacity Unit", type: "TEXT" },
      { dotPath: "capacity.projectedCapacityUtil", label: "Capacity Utilisation", type: "PERCENTAGE" },
      { dotPath: "capacity.workingDaysPerMonth", label: "Working Days/Month", type: "NUMBER" },
      { dotPath: "capacity.workingHoursPerDay", label: "Working Hours/Day", type: "NUMBER" },
      { dotPath: "capacity.shifts", label: "Shifts", type: "NUMBER" },
    ],
  },
  {
    phase: "PROJECT_SIZING",
    label: "Machinery & Equipment",
    fields: [
      { dotPath: "machinery.totalCost", label: "Total Machinery Cost", type: "CURRENCY" },
    ],
  },
  {
    phase: "PROJECT_SIZING",
    label: "Raw Materials",
    fields: [
      { dotPath: "rawMaterials.totalMonthlyCost", label: "Total Monthly Raw Material Cost", type: "CURRENCY" },
    ],
  },
  {
    phase: "PROJECT_SIZING",
    label: "Employees",
    fields: [
      { dotPath: "employees.skilled.male", label: "Skilled (Male)", type: "NUMBER" },
      { dotPath: "employees.skilled.female", label: "Skilled (Female)", type: "NUMBER" },
      { dotPath: "employees.skilled.monthlyWagePerPerson", label: "Skilled Wage/Person/Month", type: "CURRENCY" },
      { dotPath: "employees.unskilled.male", label: "Unskilled (Male)", type: "NUMBER" },
      { dotPath: "employees.unskilled.female", label: "Unskilled (Female)", type: "NUMBER" },
      { dotPath: "employees.unskilled.monthlyWagePerPerson", label: "Unskilled Wage/Person/Month", type: "CURRENCY" },
      { dotPath: "employees.administrative.count", label: "Administrative Staff", type: "NUMBER" },
      { dotPath: "employees.administrative.monthlyWagePerPerson", label: "Admin Wage/Person/Month", type: "CURRENCY" },
      { dotPath: "employees.totalEmployment", label: "Total Employment", type: "NUMBER" },
      { dotPath: "employees.totalMonthlyWages", label: "Total Monthly Wages", type: "CURRENCY" },
    ],
  },
  {
    phase: "PROJECT_SIZING",
    label: "Utilities & Overheads",
    fields: [
      { dotPath: "utilities.monthlyPowerCost", label: "Power Cost/Month", type: "CURRENCY" },
      { dotPath: "utilities.monthlyWaterCost", label: "Water Cost/Month", type: "CURRENCY" },
      { dotPath: "utilities.monthlyRentCost", label: "Rent Cost/Month", type: "CURRENCY" },
      { dotPath: "utilities.monthlyMaintenanceCost", label: "Maintenance/Month", type: "CURRENCY" },
      { dotPath: "utilities.monthlyTransportCost", label: "Transport/Month", type: "CURRENCY" },
      { dotPath: "utilities.monthlyCommunicationCost", label: "Communication/Month", type: "CURRENCY" },
      { dotPath: "utilities.monthlyInsuranceCost", label: "Insurance/Month", type: "CURRENCY" },
      { dotPath: "utilities.monthlyMiscCost", label: "Miscellaneous/Month", type: "CURRENCY" },
      { dotPath: "utilities.totalMonthlyOverheads", label: "Total Monthly Overheads", type: "CURRENCY" },
    ],
  },
  {
    phase: "FINANCIAL_PLANNING",
    label: "Financial Assumptions",
    fields: [
      { dotPath: "financials.machineryAndEquipment", label: "Machinery & Equipment", type: "CURRENCY" },
      { dotPath: "financials.otherFixedAssets", label: "Other Fixed Assets", type: "CURRENCY" },
      { dotPath: "financials.preOperativeExpenses", label: "Pre-Operative Expenses", type: "CURRENCY" },
      { dotPath: "financials.buildingAndCivilWorks", label: "Building & Civil Works", type: "CURRENCY" },
      { dotPath: "financials.totalFixedCapital", label: "Total Fixed Capital", type: "CURRENCY" },
      { dotPath: "financials.workingCapital", label: "Working Capital", type: "CURRENCY" },
      { dotPath: "financials.totalProjectCost", label: "Total Project Cost", type: "CURRENCY", required: true },
      { dotPath: "financials.interestRate", label: "Interest Rate", type: "PERCENTAGE" },
      { dotPath: "financials.loanTenureYears", label: "Loan Tenure", type: "TEXT" },
      { dotPath: "financials.repaymentMoratoriumMonths", label: "Moratorium Period", type: "TEXT" },
      { dotPath: "financials.collateralOffered", label: "Collateral", type: "TEXT" },
      { dotPath: "financials.projectedMonthlySales", label: "Projected Monthly Sales", type: "CURRENCY" },
    ],
  },
  {
    phase: "FINANCIAL_PLANNING",
    label: "Working Capital Breakdown",
    fields: [
      { dotPath: "workingCapitalDetail.rawMaterialDays", label: "Raw Material (days)", type: "NUMBER" },
      { dotPath: "workingCapitalDetail.workInProgressDays", label: "Work-in-Progress (days)", type: "NUMBER" },
      { dotPath: "workingCapitalDetail.finishedGoodsDays", label: "Finished Goods (days)", type: "NUMBER" },
      { dotPath: "workingCapitalDetail.creditorsDays", label: "Creditors (days)", type: "NUMBER" },
      { dotPath: "workingCapitalDetail.computedWorkingCapital", label: "Computed Working Capital", type: "CURRENCY" },
      { dotPath: "workingCapitalDetail.method", label: "Calculation Method", type: "ENUM", enumMap: WC_METHOD_LABELS },
    ],
  },
  {
    phase: "FINANCIAL_PLANNING",
    label: "Market",
    fields: [
      { dotPath: "market.targetMarket", label: "Target Market", type: "TEXT" },
      { dotPath: "market.marketDemand", label: "Market Demand", type: "TEXT" },
      { dotPath: "market.competition", label: "Competition", type: "TEXT" },
      { dotPath: "market.marketingStrategy", label: "Marketing Strategy", type: "TEXT" },
      { dotPath: "market.sellingPricePerUnit", label: "Selling Price/Unit", type: "CURRENCY" },
      { dotPath: "market.sellingPriceUnit", label: "Selling Price Unit", type: "TEXT" },
    ],
  },
];

// ── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Navigate into a nested object using a dot-path.
 * Returns undefined if any segment is missing.
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/**
 * Format a number in Indian currency notation: ₹25,00,000.
 * Groups as 3, then 2, then 2, ...
 */
function formatIndianCurrency(amount: number): string {
  if (amount === 0) return "₹0";
  const isNegative = amount < 0;
  const abs = Math.round(Math.abs(amount));
  const str = abs.toString();

  // Last 3 digits
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);

  let result = lastThree;
  // Remaining digits in groups of 2, right to left
  let remaining = rest;
  while (remaining.length > 2) {
    result = remaining.slice(-2) + "," + result;
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    result = remaining + "," + result;
  }

  return (isNegative ? "-₹" : "₹") + result;
}

/**
 * Mask PII values — show only last 4 characters, rest as asterisks.
 */
function maskPII(value: string): string {
  if (value.length <= 4) return "****";
  return "*".repeat(value.length - 4) + value.slice(-4);
}

/**
 * Check whether a value is considered "empty" (missing / not filled).
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return false; // 0 is valid
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Get the provenance record for a field, or a default MISSING provenance.
 */
function getFieldProvenance(
  profile: ProjectProfile,
  dotPath: string,
): FieldProvenance {
  return profile.provenance?.perField?.[dotPath] ?? {
    source: null,
    verification: "UNVERIFIED",
  };
}

/**
 * Format a date string (ISO) for display.
 */
function formatDate(value: string): string {
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

// ── Exported Functions ───────────────────────────────────────────────────────

/**
 * Format a field value for display in the review.
 * Currency: "₹25,00,000"
 * Percentage: "35%"
 * Boolean: "Yes" / "No"
 * Enum: human-readable label
 * Date: formatted
 */
export function formatFieldValue(
  value: unknown,
  fieldPath: string,
): string {
  if (value === null || value === undefined) return "—";

  // Mask PII fields
  if (PII_PATHS.has(fieldPath) && typeof value === "string") {
    return maskPII(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    // Detect if this is a currency field by path or by type hint context
    const currencyPaths = [
      "cost", "Cost", "value", "Value", "rent", "Rent",
      "wage", "Wage", "price", "Price", "capital", "Capital",
      "loan", "Loan", "expense", "Expense", "sales", "Sales",
      "amount", "Amount", "landValue",
    ];
    const isCurrencyField = currencyPaths.some(
      (seg) => fieldPath.toLowerCase().includes(seg.toLowerCase()),
    );

    if (isCurrencyField && value >= 100) {
      return formatIndianCurrency(value);
    }

    // Percentage fields
    if (
      fieldPath.toLowerCase().includes("util") ||
      fieldPath.toLowerCase().includes("rate") ||
      fieldPath.toLowerCase().includes("percentage")
    ) {
      return `${value}%`;
    }

    return value.toLocaleString("en-IN");
  }

  if (typeof value === "string") {
    // Try to detect ISO date strings
    if (
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(value) &&
      fieldPath.toLowerCase().includes("date")
    ) {
      return formatDate(value);
    }
    return value;
  }

  return String(value);
}

/**
 * Generate a complete review summary of the project profile.
 * Groups fields by interview phase for easy scanning.
 */
export function generateReviewSummary(profile: ProjectProfile): ReviewSummary {
  const sections: ReviewSection[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Collect validation errors
  for (const err of profile.validation?.errors ?? []) {
    errors.push(`${err.fieldPath}: ${err.message}`);
  }

  // Collect missing required fields
  const missingFields = new Set(profile.validation?.missingFields ?? []);

  for (const sectionDef of PHASE_FIELD_DEFS) {
    const fieldEntries: ReviewFieldEntry[] = [];
    let hasAttention = false;

    for (const fieldDef of sectionDef.fields) {
      const rawValue = getNestedValue(profile, fieldDef.dotPath);
      const prov = getFieldProvenance(profile, fieldDef.dotPath);
      const isFilled = !isEmpty(rawValue);

      // Determine attention reasons
      let needsAttention = false;
      let reason: string | undefined;

      if (!isFilled && fieldDef.required) {
        // Missing required field
        needsAttention = true;
        reason = "Required field is missing";
        if (!missingFields.has(fieldDef.dotPath)) {
          missingFields.add(fieldDef.dotPath);
        }
      } else if (isFilled && prov.source === "KNOWLEDGE") {
        needsAttention = true;
        reason = "Suggested by system — needs your confirmation";
        hasAttention = true;
      } else if (
        isFilled &&
        (prov.source === "AI" || prov.source === "OCR") &&
        prov.verification === "UNVERIFIED"
      ) {
        needsAttention = true;
        reason = `Extracted by ${prov.source} — please confirm`;
        hasAttention = true;
      }

      // Check for validation errors on this field
      const fieldErrors = (profile.validation?.errors ?? []).filter(
        (e) => e.fieldPath === fieldDef.dotPath,
      );
      if (fieldErrors.length > 0) {
        needsAttention = true;
        reason = fieldErrors.map((e) => e.message).join("; ");
        hasAttention = true;
      }

      const displayValue = isFilled
        ? formatFieldValue(rawValue, fieldDef.dotPath)
        : "—";

      // Determine source label
      let sourceLabel = "—";
      if (isFilled && prov.source) {
        sourceLabel = prov.source;
      }

      // Determine verification label
      let verificationLabel = "—";
      if (isFilled) {
        verificationLabel = prov.verification;
      }

      fieldEntries.push({
        dotPath: fieldDef.dotPath,
        label: fieldDef.label,
        value: displayValue,
        source: sourceLabel,
        verification: verificationLabel,
        needsAttention,
        reason,
      });
    }

    // Only add sections that have at least one filled field or attention item
    const hasFilledFields = fieldEntries.some(
      (f) => f.value !== "—" && !f.needsAttention,
    );
    const hasAttentionFields = fieldEntries.some((f) => f.needsAttention);

    if (hasFilledFields || hasAttentionFields) {
      // Merge sections with the same phase into one section with sub-groups
      // by finding an existing section for this phase
      const existingSection = sections.find(
        (s) => s.phase === sectionDef.phase,
      );

      if (existingSection) {
        existingSection.fields.push(...fieldEntries);
      } else {
        sections.push({
          phase: sectionDef.phase,
          label: sectionDef.label,
          fields: fieldEntries,
        });
      }
    }
  }

  // Build warnings
  const attentionEntries = getAttentionFields(profile);
  const unverifiedCount = attentionEntries.filter(
    (e) =>
      e.reason?.includes("confirm") ||
      e.reason?.includes("Suggested") ||
      e.reason?.includes("Extracted"),
  ).length;
  const missingCount = attentionEntries.filter(
    (e) => e.reason?.includes("missing"),
  ).length;

  if (unverifiedCount > 0) {
    warnings.push(
      `${unverifiedCount} field${unverifiedCount > 1 ? "s" : ""} need your confirmation (shown with ⚡)`,
    );
  }
  if (missingCount > 0) {
    warnings.push(
      `${missingCount} required field${missingCount > 1 ? "s" : ""} are missing`,
    );
  }

  const canConfirm =
    errors.length === 0 &&
    missingFields.size === 0 &&
    unverifiedCount === 0;

  return {
    sections,
    completeness: profile.validation?.completeness ?? 0,
    errors,
    warnings,
    canConfirm,
  };
}

/**
 * Get a list of fields that need user attention before confirmation.
 */
export function getAttentionFields(profile: ProjectProfile): ReviewFieldEntry[] {
  const summary = generateReviewSummary(profile);
  const attentionFields: ReviewFieldEntry[] = [];

  for (const section of summary.sections) {
    for (const field of section.fields) {
      if (field.needsAttention) {
        attentionFields.push(field);
      }
    }
  }

  return attentionFields;
}

/**
 * Generate a text summary of the project for display in the review chat.
 * This is what the AI will show the user in the REVIEW phase.
 */
export function generateReviewText(profile: ProjectProfile): string {
  const lines: string[] = [];
  const summary = generateReviewSummary(profile);

  lines.push("📋 Project Review Summary");
  lines.push("");

  for (const section of summary.sections) {
    const filledFields = section.fields.filter(
      (f) => f.value !== "—" || f.needsAttention,
    );
    if (filledFields.length === 0) continue;

    lines.push(`**${section.label}**`);

    for (const field of filledFields) {
      const attention = field.needsAttention ? " ⚡" : "";
      const marker = field.value === "—" ? "" : `- ${field.label}: ${field.value}${attention}`;
      if (marker) {
        lines.push(marker);
      }
    }

    lines.push("");
  }

  // Append machinery items if present
  const machineItems = profile.machinery?.items ?? [];
  if (machineItems.length > 0) {
    lines.push("**Machinery Items**");
    for (const item of machineItems) {
      const costStr = formatIndianCurrency(item.totalCost);
      lines.push(
        `- ${item.name}${item.specification ? ` (${item.specification})` : ""}: ${item.quantity} × ${formatIndianCurrency(item.unitCost)} = ${costStr}`,
      );
    }
    lines.push("");
  }

  // Append raw material items if present
  const rawItems = profile.rawMaterials?.items ?? [];
  if (rawItems.length > 0) {
    lines.push("**Raw Materials**");
    for (const item of rawItems) {
      const costStr = formatIndianCurrency(item.totalMonthlyCost);
      lines.push(
        `- ${item.name}: ${item.monthlyQuantity} ${item.unit} × ${formatIndianCurrency(item.unitRate)} = ${costStr}/month`,
      );
    }
    lines.push("");
  }

  // Attention items
  const attentionCount = summary.warnings.length;
  if (attentionCount > 0) {
    lines.push("⚠️ Items needing attention:");
    for (const warning of summary.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  // Footer
  if (summary.canConfirm) {
    lines.push("✅ All fields look good! Type \"confirm\" to proceed.");
  } else if (summary.errors.length > 0) {
    lines.push("❌ There are errors that must be fixed before confirming.");
  } else {
    lines.push(
      "🔄 Please review the highlighted items, then type \"confirm\" or ask to change any value.",
    );
  }

  return lines.join("\n");
}