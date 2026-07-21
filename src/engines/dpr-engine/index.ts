// ─── DPR Engine ─────────────────────────────────────────────────────────────
// Assembles the Detailed Project Report (DPR) from a validated ProjectProfile,
// FinancialResult, and EligibilityResult.
//
// Pure function — NO I/O, NO AI calls, NO side effects.
// "AI never calculates" — this engine never imports the AI layer.
// All rupee values formatted in Indian notation (₹25,00,000).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ProjectProfile,
  Education,
  EntityType,
  Gender,
  ApplicantCategory,
  LandStatus,
  BuildingType,
} from "@/shared/types/project-profile";
import type { FinancialResult } from "@/engines/financial-engine";
import type { EligibilityResult } from "@/engines/eligibility-engine";

// ── Public Types ────────────────────────────────────────────────────────────

/** A single DPR section with markdown content and optional structured tables. */
export interface DprSection {
  id: string;
  title: string;
  content: string; // Markdown
  tables?: DprTable[];
  order: number;
}

/** A structured table embedded inside a DPR section. */
export interface DprTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

/** The complete DPR document with all sections and engine results. */
export interface DprDocument {
  sections: DprSection[];
  financialResult: FinancialResult;
  eligibilityResult: EligibilityResult;
  generatedAt: string; // ISO timestamp
  wordCount: number;
}

/** A single row in the loan repayment schedule. */
export interface RepaymentRow {
  month: number;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

/** A single row in the projected Profit & Loss account. */
export interface ProfitLossRow {
  year: number;
  salesRevenue: number;
  costOfProduction: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  netMargin: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Depreciation useful life for machinery (straight-line, years). */
const DEPRECIATION_YEARS = 10;

/** Year-over-year revenue growth assumption for projections (%). */
const REVENUE_GROWTH_PERCENT = 10;

/** Cost escalation assumption for raw materials and wages (%). */
const COST_ESCALATION_PERCENT = 5;

/** Building useful life for depreciation (years). */
const BUILDING_DEPRECIATION_YEARS = 30;

// ── Label Lookups ───────────────────────────────────────────────────────────

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

const CATEGORY_LABEL: Record<ApplicantCategory, string> = {
  GEN: "General",
  SC: "Scheduled Caste (SC)",
  ST: "Scheduled Tribe (ST)",
  OBC: "Other Backward Class (OBC)",
  MINORITY: "Minority",
  EX_SERVICEMEN: "Ex-Servicemen",
  PH: "Persons with Disability (PH)",
  NER: "North Eastern Region (NER)",
};

const EDUCATION_LABEL: Record<Education, string> = {
  NONE: "None",
  BELOW_8TH: "Below 8th Standard",
  "8TH_PASS": "8th Pass",
  "10TH_PASS": "10th Pass",
  "12TH_PASS": "12th Pass",
  GRADUATE: "Graduate",
  POST_GRADUATE: "Post-Graduate",
  PROFESSIONAL: "Professional Degree/Diploma",
  OTHER: "Other",
};

const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  INDIVIDUAL: "Individual",
  SHG: "Self-Help Group (SHG)",
  TRUST: "Trust",
  SOCIETY: "Society",
  COOP: "Co-operative Society",
  PARTNERSHIP: "Partnership Firm",
  LLP: "Limited Liability Partnership (LLP)",
  PRIVATE_LIMITED: "Private Limited Company",
};

const LAND_STATUS_LABEL: Record<LandStatus, string> = {
  OWN: "Owned",
  RENTED: "Rented",
  LEASED: "Leased",
  NONE: "Not Applicable",
  FAMILY: "Family-owned",
};

const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  OWN: "Owned Building",
  RENTED: "Rented Building",
  CONSTRUCT: "To be Constructed",
};

// ── Currency & Number Formatting ────────────────────────────────────────────

/**
 * Format a whole-rupee number in Indian notation (e.g. "₹25,00,000").
 * Uses the standard Indian grouping: 3,2,2,2...
 *
 * @param amount - Integer amount in rupees
 * @returns Formatted currency string
 */
export function formatIndianCurrency(amount: number): string {
  const str = Math.abs(amount).toString();
  if (str.length <= 3) return `₹${amount.toLocaleString("en-IN")}`;
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted =
    rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `₹${amount < 0 ? "-" : ""}${formatted}`;
}

/**
 * Convert a number to a human-readable Indian word form (e.g. "25.00 Lakhs").
 *
 * @param amount - Integer amount in rupees
 * @returns Readable string in lakhs/crores
 */
export function formatIndianWords(amount: number): string {
  if (amount >= 1_00_00_000) {
    const crores = amount / 1_00_00_000;
    return `${crores.toFixed(2)} Crores`;
  }
  if (amount >= 1_00_000) {
    const lakhs = amount / 1_00_000;
    return `${lakhs.toFixed(2)} Lakhs`;
  }
  if (amount >= 1_000) {
    const thousands = amount / 1_000;
    return `${thousands.toFixed(1)} Thousand`;
  }
  return `₹${amount}`;
}

// ── Table Building Helper ───────────────────────────────────────────────────

/**
 * Build a Markdown table string from headers and rows.
 * Used for inline markdown content within sections.
 *
 * @param headers - Column headers
 * @param rows - Array of row cell arrays
 * @returns Markdown-formatted table string
 */
export function buildMarkdownTable(
  headers: string[],
  rows: string[][],
): string {
  const headerLine = "| " + headers.join(" | ") + " |";
  const separatorLine = "| " + headers.map(() => "---").join(" | ") + " |";
  const dataLines = rows.map((row) => "| " + row.join(" | ") + " |");
  return [headerLine, separatorLine, ...dataLines].join("\n");
}

// ── Financial Calculation Helpers ───────────────────────────────────────────

/**
 * Calculate EMI using the reducing balance formula.
 * EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 *
 * @param principal - Loan principal in rupees
 * @param annualRate - Annual interest rate percentage
 * @param months - Loan tenure in months
 * @returns Object with EMI amount and total interest
 */
export function calculateEMI(
  principal: number,
  annualRate: number,
  months: number,
): { emi: number; totalInterest: number } {
  if (principal <= 0 || months <= 0) return { emi: 0, totalInterest: 0 };
  if (annualRate <= 0) {
    const emi = Math.round(principal / months);
    return { emi, totalInterest: 0 };
  }

  const r = annualRate / 12 / 100;
  const factor = Math.pow(1 + r, months);
  const emi = Math.round((principal * r * factor) / (factor - 1));
  const totalRepayment = emi * months;
  const totalInterest = Math.round(totalRepayment - principal);

  return { emi, totalInterest };
}

/**
 * Calculate DSCR (Debt Service Coverage Ratio).
 * DSCR = (Net Profit + Depreciation + Interest) / Loan Installment (P+I)
 *
 * @param netProfit - Annual net profit in rupees
 * @param depreciation - Annual depreciation in rupees
 * @param interest - Annual interest paid in rupees
 * @param loanInstallment - Total annual loan repayment (principal + interest)
 * @returns DSCR ratio (1.25+ is typically required by banks)
 */
export function calculateDSCR(
  netProfit: number,
  depreciation: number,
  interest: number,
  loanInstallment: number,
): number {
  if (loanInstallment <= 0) return 0;
  return (netProfit + depreciation + interest) / loanInstallment;
}

/**
 * Calculate break-even point as a percentage of capacity utilisation.
 * BEP = Fixed Costs / (1 − Variable Cost Ratio) × 100
 *
 * @param fixedCosts - Annual fixed costs (depreciation, rent, admin salaries, interest)
 * @param salesRevenue - Annual sales revenue
 * @param variableCosts - Annual variable costs (raw materials, direct wages, power)
 * @returns Break-even percentage (e.g. 65.4 means 65.4% of capacity)
 */
export function calculateBreakEven(
  fixedCosts: number,
  salesRevenue: number,
  variableCosts: number,
): number {
  const contribution = salesRevenue - variableCosts;
  if (contribution <= 0) return 0;
  return (fixedCosts / contribution) * 100;
}

/**
 * Calculate straight-line depreciation.
 *
 * @param assetCost - Cost of the asset in rupees
 * @param usefulLifeYears - Useful life in years
 * @param salvageValue - Salvage value at end of life (default: 0)
 * @returns Annual depreciation in rupees
 */
export function calculateDepreciation(
  assetCost: number,
  usefulLifeYears: number,
  salvageValue: number = 0,
): number {
  if (usefulLifeYears <= 0) return 0;
  return Math.round((assetCost - salvageValue) / usefulLifeYears);
}

// ── Word-Count Helper ───────────────────────────────────────────────────────

function countWords(text: string): number {
  const t = text.trim();
  return t.length === 0 ? 0 : t.split(/\s+/).length;
}

function sectionWordCount(section: DprSection): number {
  let w = countWords(section.content);
  if (section.tables) {
    for (const tbl of section.tables) {
      w += countWords(tbl.caption);
      for (const h of tbl.headers) w += countWords(h);
      for (const row of tbl.rows) {
        for (const cell of row) w += countWords(cell);
      }
    }
  }
  return w;
}

// ── Internal: Compute 3-Year P&L Projection ─────────────────────────────────

interface ProjectionContext {
  profile: ProjectProfile;
  financial: FinancialResult;
}

function computeProfitLossProjection(ctx: ProjectionContext): ProfitLossRow[] {
  const { profile: p, financial: f } = ctx;
  const rows: ProfitLossRow[] = [];

  // Year 1 base values
  const year1Revenue = f.annualRevenue;
  const year1RawMaterials = p.rawMaterials.totalMonthlyCost * 12;
  const year1Wages = p.employees.totalMonthlyWages * 12;
  const year1Utilities = p.utilities.totalMonthlyOverheads * 12;
  const year1Depreciation = f.annualDepreciation;

  // Operating expenses (rent, transport, communication, insurance, misc — excluding power/water/maintenance already in utilities)
  const year1Rent = p.utilities.monthlyRentCost * 12;
  const year1Transport = p.utilities.monthlyTransportCost * 12;
  const year1AdminOverheads =
    (p.utilities.monthlyCommunicationCost +
      p.utilities.monthlyInsuranceCost +
      p.utilities.monthlyMiscCost) *
    12;

  // Annual interest from loan schedule (first year of actual repayment)
  let yearInterest = 0;
  const repaymentStart = f.repaymentMoratoriumMonths + 1;
  let monthsCounted = 0;
  for (const entry of f.loanSchedule) {
    if (
      entry.month >= repaymentStart &&
      entry.emi > 0 &&
      monthsCounted < 12
    ) {
      yearInterest += entry.interest;
      monthsCounted++;
    }
  }
  yearInterest = Math.round(yearInterest);

  for (let year = 1; year <= 3; year++) {
    const growthFactor = Math.pow(1 + REVENUE_GROWTH_PERCENT / 100, year - 1);
    const costFactor = Math.pow(1 + COST_ESCALATION_PERCENT / 100, year - 1);

    const salesRevenue = Math.round(year1Revenue * growthFactor);
    const rawMaterials = Math.round(year1RawMaterials * costFactor);
    const wages = Math.round(year1Wages * costFactor);
    const utilities = Math.round(year1Utilities * costFactor);
    const depreciation = year1Depreciation; // Straight-line, constant
    const rent = Math.round(year1Rent * costFactor);
    const transport = Math.round(year1Transport * costFactor);
    const admin = Math.round(year1AdminOverheads * costFactor);

    const costOfProduction = rawMaterials + wages + utilities + depreciation;
    const grossProfit = salesRevenue - costOfProduction;
    const operatingExpenses = rent + transport + admin + yearInterest;
    const netProfit = grossProfit - operatingExpenses;
    const netMargin =
      salesRevenue > 0 ? Math.round((netProfit / salesRevenue) * 10000) / 100 : 0;

    rows.push({
      year,
      salesRevenue,
      costOfProduction,
      grossProfit,
      operatingExpenses,
      netProfit,
      netMargin,
    });
  }

  return rows;
}

// ── Internal: Compute Yearly DSCR from Loan Schedule ────────────────────────

function computeYearlyDSCR(
  f: FinancialResult,
  p: ProjectProfile,
): { year: number; dscr: number; annualPrincipal: number; annualInterest: number }[] {
  const results: { year: number; dscr: number; annualPrincipal: number; annualInterest: number }[] = [];
  const netProfit = f.annualNetProfit;
  const depreciation = f.annualDepreciation;

  let yearCount = 0;
  let yearPrincipal = 0;
  let yearInterest = 0;
  const repaymentStart = f.repaymentMoratoriumMonths + 1;

  for (const entry of f.loanSchedule) {
    if (entry.month >= repaymentStart && entry.emi > 0) {
      yearPrincipal += entry.principal;
      yearInterest += entry.interest;

      if (entry.closingBalance === 0 || yearCount === 11) {
        // End of a year or loan fully repaid
        yearCount++;
        const debtService = yearPrincipal + yearInterest;
        const dscr = debtService > 0
          ? (netProfit + depreciation + yearInterest) / debtService
          : 0;

        results.push({
          year: yearCount,
          dscr: Math.round(dscr * 100) / 100,
          annualPrincipal: Math.round(yearPrincipal),
          annualInterest: Math.round(yearInterest),
        });

        yearPrincipal = 0;
        yearInterest = 0;
        yearCount = 0;
      } else {
        yearCount++;
      }

      // Stop after 3 years
      if (results.length >= 3) break;
    }
  }

  // If we didn't get 3 years (e.g. short tenure), pad with available
  while (results.length < 3) {
    results.push({
      year: results.length + 1,
      dscr: 0,
      annualPrincipal: 0,
      annualInterest: 0,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Section 1: Executive Summary ────────────────────────────────────────────

function buildExecutiveSummary(
  p: ProjectProfile,
  f: FinancialResult,
  e: EligibilityResult,
): DprSection {
  const eligible = e.eligible
    ? "**Eligible** under the PMEGP scheme"
    : `**Not eligible** \u2014 ${e.blockers.length} blocker(s) identified`;

  const subsidyAgency =
    p.location.area === "RURAL"
      ? "DRDA (District Rural Development Agency)"
      : "KVIC (Khadi and Village Industries Commission)";

  const content =
    `This Detailed Project Report (DPR) presents the techno-economic feasibility of ` +
    `the proposed **${p.business.name}**, a ${p.business.activityType.toLowerCase()} unit ` +
    `engaged in **${p.business.description}** under NIC Code **${p.business.nicCode ?? "N/A"}** ` +
    `(${p.business.nicDescription ?? "Activity not yet classified"}).\n\n` +
    `**Project Highlights:**\n` +
    `- **Project Cost:** ${formatIndianCurrency(f.totalProjectCost)} (${formatIndianWords(f.totalProjectCost)})\n` +
    `- **Own Contribution:** ${formatIndianCurrency(f.ownContribution)} (${f.ownContributionPercent}%)\n` +
    `- **Bank Loan:** ${formatIndianCurrency(f.bankFinance)}\n` +
    `- **PMEGP Subsidy:** ${formatIndianCurrency(f.subsidyAmount)} at ${f.subsidyRate}% (${subsidyAgency})\n` +
    `- **Location:** ${p.location.district}, ${p.location.state} (${p.location.area === "RURAL" ? "Rural" : "Urban"})\n` +
    `- **Employment Generated:** ${p.employees.totalEmployment} persons\n` +
    `- **Projected Annual Net Profit:** ${formatIndianCurrency(f.annualNetProfit)}\n` +
    `- **DSCR:** ${f.dscr.toFixed(2)} ${f.dscr >= 1.25 ? "(meets bank requirement)" : "(below 1.25 bank requirement)"}\n` +
    `- **Break-even:** ${f.breakEvenPercent.toFixed(2)}% of capacity utilisation\n\n` +
    `The unit will operate at ${p.capacity.projectedCapacityUtil}% capacity utilisation ` +
    `with an installed capacity of ${p.capacity.installedCapacity.value} ${p.capacity.installedCapacity.unit}. ` +
    `The repayment of the term loan of ${formatIndianCurrency(f.bankTermLoan)} is ` +
    `planned over ${f.loanTenureMonths} months with a moratorium of ${f.repaymentMoratoriumMonths} months.\n\n` +
    `Eligibility assessment: ${eligible}.`;

  return {
    id: "executive-summary",
    title: "1. Executive Summary",
    content,
    order: 1,
  };
}

// ── Section 2: Business Profile / About the Entrepreneur ───────────────────

function buildBusinessProfile(p: ProjectProfile): DprSection {
  const { applicant: a } = p;

  const rows: string[][] = [
    ["Name of Applicant", a.name],
    ["Age", `${a.age} years`],
    ["Gender", GENDER_LABEL[a.gender]],
    ["Category", CATEGORY_LABEL[a.category]],
    [
      "Education",
      EDUCATION_LABEL[a.education] +
        (a.educationDetail ? ` (${a.educationDetail})` : ""),
    ],
    ["Entity Type", ENTITY_TYPE_LABEL[a.entityType]],
  ];

  if (a.entityRegistrationNo) {
    rows.push(["Registration Number", a.entityRegistrationNo]);
  }

  rows.push([
    "Prior PMEGP/PMRY Subsidy",
    a.priorSubsidy
      ? "Yes" + (a.priorSubsidyDetail ? ` \u2014 ${a.priorSubsidyDetail}` : "")
      : "No",
  ]);

  rows.push([
    "EDP Training Completed",
    a.edpCompleted
      ? "Yes" +
        (a.edpCertificateNo ? ` (Certificate: ${a.edpCertificateNo})` : "")
      : "No",
  ]);

  if (a.experienceYears !== undefined) {
    rows.push([
      "Relevant Experience",
      `${a.experienceYears} year(s)` +
        (a.experienceDetail ? ` \u2014 ${a.experienceDetail}` : ""),
    ]);
  }

  const content =
    `The following table provides the details of the applicant/promoter of the ` +
    `proposed unit. The promoter belongs to the **${CATEGORY_LABEL[a.category]}** ` +
    `category and proposes to establish the business as a ` +
    `**${ENTITY_TYPE_LABEL[a.entityType]}**.\n\n` +
    `**Rationale for choosing this activity:**\n\n` +
    (a.experienceDetail
      ? `The applicant has ${a.experienceYears ?? "relevant"} years of experience in ` +
        `the field (${a.experienceDetail}), which provides the necessary technical ` +
        `and market knowledge to successfully run this enterprise. `
      : "") +
    `The proposed activity of ${p.business.description} has been identified as ` +
    `a viable venture with consistent demand in the ${p.location.district}, ${p.location.state} region. ` +
    `The PMEGP scheme provides the ideal financing support through subsidy and bank ` +
    `loan to establish this unit.`;

  return {
    id: "business-profile",
    title: "2. Business Profile / About the Entrepreneur",
    content,
    tables: [
      {
        caption: "Table 2.1: Promoter Details",
        headers: ["Particulars", "Details"],
        rows,
      },
    ],
    order: 2,
  };
}

// ── Section 3: Market Analysis ──────────────────────────────────────────────

function buildMarketAnalysis(p: ProjectProfile): DprSection {
  const { market: m } = p;

  const rows: string[][] = [
    ["Target Market", m.targetMarket],
    ["Market Demand", m.marketDemand ?? "Not specified"],
    ["Competition", m.competition ?? "Not specified"],
    ["Marketing Strategy", m.marketingStrategy ?? "Not specified"],
    [
      "Selling Price",
      m.sellingPricePerUnit !== undefined
        ? `${formatIndianCurrency(m.sellingPricePerUnit)} per ${m.sellingPriceUnit ?? "unit"}`
        : "Not specified",
    ],
  ];

  const competitionText = m.competition ?? "moderate competition expected in the local market";
  const demandText = m.marketDemand ?? "demand exists based on local consumption patterns and market survey";

  const content =
    `**Target Market Description:**\n\n` +
    `The unit will cater to the ${m.targetMarket}. ` +
    `${demandText}.\n\n` +
    `**Market Demand Justification:**\n\n` +
    `The market demand for ${p.business.description} in the ${p.location.district} region is ` +
    `supported by growing local consumption and demand-supply gap. The projected monthly ` +
    `sales of ${formatIndianCurrency(p.financials.projectedMonthlySales)} indicate ` +
    `a viable market for the proposed capacity of ${p.capacity.installedCapacity.value} ` +
    `${p.capacity.installedCapacity.unit} at ${p.capacity.projectedCapacityUtil}% utilisation.\n\n` +
    `**Competition Overview:**\n\n` +
    `${competitionText}. The unit will compete on quality, timely delivery, and ` +
    `competitive pricing. ${m.sellingPricePerUnit !== undefined
      ? `The proposed selling price of ${formatIndianCurrency(m.sellingPricePerUnit)} ` +
        `per ${m.sellingPriceUnit ?? "unit"} is competitive for the target market.`
      : ""}\n\n` +
    `**Marketing Strategy:**\n\n` +
    (m.marketingStrategy
      ? m.marketingStrategy
      : `The marketing strategy includes direct sales to local customers, participation ` +
        `in local trade fairs and exhibitions, word-of-mouth promotion, and establishing ` +
        `relationships with local retailers and wholesalers.`);

  return {
    id: "market-analysis",
    title: "3. Market Analysis",
    content,
    tables: [
      {
        caption: "Table 3.1: Market Overview",
        headers: ["Particulars", "Details"],
        rows,
      },
    ],
    order: 3,
  };
}

// ── Section 4: Manufacturing / Service Process ──────────────────────────────

function buildManufacturingProcess(p: ProjectProfile): DprSection {
  const { business: b } = p;
  const isManufacturing = b.activityType === "MANUFACTURING";

  const processSteps = isManufacturing
    ? [
        "Procurement of raw materials from verified suppliers",
        "Quality inspection and storage of raw materials",
        "Preparation / pre-processing of raw materials",
        "Main production / manufacturing process",
        "Quality control and in-process inspection",
        "Finishing, packaging, and labelling",
        "Storage of finished goods",
        "Dispatch and distribution to customers",
      ]
    : [
        "Client enquiry and requirement assessment",
        "Service proposal and cost estimation",
        "Resource / material preparation",
        "Service delivery / execution",
        "Quality check and verification",
        "Documentation and handover to client",
        "Follow-up and feedback collection",
        "Maintenance and after-service support",
      ];

  const stepRows: string[][] = processSteps.map((step, i) => [
    `${i + 1}`,
    step,
  ]);

  const processType = isManufacturing ? "manufacturing" : "service delivery";
  const activityDesc = b.nicDescription ?? b.description;

  const content =
    `The proposed unit will carry out the activity of **${activityDesc}** ` +
    `(NIC Code: ${b.nicCode ?? "N/A"}). The ${processType} process is described below:\n\n` +
    `### Process Flow\n\n` +
    `The ${processType} process follows a systematic approach to ensure consistent ` +
    `quality and efficient output. The unit will operate ${p.capacity.shifts} shift(s) ` +
    `per day, ${p.capacity.workingHoursPerDay} hours per shift, and ${p.capacity.workingDaysPerMonth} ` +
    `working days per month, yielding an installed capacity of ` +
    `${p.capacity.installedCapacity.value} ${p.capacity.installedCapacity.unit}.\n\n` +
    `At the projected capacity utilisation of **${p.capacity.projectedCapacityUtil}%**, ` +
    `the effective monthly output is estimated at approximately ` +
    `**${Math.round((p.capacity.installedCapacity.value * p.capacity.projectedCapacityUtil) / 100)} ` +
    `${p.capacity.installedCapacity.unit}**.`;

  return {
    id: "manufacturing-process",
    title: `4. ${isManufacturing ? "Manufacturing" : "Service"} Process`,
    content,
    tables: [
      {
        caption: `Table 4.1: Step-by-Step ${isManufacturing ? "Manufacturing" : "Service"} Process`,
        headers: ["Step", "Description"],
        rows: stepRows,
      },
    ],
    order: 4,
  };
}

// ── Section 5: Machinery & Equipment ────────────────────────────────────────

function buildMachinery(p: ProjectProfile): DprSection {
  const { machinery: m } = p;

  const headers = [
    "S.No.",
    "Name of Machine/Equipment",
    "Specification",
    "Qty",
    "Unit Cost (\u20B9)",
    "Total Cost (\u20B9)",
  ];
  const rows: string[][] = m.items.map((item, i) => [
    `${i + 1}`,
    item.name,
    item.specification ?? "\u2014",
    `${item.quantity}`,
    formatIndianCurrency(item.unitCost),
    formatIndianCurrency(item.totalCost),
  ]);

  // Grand-total row
  rows.push([
    "",
    "**Total**",
    "",
    "",
    "",
    `**${formatIndianCurrency(m.totalCost)}**`,
  ]);

  // Determine source
  const localCount = m.items.filter((item) => !item.supplier || item.supplier.toLowerCase().includes("local")).length;
  const sourceText =
    localCount === m.items.length
      ? "All machinery and equipment will be sourced from local suppliers within India."
      : "Machinery and equipment will be sourced from a combination of local and out-of-state suppliers within India.";

  const content =
    `The following machinery and equipment is required for the proposed unit. ` +
    `The total cost of machinery and equipment is **${formatIndianCurrency(m.totalCost)}** ` +
    `(${formatIndianWords(m.totalCost)}).\n\n` +
    `**Source of Machinery:** ${sourceText} ` +
    `Quotations have been obtained from established suppliers. ` +
    `Installation and commissioning will be done under the supervision of the supplier.`;

  return {
    id: "machinery-equipment",
    title: "5. Machinery & Equipment",
    content,
    tables: [
      {
        caption: "Table 5.1: Machinery & Equipment Details",
        headers,
        rows,
      },
    ],
    order: 5,
  };
}

// ── Section 6: Raw Materials ────────────────────────────────────────────────

function buildRawMaterials(p: ProjectProfile): DprSection {
  const { rawMaterials: rm } = p;

  const headers = [
    "S.No.",
    "Raw Material",
    "Specification",
    "Monthly Qty",
    "Unit",
    "Rate (\u20B9)",
    "Monthly Cost (\u20B9)",
    "Annual Cost (\u20B9)",
  ];
  const rows: string[][] = rm.items.map((item, i) => [
    `${i + 1}`,
    item.name,
    item.specification ?? "\u2014",
    `${item.monthlyQuantity}`,
    item.unit,
    formatIndianCurrency(item.unitRate),
    formatIndianCurrency(item.totalMonthlyCost),
    formatIndianCurrency(item.totalMonthlyCost * 12),
  ]);

  const annualCost = rm.totalMonthlyCost * 12;

  rows.push([
    "",
    "**Total**",
    "",
    "",
    "",
    "",
    `**${formatIndianCurrency(rm.totalMonthlyCost)}**`,
    `**${formatIndianCurrency(annualCost)}**`,
  ]);

  const content =
    `The following raw materials are required on a monthly and annual basis for the ` +
    `production process. The total monthly raw material cost is ` +
    `**${formatIndianCurrency(rm.totalMonthlyCost)}** and the annual cost is ` +
    `**${formatIndianCurrency(annualCost)}**. Raw materials will be procured from ` +
    `local suppliers to ensure timely availability and minimise transportation costs.`;

  return {
    id: "raw-materials",
    title: "6. Raw Materials",
    content,
    tables: [
      {
        caption: "Table 6.1: Raw Material Requirements",
        headers,
        rows,
      },
    ],
    order: 6,
  };
}

// ── Section 7: Utilities & Overheads ────────────────────────────────────────

function buildUtilities(p: ProjectProfile): DprSection {
  const { utilities: u } = p;

  const rows: string[][] = [
    ["Power & Electricity", formatIndianCurrency(u.monthlyPowerCost), formatIndianCurrency(u.monthlyPowerCost * 12)],
    ["Water", formatIndianCurrency(u.monthlyWaterCost), formatIndianCurrency(u.monthlyWaterCost * 12)],
    ["Rent", formatIndianCurrency(u.monthlyRentCost), formatIndianCurrency(u.monthlyRentCost * 12)],
    ["Maintenance & Repairs", formatIndianCurrency(u.monthlyMaintenanceCost), formatIndianCurrency(u.monthlyMaintenanceCost * 12)],
    ["Transport", formatIndianCurrency(u.monthlyTransportCost), formatIndianCurrency(u.monthlyTransportCost * 12)],
    ["Communication (Telephone/Internet)", formatIndianCurrency(u.monthlyCommunicationCost), formatIndianCurrency(u.monthlyCommunicationCost * 12)],
    ["Insurance", formatIndianCurrency(u.monthlyInsuranceCost), formatIndianCurrency(u.monthlyInsuranceCost * 12)],
    ["Miscellaneous Expenses", formatIndianCurrency(u.monthlyMiscCost), formatIndianCurrency(u.monthlyMiscCost * 12)],
    [
      "**Total Monthly Overheads**",
      `**${formatIndianCurrency(u.totalMonthlyOverheads)}**`,
      `**${formatIndianCurrency(u.totalMonthlyOverheads * 12)}**`,
    ],
  ];

  const content =
    `The monthly and annual utility and overhead costs for running the unit are detailed below. ` +
    `The total monthly overhead is **${formatIndianCurrency(u.totalMonthlyOverheads)}** ` +
    `and the annual overhead is **${formatIndianCurrency(u.totalMonthlyOverheads * 12)}**.\n\n` +
    `Power consumption is based on the installed machinery capacity. Rent is ` +
    `${p.land.status === "OWN" || p.land.status === "FAMILY" ? "not applicable as the land/building is owned." : "based on the prevailing market rates in the area."}`;

  return {
    id: "utilities-overheads",
    title: "7. Utilities & Overheads",
    content,
    tables: [
      {
        caption: "Table 7.1: Monthly & Annual Utilities & Overheads",
        headers: ["Particulars", "Monthly Cost (\u20B9)", "Annual Cost (\u20B9)"],
        rows,
      },
    ],
    order: 7,
  };
}

// ── Section 8: Staffing / Manpower ──────────────────────────────────────────

function buildStaffing(p: ProjectProfile): DprSection {
  const { employees: emp } = p;

  const skilledTotal = emp.skilled.male + emp.skilled.female;
  const unskilledTotal = emp.unskilled.male + emp.unskilled.female;
  const skilledWages = skilledTotal * emp.skilled.monthlyWagePerPerson;
  const unskilledWages = unskilledTotal * emp.unskilled.monthlyWagePerPerson;
  const adminWages = emp.administrative.count * emp.administrative.monthlyWagePerPerson;

  // Owner/Manager row — owner draws a salary from profits, shown as 0 here
  const ownerWages = 0;

  const rows: string[][] = [
    [
      "Skilled Workers",
      `${emp.skilled.male}`,
      `${emp.skilled.female}`,
      `${skilledTotal}`,
      formatIndianCurrency(emp.skilled.monthlyWagePerPerson),
      formatIndianCurrency(skilledWages),
    ],
    [
      "Unskilled Workers",
      `${emp.unskilled.male}`,
      `${emp.unskilled.female}`,
      `${unskilledTotal}`,
      formatIndianCurrency(emp.unskilled.monthlyWagePerPerson),
      formatIndianCurrency(unskilledWages),
    ],
    [
      "Administrative Staff",
      "\u2014",
      "\u2014",
      `${emp.administrative.count}`,
      formatIndianCurrency(emp.administrative.monthlyWagePerPerson),
      formatIndianCurrency(adminWages),
    ],
    [
      "Owner/Manager",
      "1",
      "0",
      "1",
      "N/A (from profits)",
      formatIndianCurrency(ownerWages),
    ],
    [
      "**Total**",
      `**${emp.skilled.male + emp.unskilled.male + 1}**`,
      `**${emp.skilled.female + emp.unskilled.female}**`,
      `**${emp.totalEmployment + 1}**`,
      "",
      `**${formatIndianCurrency(emp.totalMonthlyWages)}**`,
    ],
  ];

  const content =
    `The project will generate direct employment for **${emp.totalEmployment + 1} persons** ` +
    `(including the owner/manager), comprising ${skilledTotal} skilled, ${unskilledTotal} ` +
    `unskilled workers, ${emp.administrative.count} administrative staff, and 1 owner/manager. ` +
    `The total monthly wage bill is **${formatIndianCurrency(emp.totalMonthlyWages)}** and ` +
    `the annual wage bill is **${formatIndianCurrency(emp.totalMonthlyWages * 12)}**.\n\n` +
    `Wages are as per the minimum wage norms prescribed by the respective state government ` +
    `and are competitive for the local labour market.`;

  return {
    id: "staffing-manpower",
    title: "8. Staffing / Manpower",
    content,
    tables: [
      {
        caption: "Table 8.1: Employment & Manpower Details",
        headers: [
          "Category",
          "Male",
          "Female",
          "Total",
          "Wage/Person/Month (\u20B9)",
          "Total Monthly Wages (\u20B9)",
        ],
        rows,
      },
    ],
    order: 8,
  };
}

// ── Section 9: Means of Finance ─────────────────────────────────────────────

function buildMeansOfFinance(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  const subsidyAgency =
    p.location.area === "RURAL"
      ? "DRDA"
      : "KVIC/KVIB";

  const ownEquityTotal = f.ownContribution + f.subsidyAmount;
  const ownEquityPercent = f.totalProjectCost > 0
    ? Math.round((ownEquityTotal / f.totalProjectCost) * 10000) / 100
    : 0;
  const bankPercent = f.totalProjectCost > 0
    ? Math.round((f.bankFinance / f.totalProjectCost) * 10000) / 100
    : 0;

  const rows: string[][] = [
    ["Own Equity (Subsidy + Own Contribution)", formatIndianCurrency(ownEquityTotal), `${ownEquityPercent}%`],
    ["  \u2014 Own Contribution", formatIndianCurrency(f.ownContribution), `${f.ownContributionPercent}%`],
    [`  \u2014 PMEGP Subsidy (${f.subsidyRate}% via ${subsidyAgency})`, formatIndianCurrency(f.subsidyAmount), ""],
    ["Bank Loan", formatIndianCurrency(f.bankFinance), `${bankPercent}%`],
    ["  \u2014 Term Loan", formatIndianCurrency(f.bankTermLoan), ""],
    ["  \u2014 Working Capital Loan", formatIndianCurrency(f.bankWorkingCapital), ""],
    ["**Total Project Cost**", `**${formatIndianCurrency(f.totalProjectCost)}**`, "**100%**"],
  ];

  const content =
    `The project is estimated to cost **${formatIndianCurrency(f.totalProjectCost)}** ` +
    `(${formatIndianWords(f.totalProjectCost)}) in total. The means of finance are:\n\n` +
    `- **Own Equity** (Subsidy + Own Contribution): ${formatIndianCurrency(ownEquityTotal)} (${ownEquityPercent}%)\n` +
    `  - Promoter's own contribution: ${formatIndianCurrency(f.ownContribution)} (${f.ownContributionPercent}%)\n` +
    `  - PMEGP subsidy at ${f.subsidyRate}%: ${formatIndianCurrency(f.subsidyAmount)} (via ${subsidyAgency})\n` +
    `- **Bank Loan**: ${formatIndianCurrency(f.bankFinance)} (${bankPercent}%)\n` +
    `  - Term Loan: ${formatIndianCurrency(f.bankTermLoan)}\n` +
    `  - Working Capital Loan: ${formatIndianCurrency(f.bankWorkingCapital)}\n\n` +
    `Note: As per PMEGP guidelines, the subsidy amount forms part of the borrower's equity ` +
    `and is credited to the borrower's loan account after disbursement by the bank.`;

  return {
    id: "means-of-finance",
    title: "9. Means of Finance",
    content,
    tables: [
      {
        caption: "Table 9.1: Means of Finance",
        headers: ["Source", "Amount (\u20B9)", "% of Total"],
        rows,
      },
    ],
    order: 9,
  };
}

// ── Section 10: Profit & Loss Account (3-Year Projection) ───────────────────

function buildProfitAndLoss(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  const plRows = computeProfitLossProjection({ profile: p, financial: f });

  const tableRows: string[][] = plRows.map((row) => [
    `Year ${row.year}`,
    formatIndianCurrency(row.salesRevenue),
    formatIndianCurrency(row.costOfProduction),
    formatIndianCurrency(row.grossProfit),
    formatIndianCurrency(row.operatingExpenses),
    formatIndianCurrency(row.netProfit),
    `${row.netMargin}%`,
  ]);

  const year1 = plRows[0];
  const content =
    `The following table presents the 3-year projected Profit & Loss Account. ` +
    `Projections assume a revenue growth of ${REVENUE_GROWTH_PERCENT}% per annum ` +
    `and a cost escalation of ${COST_ESCALATION_PERCENT}% per annum for raw materials ` +
    `and wages. Depreciation is calculated on a straight-line basis over ` +
    `${DEPRECIATION_YEARS} years with zero salvage value.\n\n` +
    `**Year 1 Summary:**\n` +
    `- Sales Revenue: ${formatIndianCurrency(year1.salesRevenue)}\n` +
    `- Cost of Production: ${formatIndianCurrency(year1.costOfProduction)} (includes raw materials, wages, utilities, depreciation)\n` +
    `- Gross Profit: ${formatIndianCurrency(year1.grossProfit)}\n` +
    `- Net Profit: ${formatIndianCurrency(year1.netProfit)} (Net Margin: ${year1.netMargin}%)\n\n` +
    `The project shows a positive net margin from Year 1, indicating viability ` +
    `even in the initial year of operations.`;

  return {
    id: "profit-loss-account",
    title: "10. Profit & Loss Account (3-Year Projection)",
    content,
    tables: [
      {
        caption: "Table 10.1: Projected Profit & Loss Account",
        headers: [
          "Year",
          "Sales Revenue (\u20B9)",
          "Cost of Production (\u20B9)",
          "Gross Profit (\u20B9)",
          "Operating Expenses (\u20B9)",
          "Net Profit (\u20B9)",
          "Net Margin",
        ],
        rows: tableRows,
      },
    ],
    order: 10,
  };
}

// ── Section 11: Cash Flow Statement ─────────────────────────────────────────

function buildCashFlow(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  const monthlySales = p.financials.projectedMonthlySales;
  const monthlyRM = p.rawMaterials.totalMonthlyCost;
  const monthlyWages = p.employees.totalMonthlyWages;
  const monthlyUtilities = p.utilities.totalMonthlyOverheads;

  const year1Sales = monthlySales * 12;
  const year1RM = monthlyRM * 12;
  const year1Wages = monthlyWages * 12;
  const year1Utilities = monthlyUtilities * 12;

  const inflowSales = year1Sales;
  const inflowBank = f.bankTermLoan + f.bankWorkingCapital;
  const inflowSubsidy = f.subsidyAmount;
  const inflowOwn = f.ownContribution;
  const totalInflows = inflowSales + inflowBank + inflowSubsidy + inflowOwn;

  const outflowMachinery = p.financials.machineryAndEquipment;
  const outflowBuilding = p.financials.buildingAndCivilWorks;
  const outflowPreOp = p.financials.preOperativeExpenses;
  const outflowRM = year1RM;
  const outflowWages = year1Wages;
  const outflowUtilities = year1Utilities;
  const outflowRent = p.utilities.monthlyRentCost * 12;

  // Annual loan repayment (principal only from first repayment year)
  let annualPrincipal = 0;
  let annualInterestPayment = 0;
  const repaymentStart = f.repaymentMoratoriumMonths + 1;
  let monthsCounted = 0;
  for (const entry of f.loanSchedule) {
    if (
      entry.month >= repaymentStart &&
      entry.emi > 0 &&
      monthsCounted < 12
    ) {
      annualPrincipal += entry.principal;
      annualInterestPayment += entry.interest;
      monthsCounted++;
    }
  }

  const totalOutflows =
    outflowMachinery + outflowBuilding + outflowPreOp +
    outflowRM + outflowWages + outflowUtilities + outflowRent +
    annualPrincipal + annualInterestPayment;

  const netCashFlow = totalInflows - totalOutflows;
  const closingBalance = netCashFlow;

  const rows: string[][] = [
    ["**INFLOWS**", "", ""],
    ["  Sales Revenue", formatIndianCurrency(inflowSales), ""],
    ["  Bank Loan (Term + WC)", formatIndianCurrency(inflowBank), ""],
    ["  PMEGP Subsidy", formatIndianCurrency(inflowSubsidy), ""],
    ["  Own Contribution", formatIndianCurrency(inflowOwn), ""],
    ["  **Total Inflows (A)**", `**${formatIndianCurrency(totalInflows)}**`, ""],
    ["", "", ""],
    ["**OUTFLOWS**", "", ""],
    ["  Machinery & Equipment", formatIndianCurrency(outflowMachinery), ""],
    ["  Building & Civil Works", formatIndianCurrency(outflowBuilding), ""],
    ["  Pre-operative Expenses", formatIndianCurrency(outflowPreOp), ""],
    ["  Raw Materials", formatIndianCurrency(outflowRM), ""],
    ["  Wages & Salaries", formatIndianCurrency(outflowWages), ""],
    ["  Utilities & Overheads", formatIndianCurrency(outflowUtilities), ""],
    ["  Rent", formatIndianCurrency(outflowRent), ""],
    ["  Loan Repayment (Principal)", formatIndianCurrency(annualPrincipal), ""],
    ["  Loan Repayment (Interest)", formatIndianCurrency(annualInterestPayment), ""],
    ["  **Total Outflows (B)**", `**${formatIndianCurrency(totalOutflows)}**`, ""],
    ["", "", ""],
    ["**Net Cash Flow (A \u2212 B)**", `**${formatIndianCurrency(netCashFlow)}**`, ""],
  ];

  const content =
    `The following table presents the projected cash flow statement for Year 1. ` +
    `Inflows include sales revenue, bank loan disbursement, PMEGP subsidy, and ` +
    `the promoter's own contribution. Outflows include capital expenditure, ` +
    `operating costs, and loan repayments.\n\n` +
    `The net cash flow for Year 1 is **${formatIndianCurrency(netCashFlow)}**. ` +
    `Positive cash flow from Year 1 indicates the project's ability to meet ` +
    `its financial obligations from operations.`;

  return {
    id: "cash-flow-statement",
    title: "11. Cash Flow Statement (Year 1)",
    content,
    tables: [
      {
        caption: "Table 11.1: Projected Cash Flow Statement \u2014 Year 1",
        headers: ["Particulars", "Amount (\u20B9)", "Remarks"],
        rows,
      },
    ],
    order: 11,
  };
}

// ── Section 12: Balance Sheet ───────────────────────────────────────────────

function buildBalanceSheet(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  const machineryDep = f.annualDepreciation;
  const buildingCost = p.financials.buildingAndCivilWorks;
  const buildingDep = calculateDepreciation(buildingCost, BUILDING_DEPRECIATION_YEARS);
  const totalDepreciation = machineryDep + buildingDep;

  // FIXED ASSETS
  const grossFixedAssets =
    p.financials.machineryAndEquipment +
    p.financials.otherFixedAssets +
    buildingCost;
  const netFixedAssets = grossFixedAssets - totalDepreciation;

  // CURRENT ASSETS
  const rawMaterialInventory = p.rawMaterials.totalMonthlyCost; // 1 month stock
  const cashBalance = f.annualNetProfit; // Approximate cash at year end
  const receivables = Math.round(p.financials.projectedMonthlySales * 0.5); // 15 days receivables
  const totalCurrentAssets = rawMaterialInventory + cashBalance + receivables;

  // TOTAL ASSETS
  const totalAssets = netFixedAssets + totalCurrentAssets;

  // LIABILITIES
  let outstandingLoan = 0;
  for (const entry of f.loanSchedule) {
    if (entry.closingBalance > outstandingLoan) {
      outstandingLoan = entry.closingBalance;
    }
  }
  // Find the closing balance at month 12
  for (const entry of f.loanSchedule) {
    if (entry.month === 12) {
      outstandingLoan = entry.closingBalance;
      break;
    }
  }

  const currentLiabilities = Math.round(p.rawMaterials.totalMonthlyCost * 0.5); // ~15 days creditors
  const totalLiabilities = outstandingLoan + currentLiabilities;

  // OWNER'S EQUITY
  const ownersEquity = totalAssets - totalLiabilities;

  const rows: string[][] = [
    ["**ASSETS**", "", ""],
    ["**Fixed Assets**", "", ""],
    ["  Machinery & Equipment (Gross)", formatIndianCurrency(p.financials.machineryAndEquipment), ""],
    ["  Less: Accumulated Depreciation", `(${formatIndianCurrency(machineryDep)})`, ""],
    ["  Net Machinery & Equipment", formatIndianCurrency(p.financials.machineryAndEquipment - machineryDep), ""],
    ["  Building & Civil Works (Gross)", formatIndianCurrency(buildingCost), ""],
    ["  Less: Depreciation", `(${formatIndianCurrency(buildingDep)})`, ""],
    ["  Net Building & Civil Works", formatIndianCurrency(buildingCost - buildingDep), ""],
    ["  Other Fixed Assets", formatIndianCurrency(p.financials.otherFixedAssets), ""],
    ["  **Total Fixed Assets (A)**", `**${formatIndianCurrency(netFixedAssets)}**`, ""],
    ["", "", ""],
    ["**Current Assets**", "", ""],
    ["  Raw Material Inventory (1 month)", formatIndianCurrency(rawMaterialInventory), ""],
    ["  Cash & Bank Balance", formatIndianCurrency(cashBalance), ""],
    ["  Sundry Debtors / Receivables", formatIndianCurrency(receivables), ""],
    ["  **Total Current Assets (B)**", `**${formatIndianCurrency(totalCurrentAssets)}**`, ""],
    ["", "", ""],
    ["**Total Assets (A + B)**", `**${formatIndianCurrency(totalAssets)}**`, ""],
    ["", "", ""],
    ["**LIABILITIES & EQUITY**", "", ""],
    ["**Long-term Liabilities**", "", ""],
    ["  Bank Term Loan (Outstanding)", formatIndianCurrency(outstandingLoan), ""],
    ["**Current Liabilities**", "", ""],
    ["  Sundry Creditors / Payables", formatIndianCurrency(currentLiabilities), ""],
    ["**Total Liabilities (C)**", `**${formatIndianCurrency(totalLiabilities)}**`, ""],
    ["", "", ""],
    ["**Owner's Equity (D)**", `**${formatIndianCurrency(ownersEquity)}**`, ""],
    ["", "", ""],
    ["**Total Liabilities + Equity (C + D)**", `**${formatIndianCurrency(totalLiabilities + ownersEquity)}**`, ""],
  ];

  const content =
    `The projected Balance Sheet as at the end of Year 1 is presented below. ` +
    `Depreciation on machinery is calculated on a straight-line basis over ` +
    `${DEPRECIATION_YEARS} years. Building depreciation is over ${BUILDING_DEPRECIATION_YEARS} years.\n\n` +
    `Total Assets: **${formatIndianCurrency(totalAssets)}**\n` +
    `Total Liabilities: **${formatIndianCurrency(totalLiabilities)}**\n` +
    `Owner's Equity: **${formatIndianCurrency(ownersEquity)}**\n\n` +
    `The positive owner's equity indicates a healthy financial position at the ` +
    `end of the first year of operations.`;

  return {
    id: "balance-sheet",
    title: "12. Balance Sheet (Projected \u2014 End of Year 1)",
    content,
    tables: [
      {
        caption: "Table 12.1: Projected Balance Sheet",
        headers: ["Particulars", "Amount (\u20B9)", "Remarks"],
        rows,
      },
    ],
    order: 12,
  };
}

// ── Section 13: DSCR (Debt Service Coverage Ratio) ──────────────────────────

function buildDSCR(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  const dscrData = computeYearlyDSCR(f, p);

  const rows: string[][] = dscrData.map((d) => [
    `Year ${d.year}`,
    formatIndianCurrency(d.annualPrincipal),
    formatIndianCurrency(d.annualInterest),
    formatIndianCurrency(d.annualPrincipal + d.annualInterest),
    d.dscr.toFixed(2),
    d.dscr >= 1.25 ? "\u2705 Meets requirement" : "\u26A0\uFE0F Below 1.25",
  ]);

  const overallDscr = dscrData[0]?.dscr ?? 0;

  const content =
    `The Debt Service Coverage Ratio (DSCR) measures the unit's ability to ` +
    `service its debt obligations from operating income. Banks typically require ` +
    `a minimum DSCR of **1.25** for loan approval.\n\n` +
    `**Formula:** DSCR = (Net Profit + Depreciation + Interest) / ` +
    `(Principal Repayment + Interest Payment)\n\n` +
    `**Year 1 DSCR: ${overallDscr.toFixed(2)}** \u2014 ` +
    `${overallDscr >= 1.25
      ? "Meets the minimum bank requirement of 1.25, indicating adequate debt servicing capacity."
      : "Below the minimum bank requirement of 1.25. The unit should explore reducing costs or increasing revenue."
    }\n\n` +
    `A DSCR greater than 1.0 means the project generates sufficient cash to cover ` +
    `its debt obligations. A DSCR of 1.25 provides a safety margin of 25% above ` +
    `the minimum debt service requirement.`;

  return {
    id: "dscr",
    title: "13. DSCR (Debt Service Coverage Ratio)",
    content,
    tables: [
      {
        caption: "Table 13.1: Year-wise DSCR",
        headers: [
          "Year",
          "Annual Principal (\u20B9)",
          "Annual Interest (\u20B9)",
          "Total Debt Service (\u20B9)",
          "DSCR",
          "Status",
        ],
        rows,
      },
    ],
    order: 13,
  };
}

// ── Section 14: Break-even Analysis ─────────────────────────────────────────

function buildBreakEvenAnalysis(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  // Fixed costs: interest, depreciation, rent, admin salaries
  const annualInterest = f.loanSchedule
    .filter((e) => e.month > f.repaymentMoratoriumMonths && e.emi > 0)
    .slice(0, 12)
    .reduce((sum, e) => sum + e.interest, 0);

  const fixedCosts =
    Math.round(annualInterest) +
    f.annualDepreciation +
    (p.utilities.monthlyRentCost * 12) +
    (p.employees.administrative.count * p.employees.administrative.monthlyWagePerPerson * 12) +
    (p.utilities.monthlyCommunicationCost * 12) +
    (p.utilities.monthlyInsuranceCost * 12) +
    (p.utilities.monthlyMiscCost * 12);

  // Variable costs: raw materials, direct wages, power, water, maintenance, transport
  const variableCosts =
    (p.rawMaterials.totalMonthlyCost * 12) +
    (p.employees.totalMonthlyWages * 12) -
    (p.employees.administrative.count * p.employees.administrative.monthlyWagePerPerson * 12) +
    (p.utilities.monthlyPowerCost * 12) +
    (p.utilities.monthlyWaterCost * 12) +
    (p.utilities.monthlyMaintenanceCost * 12) +
    (p.utilities.monthlyTransportCost * 12);

  const salesRevenue = f.annualRevenue;
  const bepPercent = calculateBreakEven(fixedCosts, salesRevenue, variableCosts);
  const bepSales = Math.round((salesRevenue * bepPercent) / 100);

  const contribution = salesRevenue - variableCosts;
  const variableCostRatio = salesRevenue > 0
    ? Math.round((variableCosts / salesRevenue) * 10000) / 100
    : 0;

  const rows: string[][] = [
    ["**Fixed Costs (Annual)**", "", ""],
    ["  Interest on Bank Loan", formatIndianCurrency(Math.round(annualInterest)), ""],
    ["  Depreciation (Machinery)", formatIndianCurrency(f.annualDepreciation), ""],
    ["  Rent", formatIndianCurrency(p.utilities.monthlyRentCost * 12), ""],
    ["  Administrative Salaries", formatIndianCurrency(p.employees.administrative.count * p.employees.administrative.monthlyWagePerPerson * 12), ""],
    ["  Other Fixed Overheads", formatIndianCurrency((p.utilities.monthlyCommunicationCost + p.utilities.monthlyInsuranceCost + p.utilities.monthlyMiscCost) * 12), ""],
    ["  **Total Fixed Costs (A)**", `**${formatIndianCurrency(fixedCosts)}**`, ""],
    ["", "", ""],
    ["**Variable Costs (Annual)**", "", ""],
    ["  Raw Materials", formatIndianCurrency(p.rawMaterials.totalMonthlyCost * 12), ""],
    ["  Direct Wages", formatIndianCurrency(p.employees.totalMonthlyWages * 12 - p.employees.administrative.count * p.employees.administrative.monthlyWagePerPerson * 12), ""],
    ["  Power & Water", formatIndianCurrency((p.utilities.monthlyPowerCost + p.utilities.monthlyWaterCost) * 12), ""],
    ["  Transport & Maintenance", formatIndianCurrency((p.utilities.monthlyTransportCost + p.utilities.monthlyMaintenanceCost) * 12), ""],
    ["  **Total Variable Costs (B)**", `**${formatIndianCurrency(variableCosts)}**`, ""],
    ["", "", ""],
    ["**Sales Revenue (C)**", `**${formatIndianCurrency(salesRevenue)}**`, ""],
    ["**Contribution (C \u2212 B)**", `**${formatIndianCurrency(contribution)}**`, `${salesRevenue > 0 ? Math.round((contribution / salesRevenue) * 10000) / 100 : 0}%`],
    ["", "", ""],
    ["**Break-Even Point**", "", ""],
    ["  BEP = A / (1 \u2212 Variable Cost Ratio)", "", ""],
    ["  Variable Cost Ratio", `${variableCostRatio}%`, ""],
    ["  **BEP (% of Capacity)**", `**${bepPercent.toFixed(2)}%**`, ""],
    ["  **BEP (Sales Value)**", `**${formatIndianCurrency(bepSales)}**`, ""],
  ];

  const safetyMargin = Math.max(0, 100 - bepPercent);

  const content =
    `The break-even analysis determines the level of output at which the project ` +
    `neither makes a profit nor incurs a loss.\n\n` +
    `**Formula:** BEP = Fixed Costs / (1 \u2212 Variable Cost Ratio)\n\n` +
    `The break-even point is **${bepPercent.toFixed(2)}%** of installed capacity, ` +
    `which translates to annual sales of **${formatIndianCurrency(bepSales)}**.\n\n` +
    `**Safety Margin:** ${safetyMargin.toFixed(2)}%\n\n` +
    `${safetyMargin >= 20
      ? "The safety margin is comfortable, meaning the project can withstand a " +
        "revenue decline of up to " + safetyMargin.toFixed(0) + "% before incurring losses."
      : "The safety margin is tight. The project should focus on cost control and " +
        "achieving full capacity utilisation to ensure profitability."
    }`;

  return {
    id: "break-even-analysis",
    title: "14. Break-even Analysis",
    content,
    tables: [
      {
        caption: "Table 14.1: Break-even Analysis",
        headers: ["Particulars", "Amount (\u20B9)", "% / Remarks"],
        rows,
      },
    ],
    order: 14,
  };
}

// ── Section 15: Repayment Schedule ──────────────────────────────────────────

function buildRepaymentSchedule(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  const tenureYears = Math.ceil(f.loanTenureMonths / 12);
  const interestRate = p.financials.interestRate;

  const summaryRows: string[][] = [
    ["Term Loan Amount", formatIndianCurrency(f.bankTermLoan)],
    ["Interest Rate", `${interestRate}% per annum`],
    ["Loan Tenure", `${f.loanTenureMonths} months (${tenureYears} years)`],
    ["Moratorium Period", `${f.repaymentMoratoriumMonths} months (interest-only period)`],
    ["Monthly EMI (Post-Moratorium)", formatIndianCurrency(f.emi)],
    ["Total Interest Payable", formatIndianCurrency(f.totalInterest)],
    ["Total Repayment (Principal + Interest)", formatIndianCurrency(f.totalRepayment)],
  ];

  // First 24 months of schedule (or all if shorter)
  const maxMonths = Math.min(24, f.loanSchedule.length);
  const scheduleHeaders = [
    "Month",
    "Opening Balance (\u20B9)",
    "EMI (\u20B9)",
    "Interest (\u20B9)",
    "Principal (\u20B9)",
    "Closing Balance (\u20B9)",
  ];

  const scheduleRows: string[][] = f.loanSchedule.slice(0, maxMonths).map((entry) => [
    `${entry.month}`,
    formatIndianCurrency(entry.openingBalance),
    entry.emi === 0 ? "Moratorium" : formatIndianCurrency(entry.emi),
    formatIndianCurrency(entry.interest),
    formatIndianCurrency(entry.principal),
    formatIndianCurrency(entry.closingBalance),
  ]);

  const remainingNote =
    f.loanSchedule.length > maxMonths
      ? `\n\n*Note: The table above shows the first ${maxMonths} months. The complete ` +
        `schedule extends to month ${f.loanSchedule[f.loanSchedule.length - 1].month}.*`
      : "";

  const content =
    `The term loan of **${formatIndianCurrency(f.bankTermLoan)}** will be repaid ` +
    `over **${f.loanTenureMonths} months** (${tenureYears} years) with a moratorium ` +
    `period of **${f.repaymentMoratoriumMonths} months**. During the moratorium, ` +
    `no principal repayment is made (simplified model).\n\n` +
    `Post-moratorium, the equated monthly instalment (EMI) is ` +
    `**${formatIndianCurrency(f.emi)}**. Total interest payable over the loan tenure ` +
    `is ${formatIndianCurrency(f.totalInterest)}, bringing the total repayment to ` +
    `${formatIndianCurrency(f.totalRepayment)}.${remainingNote}`;

  return {
    id: "repayment-schedule",
    title: "15. Repayment Schedule",
    content,
    tables: [
      {
        caption: "Table 15.1: Loan Repayment Summary",
        headers: ["Particulars", "Details"],
        rows: summaryRows,
      },
      {
        caption: `Table 15.2: Month-by-Month Repayment Schedule (First ${maxMonths} Months)`,
        headers: scheduleHeaders,
        rows: scheduleRows,
      },
    ],
    order: 15,
  };
}

// ── Section 16: Risk Analysis & Mitigation ──────────────────────────────────

function buildRiskAnalysis(p: ProjectProfile): DprSection {
  const isManufacturing = p.business.activityType === "MANUFACTURING";

  const risks: { risk: string; likelihood: string; impact: string; mitigation: string }[] = [
    {
      risk: "Market Risk \u2014 Demand shortfall or price decline",
      likelihood: "Medium",
      impact: "High",
      mitigation: "Diversify customer base; focus on quality differentiation; explore online sales channels; build long-term contracts with buyers.",
    },
    {
      risk: "Financial Risk \u2014 Interest rate increase or working capital shortage",
      likelihood: "Low",
      impact: "High",
      mitigation: "Maintain adequate cash reserves; negotiate fixed-rate loan; explore government working capital schemes; manage receivables strictly.",
    },
    {
      risk: "Operational Risk \u2014 Machinery breakdown or raw material shortage",
      likelihood: "Medium",
      impact: "Medium",
      mitigation: "Enter annual maintenance contracts with suppliers; maintain buffer stock of critical raw materials; have backup supplier arrangements.",
    },
    {
      risk: "Regulatory Risk \u2014 Changes in PMEGP subsidy norms or tax laws",
      likelihood: "Low",
      impact: "Medium",
      mitigation: "Stay updated on scheme guidelines; ensure timely compliance with all regulatory filings; maintain good relations with district industries centre.",
    },
    {
      risk: "PMEGP-Specific: Delay in subsidy disbursement by KVIC/KVIB/DRDA",
      likelihood: "Medium",
      impact: "High",
      mitigation: "Submit complete documentation well in advance; follow up regularly with the sanctioning authority; arrange bridge finance from the bank if needed.",
    },
    {
      risk: "PMEGP-Specific: Delay in bank loan processing or disbursement",
      likelihood: "Medium",
      impact: "High",
      mitigation: "Apply to multiple banks if necessary; ensure all KYC and project documents are complete; engage with branch manager proactively.",
    },
    {
      risk: isManufacturing
        ? "Quality Risk \u2014 Inconsistent product quality"
        : "Service Quality Risk \u2014 Customer dissatisfaction",
      likelihood: "Low",
      impact: "Medium",
      mitigation: isManufacturing
        ? "Implement quality control checkpoints; train workers on quality standards; obtain relevant quality certifications."
        : "Establish service quality benchmarks; collect customer feedback; provide regular training to staff.",
    },
    {
      risk: "Manpower Risk \u2014 Shortage of skilled labour or high attrition",
      likelihood: "Medium",
      impact: "Medium",
      mitigation: "Offer competitive wages; provide on-the-job training; cross-train employees; maintain a panel of substitute workers.",
    },
  ];

  const rows: string[][] = risks.map((r, i) => [
    `${i + 1}`,
    r.risk,
    r.likelihood,
    r.impact,
    r.mitigation,
  ]);

  const content =
    `The following risk analysis identifies key risks associated with the proposed ` +
    `project along with their likelihood, potential impact, and mitigation strategies.\n\n` +
    `**Risk Assessment Scale:**\n` +
    `- **Likelihood:** Low (unlikely) / Medium (possible) / High (probable)\n` +
    `- **Impact:** Low (minor) / Medium (moderate) / High (significant)\n\n` +
    `The identified risks are manageable through the mitigation strategies outlined ` +
    `above. The project's break-even at ${p.capacity.projectedCapacityUtil}% capacity ` +
    `utilisation provides a reasonable buffer against moderate downside scenarios.`;

  return {
    id: "risk-analysis",
    title: "16. Risk Analysis & Mitigation",
    content,
    tables: [
      {
        caption: "Table 16.1: Risk Assessment Matrix",
        headers: [
          "S.No.",
          "Risk Description",
          "Likelihood",
          "Impact",
          "Mitigation Strategy",
        ],
        rows,
      },
    ],
    order: 16,
  };
}

// ── Section 17: Implementation Schedule ─────────────────────────────────────

function buildImplementationSchedule(): DprSection {
  const phases = [
    { activity: "Site Preparation & Land Development", start: 1, end: 2, status: "\u2588\u2588" },
    { activity: "Building Construction / Renovation", start: 2, end: 4, status: "\u2588\u2588\u2588" },
    { activity: "Machinery Procurement & Ordering", start: 2, end: 5, status: "\u2588\u2588\u2588\u2588" },
    { activity: "Machinery Installation & Commissioning", start: 5, end: 6, status: "\u2588\u2588" },
    { activity: "Power & Utility Connections", start: 3, end: 5, status: "\u2588\u2588\u2588" },
    { activity: "Raw Material Procurement (Initial Stock)", start: 5, end: 6, status: "\u2588\u2588" },
    { activity: "Recruitment & Training of Staff", start: 5, end: 6, status: "\u2588\u2588" },
    { activity: "Trial Run & Quality Testing", start: 6, end: 7, status: "\u2588\u2588" },
    { activity: "Commercial Production Start", start: 7, end: 7, status: "\u2588" },
    { activity: "Marketing & Sales Commencement", start: 6, end: 8, status: "\u2588\u2588\u2588" },
  ];

  // Build Gantt-like text representation
  const months = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"];
  const ganttRows: string[][] = phases.map((phase) => {
    const bars: string[] = months.map((_, idx) => {
      const m = idx + 1;
      return m >= phase.start && m <= phase.end ? "\u2588\u2588" : "  ";
    });
    return [phase.activity, ...bars];
  });

  // Summary table
  const summaryRows: string[][] = phases.map((phase, i) => [
    `${i + 1}`,
    phase.activity,
    `Month ${phase.start}`,
    `Month ${phase.end}`,
    `${phase.end - phase.start + 1} month(s)`,
  ]);

  const content =
    `The project implementation is planned over a period of approximately **8 months** ` +
    `from the date of loan disbursement. The implementation schedule is presented below ` +
    `in Gantt chart format.\n\n` +
    `### Gantt Chart\n\n` +
    `| Activity | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |\n` +
    `|---|---|---|---|---|---|---|---|---|\n` +
    ganttRows.map((r) => `| ${r[0]} | ${r.slice(1).join(" | ")} |`).join("\n") +
    `\n\n*Legend: \u2588\u2588 = Activity duration*\n\n` +
    `**Key Milestones:**\n` +
    `- **Month 1\u20132:** Site preparation and building construction begins\n` +
    `- **Month 2\u20135:** Machinery procurement (parallel with construction)\n` +
    `- **Month 5\u20136:** Installation, recruitment, and trial production\n` +
    `- **Month 7:** Commercial production commences\n` +
    `- **Month 8:** Full-scale marketing and sales operations`;

  return {
    id: "implementation-schedule",
    title: "17. Implementation Schedule",
    content,
    tables: [
      {
        caption: "Table 17.1: Implementation Timeline",
        headers: ["S.No.", "Activity", "Start", "End", "Duration"],
        rows: summaryRows,
      },
    ],
    order: 17,
  };
}

// ── Annexures: List of Documents ────────────────────────────────────────────

function buildAnnexures(p: ProjectProfile): DprSection {
  const isIndividual = p.applicant.entityType === "INDIVIDUAL";
  const isNonIndividual = !isIndividual;

  const documents: { ref: string; description: string; status: string }[] = [
    { ref: "Annexure A", description: "Aadhaar Card of the applicant", status: "Mandatory" },
    { ref: "Annexure B", description: "PAN Card of the applicant / entity", status: "Mandatory" },
    { ref: "Annexure C", description: "UDYAM Registration Certificate (MSME)", status: "Mandatory" },
    { ref: "Annexure D", description: "Quotations for Machinery & Equipment", status: "Mandatory" },
    { ref: "Annexure E", description: "Land / Premises Documents (Sale Deed / Lease / Rent Agreement)", status: "Mandatory" },
    { ref: "Annexure F", description: "Building Plan / NOC from Competent Authority", status: p.land.buildingType === "CONSTRUCT" ? "Mandatory" : "If applicable" },
    { ref: "Annexure G", description: "EDP Training Certificate", status: p.applicant.edpCompleted ? "Attached" : "To be obtained" },
    { ref: "Annexure H", description: "Caste / Category Certificate (if applicable)", status: "If applicable" },
    { ref: "Annexure I", description: "Disability Certificate (if PH category)", status: p.applicant.category === "PH" ? "Mandatory" : "If applicable" },
    { ref: "Annexure J", description: "Ex-Servicemen Certificate (if applicable)", status: p.applicant.category === "EX_SERVICEMEN" ? "Mandatory" : "If applicable" },
    { ref: "Annexure K", description: "Passport-size Photographs of Applicant", status: "Mandatory" },
    { ref: "Annexure L", description: "Bank Account Statement (last 6 months)", status: "Mandatory" },
    { ref: "Annexure M", description: "Ration Card / Voter ID (Address Proof)", status: "Mandatory" },
    { ref: "Annexure N", description: "Project Cost Estimate / Proforma Invoice", status: "Mandatory" },
    { ref: "Annexure O", description: "Electricity / Power Connection Proof", status: "If applicable" },
  ];

  if (isNonIndividual) {
    documents.push(
      { ref: "Annexure P", description: `${p.applicant.entityType} Registration Certificate`, status: "Mandatory" },
      { ref: "Annexure Q", description: "Memorandum & Articles of Association / Trust Deed / Bye-laws", status: "Mandatory" },
      { ref: "Annexure R", description: "Board Resolution / Consent of Members", status: "Mandatory" },
    );
  }

  documents.push(
    { ref: "Annexure S", description: "No Objection Certificate from existing bank (if any)", status: "If applicable" },
    { ref: "Annexure T", description: "Affidavit declaring no prior PMEGP/PMRY subsidy", status: "Mandatory" },
  );

  // Check which attachments have been uploaded
  const uploadedIds = new Set(p.attachments.items.map((a) => a.type));
  const rows: string[][] = documents.map((doc) => {
    let uploadStatus = "Pending";
    // Map document descriptions to attachment types for status check
    if (uploadedIds.size > 0) {
      uploadStatus = "To be uploaded";
    }
    return [
      doc.ref,
      doc.description,
      doc.status,
      uploadStatus,
    ];
  });

  const content =
    `The following documents are required to be submitted along with the DPR ` +
    `for processing under the PMEGP scheme. Documents marked as "Mandatory" must ` +
    `be submitted without fail.\n\n` +
    `**Important Notes:**\n` +
    `1. All documents must be self-attested by the applicant.\n` +
    `2. Photocopies should be clear and legible.\n` +
    `3. Original documents may be required for verification at the time of loan processing.\n` +
    `4. EDP training certificate is mandatory before the subsidy is disbursed.\n` +
    `5. UDYAM registration must be obtained before applying for PMEGP.\n` +
    `6. All quotations must be on the supplier's letterhead with date and validity period.`;

  return {
    id: "annexures",
    title: "Annexures \u2014 List of Documents",
    content,
    tables: [
      {
        caption: "Table: Document Checklist",
        headers: ["Ref.", "Document Description", "Requirement", "Upload Status"],
        rows,
      },
    ],
    order: 18,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a complete, bank-ready Detailed Project Report (DPR) from a validated
 * ProjectProfile, FinancialResult, and EligibilityResult.
 *
 * Pure function — same inputs always produce the same output.
 * NO I/O, NO AI calls, NO side effects.
 *
 * The generated DPR contains 17 sections plus annexures, covering all aspects
 * required by banks and PMEGP sanctioning authorities:
 *
 * 1. Executive Summary
 * 2. Business Profile / About the Entrepreneur
 * 3. Market Analysis
 * 4. Manufacturing/Service Process
 * 5. Machinery & Equipment
 * 6. Raw Materials
 * 7. Utilities & Overheads
 * 8. Staffing / Manpower
 * 9. Means of Finance
 * 10. Profit & Loss Account (3-Year Projection)
 * 11. Cash Flow Statement
 * 12. Balance Sheet
 * 13. DSCR (Debt Service Coverage Ratio)
 * 14. Break-even Analysis
 * 15. Repayment Schedule
 * 16. Risk Analysis & Mitigation
 * 17. Implementation Schedule
 * Annexures — List of Documents
 *
 * @param profile - Validated project profile with all segments populated
 * @param financial - Pre-computed financial result from the Financial Engine
 * @param eligibility - Pre-computed eligibility result from the Eligibility Engine
 * @returns Structured DPR document with all sections, engine results, and metadata
 */
export function generateDPR(
  profile: ProjectProfile,
  financial: FinancialResult,
  eligibility: EligibilityResult,
): DprDocument {
  const sections: DprSection[] = [
    buildExecutiveSummary(profile, financial, eligibility),
    buildBusinessProfile(profile),
    buildMarketAnalysis(profile),
    buildManufacturingProcess(profile),
    buildMachinery(profile),
    buildRawMaterials(profile),
    buildUtilities(profile),
    buildStaffing(profile),
    buildMeansOfFinance(profile, financial),
    buildProfitAndLoss(profile, financial),
    buildCashFlow(profile, financial),
    buildBalanceSheet(profile, financial),
    buildDSCR(profile, financial),
    buildBreakEvenAnalysis(profile, financial),
    buildRepaymentSchedule(profile, financial),
    buildRiskAnalysis(profile),
    buildImplementationSchedule(),
    buildAnnexures(profile),
  ];

  // Ensure sections are sorted by order
  sections.sort((a, b) => a.order - b.order);

  // Compute total word count across all sections
  let wordCount = 0;
  for (const section of sections) {
    wordCount += sectionWordCount(section);
  }

  return {
    sections,
    financialResult: financial,
    eligibilityResult: eligibility,
    generatedAt: new Date().toISOString(),
    wordCount,
  };
}