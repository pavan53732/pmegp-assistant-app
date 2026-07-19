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

export interface DprSection {
  id: string;
  title: string;
  content: string; // Markdown
  tables?: DprTable[];
  order: number;
}

export interface DprTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface DprDocument {
  sections: DprSection[];
  financialResult: FinancialResult;
  eligibilityResult: EligibilityResult;
  generatedAt: string; // ISO timestamp
  wordCount: number;
}

// ── Currency Helper ─────────────────────────────────────────────────────────

/** Format a whole-rupee number in Indian notation (e.g. "₹25,00,000"). */
function formatIndianCurrency(amount: number): string {
  const str = Math.abs(amount).toString();
  if (str.length <= 3) return `₹${amount.toLocaleString("en-IN")}`;
  const lastThree = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted =
    rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
  return `₹${amount < 0 ? "-" : ""}${formatted}`;
}

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

// ── Section 1: Executive Summary ───────────────────────────────────────────

function buildExecutiveSummary(
  p: ProjectProfile,
  f: FinancialResult,
  e: EligibilityResult,
): DprSection {
  const eligible = e.eligible
    ? "**Eligible** under the PMEGP scheme"
    : `**Not eligible** \u2014 ${e.blockers.length} blocker(s) identified`;

  const content =
    `This Detailed Project Report (DPR) presents the techno-economic feasibility of ` +
    `the proposed **${p.business.name}**, a ${p.business.activityType.toLowerCase()} unit ` +
    `engaged in **${p.business.description}** under NIC Code **${p.business.nicCode ?? "N/A"}** ` +
    `(${p.business.nicDescription ?? "Activity not yet classified"}).\n\n` +
    `The total project cost is estimated at **${formatIndianCurrency(f.totalProjectCost)}**, ` +
    `financed through own contribution of ${formatIndianCurrency(f.ownContribution)} ` +
    `(${f.ownContributionPercent}%), bank finance of ${formatIndianCurrency(f.bankFinance)}, ` +
    `and a PMEGP subsidy of ${formatIndianCurrency(f.subsidyAmount)} at ${f.subsidyRate}%.\n\n` +
    `The unit will be located at **${p.location.district}, ${p.location.state}** ` +
    `(${p.location.area === "RURAL" ? "Rural" : "Urban"} area) and is expected to generate ` +
    `direct employment for **${p.employees.totalEmployment} persons**.\n\n` +
    `The projected annual net profit is **${formatIndianCurrency(f.annualNetProfit)}** with ` +
    `a Debt Service Coverage Ratio (DSCR) of **${f.dscr.toFixed(2)}** and a break-even ` +
    `point at **${f.breakEvenPercent.toFixed(2)}%** of installed capacity.\n\n` +
    `Eligibility assessment: ${eligible}.`;

  return {
    id: "executive-summary",
    title: "1. Executive Summary",
    content,
    order: 1,
  };
}

// ── Section 2: About the Promoter ──────────────────────────────────────────

function buildAboutPromoter(p: ProjectProfile): DprSection {
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
    [
      "Prior PMEGP/PMRY Subsidy",
      a.priorSubsidy
        ? "Yes" + (a.priorSubsidyDetail ? ` \u2014 ${a.priorSubsidyDetail}` : "")
        : "No",
    ],
    [
      "EDP Training Completed",
      a.edpCompleted
        ? "Yes" +
          (a.edpCertificateNo ? ` (Certificate: ${a.edpCertificateNo})` : "")
        : "No",
    ],
  ];

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
    `**${ENTITY_TYPE_LABEL[a.entityType]}**.`;

  return {
    id: "about-promoter",
    title: "2. About the Promoter",
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

// ── Section 3: Project Description ─────────────────────────────────────────

function buildProjectDescription(p: ProjectProfile): DprSection {
  const { business: b } = p;
  const sectorText =
    b.sector === "MANUFACTURING" ? "Manufacturing" : "Service";
  const subCatText = b.subCategory.toLowerCase().replace("_", " ");

  const rows: string[][] = [
    ["Name of Unit", b.name],
    ["Activity Description", b.description],
    ["Activity Type", b.activityType],
    ["NIC Code", b.nicCode ?? "N/A"],
    ["NIC Description", b.nicDescription ?? "N/A"],
    ["Sector", sectorText],
    ["Sub-Category", subCatText],
  ];

  const content =
    `The proposed unit, **${b.name}**, will carry out ${b.activityType.toLowerCase()} ` +
    `activity described as: *${b.description}*. The activity falls under NIC Code ` +
    `**${b.nicCode ?? "N/A"}** (${b.nicDescription ?? "not yet classified"}) ` +
    `in the **${sectorText}** sector.`;

  return {
    id: "project-description",
    title: "3. Project Description",
    content,
    tables: [
      {
        caption: "Table 3.1: Project Details",
        headers: ["Particulars", "Details"],
        rows,
      },
    ],
    order: 3,
  };
}

// ── Section 4: Market Potential ────────────────────────────────────────────

function buildMarketPotential(p: ProjectProfile): DprSection {
  const { market: m } = p;

  const rows: string[][] = [
    ["Target Market", m.targetMarket],
    [
      "Market Demand",
      m.marketDemand ?? "Not specified",
    ],
    ["Competition", m.competition ?? "Not specified"],
    ["Marketing Strategy", m.marketingStrategy ?? "Not specified"],
    [
      "Selling Price",
      m.sellingPricePerUnit !== undefined
        ? `${formatIndianCurrency(m.sellingPricePerUnit)} per ${m.sellingPriceUnit ?? "unit"}`
        : "Not specified",
    ],
  ];

  const content =
    `The unit will cater to the ${m.targetMarket}. ` +
    (m.marketDemand ? `The market demand is described as: *${m.marketDemand}*. ` : "") +
    (m.competition ? `The competitive landscape: *${m.competition}*. ` : "") +
    (m.marketingStrategy ? `The proposed marketing strategy: *${m.marketingStrategy}*.` : "") +
    (m.sellingPricePerUnit !== undefined
      ? ` The projected selling price is **${formatIndianCurrency(m.sellingPricePerUnit)}** per ${m.sellingPriceUnit ?? "unit"}.`
      : "");

  return {
    id: "market-potential",
    title: "4. Market Potential",
    content,
    tables: [
      {
        caption: "Table 4.1: Market Analysis",
        headers: ["Particulars", "Details"],
        rows,
      },
    ],
    order: 4,
  };
}

// ── Section 5: Technical Aspects — Machinery & Equipment ───────────────────

function buildMachinery(p: ProjectProfile): DprSection {
  const { machinery: m } = p;

  const headers = ["S.No.", "Name of Machine/Equipment", "Specification", "Qty", "Unit Cost (₹)", "Total Cost (₹)"];
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

  const content =
    `The following machinery and equipment is required for the proposed unit. ` +
    `The total cost of machinery and equipment is **${formatIndianCurrency(m.totalCost)}**.`;

  return {
    id: "technical-machinery",
    title: "5. Technical Aspects \u2014 Machinery & Equipment",
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

// ── Section 6: Technical Aspects — Raw Materials ───────────────────────────

function buildRawMaterials(p: ProjectProfile): DprSection {
  const { rawMaterials: rm } = p;

  const headers = [
    "S.No.",
    "Raw Material",
    "Specification",
    "Monthly Qty",
    "Unit",
    "Rate (₹)",
    "Monthly Cost (₹)",
  ];
  const rows: string[][] = rm.items.map((item, i) => [
    `${i + 1}`,
    item.name,
    item.specification ?? "\u2014",
    `${item.monthlyQuantity}`,
    item.unit,
    formatIndianCurrency(item.unitRate),
    formatIndianCurrency(item.totalMonthlyCost),
  ]);

  rows.push([
    "",
    "**Total**",
    "",
    "",
    "",
    "",
    `**${formatIndianCurrency(rm.totalMonthlyCost)}**`,
  ]);

  const content =
    `The following raw materials are required on a monthly basis for the production ` +
    `process. The total monthly raw material cost is **${formatIndianCurrency(rm.totalMonthlyCost)}**.`;

  return {
    id: "technical-raw-materials",
    title: "6. Technical Aspects \u2014 Raw Materials",
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

// ── Section 7: Technical Aspects — Utilities & Overheads ───────────────────

function buildUtilities(p: ProjectProfile): DprSection {
  const { utilities: u } = p;

  const rows: string[][] = [
    ["Power & Electricity", formatIndianCurrency(u.monthlyPowerCost)],
    ["Water", formatIndianCurrency(u.monthlyWaterCost)],
    ["Rent", formatIndianCurrency(u.monthlyRentCost)],
    ["Maintenance & Repairs", formatIndianCurrency(u.monthlyMaintenanceCost)],
    ["Transport", formatIndianCurrency(u.monthlyTransportCost)],
    ["Communication (Telephone/Internet)", formatIndianCurrency(u.monthlyCommunicationCost)],
    ["Insurance", formatIndianCurrency(u.monthlyInsuranceCost)],
    ["Miscellaneous Expenses", formatIndianCurrency(u.monthlyMiscCost)],
    ["**Total Monthly Overheads**", `**${formatIndianCurrency(u.totalMonthlyOverheads)}**`],
  ];

  const content =
    `The monthly utility and overhead costs for running the unit are detailed below. ` +
    `The total monthly overhead is **${formatIndianCurrency(u.totalMonthlyOverheads)}**.`;

  return {
    id: "technical-utilities",
    title: "7. Technical Aspects \u2014 Utilities & Overheads",
    content,
    tables: [
      {
        caption: "Table 7.1: Monthly Utilities & Overheads",
        headers: ["Particulars", "Monthly Cost (₹)"],
        rows,
      },
    ],
    order: 7,
  };
}

// ── Section 8: Production Capacity ─────────────────────────────────────────

function buildProductionCapacity(p: ProjectProfile): DprSection {
  const { capacity: c } = p;

  const rows: string[][] = [
    ["Installed Capacity", `${c.installedCapacity.value} ${c.installedCapacity.unit}`],
    ["Projected Capacity Utilisation", `${c.projectedCapacityUtil}%`],
    ["Working Days per Month", `${c.workingDaysPerMonth} days`],
    ["Working Hours per Day", `${c.workingHoursPerDay} hours`],
    ["Number of Shifts", `${c.shifts}`],
  ];

  const effectiveOutput = Math.round(
    (c.installedCapacity.value * c.projectedCapacityUtil) / 100,
  );

  const content =
    `The proposed unit has an installed capacity of **${c.installedCapacity.value} ` +
    `${c.installedCapacity.unit}**. At a projected capacity utilisation of ` +
    `**${c.projectedCapacityUtil}%**, the effective output would be approximately ` +
    `**${effectiveOutput} ${c.installedCapacity.unit}**. The unit will operate ` +
    `${c.shifts > 1 ? `${c.shifts} shifts` : "a single shift"} for ` +
    `${c.workingDaysPerMonth} days per month with ${c.workingHoursPerDay} working ` +
    `hours per day.`;

  return {
    id: "production-capacity",
    title: "8. Production Capacity",
    content,
    tables: [
      {
        caption: "Table 8.1: Production Capacity Details",
        headers: ["Particulars", "Details"],
        rows,
      },
    ],
    order: 8,
  };
}

// ── Section 9: Location & Land ─────────────────────────────────────────────

function buildLocationAndLand(p: ProjectProfile): DprSection {
  const { location: loc, land: ln } = p;

  const areaLabel = loc.area === "RURAL" ? "Rural" : "Urban";

  const rows: string[][] = [
    ["State", loc.state],
    ["District", loc.district],
    ["Area Type", areaLabel],
    ["Hill & Border Area", loc.isHillBorderArea ? "Yes" : "No"],
    ["Aspirational District", loc.isAspirationalDistrict ? "Yes" : "No"],
    [
      "Full Address",
      loc.premisesAddress ?? "Not specified",
    ],
  ];

  if (loc.industrialAreaName) {
    rows.push(["Industrial Area", loc.industrialAreaName]);
  }

  rows.push(["Land Status", LAND_STATUS_LABEL[ln.status]]);

  if (ln.areaSqFt !== undefined) {
    rows.push(["Land Area (Sq. Ft.)", `${ln.areaSqFt} sq. ft.`]);
  }
  if (ln.areaSqMt !== undefined) {
    rows.push(["Land Area (Sq. Mt.)", `${ln.areaSqMt} sq. mt.`]);
  }

  if (ln.buildingType) {
    rows.push(["Building Type", BUILDING_TYPE_LABEL[ln.buildingType]]);
  }
  if (ln.buildingAreaSqFt !== undefined) {
    rows.push(["Building Area (Sq. Ft.)", `${ln.buildingAreaSqFt} sq. ft.`]);
  }

  const content =
    `The proposed unit will be located at **${loc.district}, ${loc.state}** ` +
    `(${areaLabel} area). The land status is **${LAND_STATUS_LABEL[ln.status]}**. ` +
    (ln.buildingType
      ? `The building is ${BUILDING_TYPE_LABEL[ln.buildingType].toLowerCase()}. `
      : "") +
    (ln.monthlyRent !== undefined && ln.monthlyRent > 0
      ? `Monthly rent is ${formatIndianCurrency(ln.monthlyRent)}. `
      : "") +
    (loc.isHillBorderArea
      ? "The location is classified as a Hill & Border Area, which qualifies for enhanced subsidy benefits. "
      : "") +
    (loc.isAspirationalDistrict
      ? "The district is an Aspirational District under government development programmes. "
      : "");

  return {
    id: "location-land",
    title: "9. Location & Land",
    content,
    tables: [
      {
        caption: "Table 9.1: Location & Land Details",
        headers: ["Particulars", "Details"],
        rows,
      },
    ],
    order: 9,
  };
}

// ── Section 10: Means of Finance ───────────────────────────────────────────

function buildMeansOfFinance(
  p: ProjectProfile,
  f: FinancialResult,
): DprSection {
  const rows: string[][] = [
    ["Total Project Cost", formatIndianCurrency(f.totalProjectCost)],
    [
      "Own Contribution",
      formatIndianCurrency(f.ownContribution),
      `${f.ownContributionPercent}%`,
    ],
    ["Bank Finance", formatIndianCurrency(f.bankFinance), ""],
    [
      "  \u2014 Term Loan",
      formatIndianCurrency(f.bankTermLoan),
      "",
    ],
    [
      "  \u2014 Working Capital Loan",
      formatIndianCurrency(f.bankWorkingCapital),
      "",
    ],
    [
      "PMEGP Subsidy",
      formatIndianCurrency(f.subsidyAmount),
      `${f.subsidyRate}%`,
    ],
  ];

  const content =
    `The project is estimated to cost **${formatIndianCurrency(f.totalProjectCost)}** in total. ` +
    `The means of finance comprises the promoter's own contribution of ` +
    `${formatIndianCurrency(f.ownContribution)} (${f.ownContributionPercent}%), ` +
    `bank finance of ${formatIndianCurrency(f.bankFinance)} (term loan ` +
    `${formatIndianCurrency(f.bankTermLoan)} + working capital loan ` +
    `${formatIndianCurrency(f.bankWorkingCapital)}), and a PMEGP subsidy of ` +
    `${formatIndianCurrency(f.subsidyAmount)} at a rate of ${f.subsidyRate}%.`;

  return {
    id: "means-of-finance",
    title: "10. Means of Finance",
    content,
    tables: [
      {
        caption: "Table 10.1: Means of Finance",
        headers: ["Source", "Amount (₹)", "Remarks"],
        rows,
      },
    ],
    order: 10,
  };
}

// ── Section 11: Profitability & Financial Projections ──────────────────────

function buildProfitability(f: FinancialResult): DprSection {
  const rows: string[][] = [
    [
      "Monthly Operating Costs",
      formatIndianCurrency(f.monthlyOperatingCosts),
      formatIndianCurrency(f.monthlyOperatingCosts * 12),
    ],
    [
      "Annual Revenue (Sales)",
      "",
      formatIndianCurrency(f.annualRevenue),
    ],
    [
      "Annual Depreciation",
      formatIndianCurrency(f.annualDepreciation),
      formatIndianCurrency(f.annualDepreciation),
    ],
    [
      "Annual Expenditure",
      "",
      formatIndianCurrency(f.annualExpenditure),
    ],
    [
      "**Annual Net Profit**",
      "",
      `**${formatIndianCurrency(f.annualNetProfit)}**`,
    ],
    [
      "Debt Service Coverage Ratio (DSCR)",
      "",
      `${f.dscr.toFixed(2)}`,
    ],
    [
      "Break-Even Point",
      "",
      `${f.breakEvenPercent.toFixed(2)}%`,
    ],
  ];

  const content =
    `The profitability projections are based on the operating costs, revenue estimates, ` +
    `and financing structure detailed in the preceding sections. Annual depreciation of ` +
    `${formatIndianCurrency(f.annualDepreciation)} has been calculated on a straight-line ` +
    `basis over 10 years with zero salvage value.\n\n` +
    `The annual net profit of **${formatIndianCurrency(f.annualNetProfit)}** yields a ` +
    `DSCR of **${f.dscr.toFixed(2)}** and a break-even point at ` +
    `**${f.breakEvenPercent.toFixed(2)}%** of capacity utilisation. ` +
    `A DSCR above 1.5 indicates comfortable debt servicing capacity.`;

  return {
    id: "profitability-projections",
    title: "11. Profitability & Financial Projections",
    content,
    tables: [
      {
        caption: "Table 11.1: Profitability Summary",
        headers: ["Particulars", "Monthly (₹)", "Annual (₹)"],
        rows,
      },
    ],
    order: 11,
  };
}

// ── Section 12: Repayment Schedule ─────────────────────────────────────────

function buildRepaymentSchedule(f: FinancialResult): DprSection {
  // Summary table
  const tenureYears = Math.ceil(f.loanTenureMonths / 12);
  const summaryRows: string[][] = [
    ["Monthly EMI", formatIndianCurrency(f.emi)],
    ["Loan Tenure", `${f.loanTenureMonths} months (${tenureYears} years)`],
    ["Moratorium Period", `${f.repaymentMoratoriumMonths} months`],
    ["Total Interest Payable", formatIndianCurrency(f.totalInterest)],
    ["Total Repayment (Principal + Interest)", formatIndianCurrency(f.totalRepayment)],
  ];

  // First 12 months of schedule
  const scheduleHeaders = [
    "Month",
    "Opening Balance (₹)",
    "EMI (₹)",
    "Interest (₹)",
    "Principal (₹)",
    "Closing Balance (₹)",
  ];

  const scheduleRows: string[][] = f.loanSchedule.slice(0, 12).map((entry) => [
    `${entry.month}`,
    formatIndianCurrency(entry.openingBalance),
    formatIndianCurrency(entry.emi),
    formatIndianCurrency(entry.interest),
    formatIndianCurrency(entry.principal),
    formatIndianCurrency(entry.closingBalance),
  ]);

  const content =
    `The term loan of **${formatIndianCurrency(f.bankTermLoan)}** will be repaid ` +
    `over **${f.loanTenureMonths} months** with a moratorium period of ` +
    `**${f.repaymentMoratoriumMonths} months**. The equated monthly instalment (EMI) ` +
    `is **${formatIndianCurrency(f.emi)}**. Total interest payable over the loan ` +
    `tenure is ${formatIndianCurrency(f.totalInterest)}, bringing the total ` +
    `repayment to ${formatIndianCurrency(f.totalRepayment)}.\n\n` +
    `The table below shows the first 12 months of the repayment schedule. During the ` +
    `moratorium period, no repayments are made.`;

  return {
    id: "repayment-schedule",
    title: "12. Repayment Schedule",
    content,
    tables: [
      {
        caption: "Table 12.1: Loan Repayment Summary",
        headers: ["Particulars", "Details"],
        rows: summaryRows,
      },
      {
        caption: "Table 12.2: Repayment Schedule \u2014 First 12 Months",
        headers: scheduleHeaders,
        rows: scheduleRows,
      },
    ],
    order: 12,
  };
}

// ── Section 13: Employment Generation ──────────────────────────────────────

function buildEmploymentGeneration(p: ProjectProfile): DprSection {
  const { employees: emp } = p;

  const skilledTotal = emp.skilled.male + emp.skilled.female;
  const unskilledTotal = emp.unskilled.male + emp.unskilled.female;
  const skilledWages = skilledTotal * emp.skilled.monthlyWagePerPerson;
  const unskilledWages = unskilledTotal * emp.unskilled.monthlyWagePerPerson;
  const adminWages = emp.administrative.count * emp.administrative.monthlyWagePerPerson;

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
      "**Total**",
      `**${emp.skilled.male + emp.unskilled.male}**`,
      `**${emp.skilled.female + emp.unskilled.female}**`,
      `**${emp.totalEmployment}**`,
      "",
      `**${formatIndianCurrency(emp.totalMonthlyWages)}**`,
    ],
  ];

  const content =
    `The project will generate direct employment for **${emp.totalEmployment} persons**, ` +
    `comprising ${skilledTotal} skilled and ${unskilledTotal} unskilled workers, ` +
    `plus ${emp.administrative.count} administrative staff. The total monthly ` +
    `wage bill is **${formatIndianCurrency(emp.totalMonthlyWages)}**.`;

  return {
    id: "employment-generation",
    title: "13. Employment Generation",
    content,
    tables: [
      {
        caption: "Table 13.1: Employment Details",
        headers: [
          "Category",
          "Male",
          "Female",
          "Total",
          "Wage/Person/Month (₹)",
          "Total Monthly Wages (₹)",
        ],
        rows,
      },
    ],
    order: 13,
  };
}

// ── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Generate a complete Detailed Project Report (DPR) document from a validated
 * ProjectProfile, FinancialResult, and EligibilityResult.
 *
 * Pure function — same inputs always produce the same output.
 * NO I/O, NO AI calls, NO side effects.
 *
 * @param profile  - Validated project profile with all 13 segments
 * @param financial - Pre-computed financial result from the Financial Engine
 * @param eligibility - Pre-computed eligibility result from the Eligibility Engine
 * @returns Structured DPR document with 13 sections, engine results, and metadata
 */
export function generateDPR(
  profile: ProjectProfile,
  financial: FinancialResult,
  eligibility: EligibilityResult,
): DprDocument {
  const sections: DprSection[] = [
    buildExecutiveSummary(profile, financial, eligibility),
    buildAboutPromoter(profile),
    buildProjectDescription(profile),
    buildMarketPotential(profile),
    buildMachinery(profile),
    buildRawMaterials(profile),
    buildUtilities(profile),
    buildProductionCapacity(profile),
    buildLocationAndLand(profile),
    buildMeansOfFinance(profile, financial),
    buildProfitability(financial),
    buildRepaymentSchedule(financial),
    buildEmploymentGeneration(profile),
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