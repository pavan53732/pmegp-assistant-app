// ─── Financial Engine ─────────────────────────────────────────────────────
// Computes every monetary figure the app produces.
// Pure, deterministic function — NO AI, NO I/O side effects.
// "AI never calculates" — this engine never imports the AI layer.
// All rupee values are integers (Math.round). DSCR & break-even are floats.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "../../shared/types/project-profile";

// ── Public types ──────────────────────────────────────────────────────────

export interface LoanScheduleEntry {
  month: number;
  openingBalance: number;
  emi: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

export interface FinancialResult {
  // Means of Finance
  totalProjectCost: number;
  ownContribution: number;
  ownContributionPercent: number;
  bankFinance: number;
  subsidyRate: number;
  subsidyAmount: number;
  bankTermLoan: number;
  bankWorkingCapital: number;

  // Loan
  emi: number;
  loanTenureMonths: number;
  repaymentMoratoriumMonths: number;
  totalInterest: number;
  totalRepayment: number;

  // Profitability
  monthlyOperatingCosts: number;
  annualRevenue: number;
  annualExpenditure: number;
  annualNetProfit: number;

  // Ratios
  annualDepreciation: number;
  dscr: number;
  breakEvenPercent: number;

  // Repayment schedule
  loanSchedule: LoanScheduleEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────────

const SPECIAL_CATEGORIES = new Set<string>([
  "SC",
  "ST",
  "OBC",
  "MINORITY",
  "EX_SERVICEMEN",
  "PH",
  "NER",
]);

/** Straight-line depreciation life for machinery & equipment (years). */
const DEPRECIATION_YEARS = 10;

/** Salvage value of machinery at end of useful life (₹). */
const SALVAGE_VALUE = 0;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns true when the applicant qualifies for "Special Category" benefits.
 * Special = SC, ST, OBC, MINORITY, EX_SERVICEMEN, PH, NER, Women, or
 * Hill & Border Area resident.
 */
function isSpecialCategory(profile: ProjectProfile): boolean {
  const { applicant, location } = profile;
  return (
    SPECIAL_CATEGORIES.has(applicant.category) ||
    applicant.isWomen === true ||
    location.isHillBorderArea === true
  );
}

/**
 * PMEGP subsidy rate (%) based on category × area.
 *
 *   |          | Urban | Rural |
 *   |----------|-------|-------|
 *   | General  |  15%  |  25%  |
 *   | Special  |  25%  |  35%  |
 */
function getSubsidyRate(profile: ProjectProfile): number {
  const special = isSpecialCategory(profile);
  const rural = profile.location.area === "RURAL";
  if (special) return rural ? 35 : 25;
  return rural ? 25 : 15;
}

/**
 * Standard EMI formula (reducing balance).
 *
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 *
 * Returns 0 for non-positive principal or tenure.
 * Returns simple division when rate is 0.
 */
function computeEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number,
): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  if (annualRate <= 0) return Math.round(principal / tenureMonths);

  const r = annualRate / 12 / 100;
  const factor = Math.pow(1 + r, tenureMonths);
  return Math.round((principal * r * factor) / (factor - 1));
}

/**
 * Builds the full month-by-month loan amortisation schedule.
 *
 * During the moratorium period no payments are made and the balance is
 * unchanged (simplified model — interest does not capitalise).
 * After the moratorium, regular EMIs are applied until the balance reaches 0.
 */
function buildLoanSchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  moratoriumMonths: number,
): LoanScheduleEntry[] {
  const schedule: LoanScheduleEntry[] = [];
  if (principal <= 0 || tenureMonths <= 0) return schedule;

  const r = annualRate / 12 / 100;
  const emi = computeEMI(principal, annualRate, tenureMonths);
  let balance = principal;

  // ── Moratorium: zero payments, balance unchanged ──
  for (let m = 1; m <= moratoriumMonths; m++) {
    schedule.push({
      month: m,
      openingBalance: balance,
      emi: 0,
      interest: 0,
      principal: 0,
      closingBalance: balance,
    });
  }

  // ── Repayment: regular EMIs ──
  for (let m = 1; m <= tenureMonths && balance > 0; m++) {
    const interest = Math.round(balance * r);
    let principalPortion = emi - interest;

    // Last month: absorb any rounding remainder so balance hits exactly 0.
    if (principalPortion >= balance) {
      principalPortion = balance;
    }

    const actualEmi = interest + principalPortion;
    balance -= principalPortion;
    if (balance < 0) balance = 0;

    const openingBalance =
      schedule.length > 0
        ? schedule[schedule.length - 1].closingBalance
        : principal;

    schedule.push({
      month: moratoriumMonths + m,
      openingBalance,
      emi: actualEmi,
      interest,
      principal: principalPortion,
      closingBalance: balance,
    });
  }

  return schedule;
}

// ── Main entry point ──────────────────────────────────────────────────────

export function computeFinancials(profile: ProjectProfile): FinancialResult {
  const { financials, employees, utilities, rawMaterials } = profile;

  // ── 1. Total Fixed Capital ────────────────────────────────────────────
  const totalFixedCapital = Math.round(
    financials.machineryAndEquipment +
      financials.otherFixedAssets +
      financials.preOperativeExpenses +
      financials.buildingAndCivilWorks,
  );

  // ── 2. Total Project Cost ─────────────────────────────────────────────
  const totalProjectCost = Math.round(
    totalFixedCapital + financials.workingCapital,
  );

  // ── 3. Own Contribution ───────────────────────────────────────────────
  const special = isSpecialCategory(profile);
  const ownContributionPercent = special ? 5 : 10;
  const ownContribution = Math.round(
    totalProjectCost * ownContributionPercent / 100,
  );

  // ── 4 & 5. Bank Finance & Subsidy (algebraic) ────────────────────────
  //
  //  TPC = Own Contribution + Bank Finance + Subsidy
  //  Subsidy = round(Bank Finance × rate / 100)
  //
  //  Solving algebraically (subsidy absorbed as residual to avoid
  //  rounding drift):
  //    Bank Finance  = (TPC − OC) / (1 + rate/100)
  //    Subsidy       = TPC − OC − Bank Finance
  //
  const subsidyRate = getSubsidyRate(profile);
  const bankFinance = Math.round(
    (totalProjectCost - ownContribution) / (1 + subsidyRate / 100),
  );
  const subsidyAmount = totalProjectCost - ownContribution - bankFinance;

  // ── 6. Term Loan vs Working Capital Loan ──────────────────────────────
  //
  //  Bank Finance = Term Loan + Working Capital Loan
  //  Working Capital Loan = workingCapital (from profile)
  //  Term Loan = Bank Finance − Working Capital Loan
  //
  const bankWorkingCapital = financials.workingCapital;
  const bankTermLoan = Math.max(0, Math.round(bankFinance - bankWorkingCapital));

  // ── 7. EMI ────────────────────────────────────────────────────────────
  const loanTenureMonths = financials.loanTenureYears * 12;
  const moratoriumMonths = financials.repaymentMoratoriumMonths;
  const emi = computeEMI(bankTermLoan, financials.interestRate, loanTenureMonths);

  // ── Loan schedule ─────────────────────────────────────────────────────
  const loanSchedule = buildLoanSchedule(
    bankTermLoan,
    financials.interestRate,
    loanTenureMonths,
    moratoriumMonths,
  );

  let totalInterest = 0;
  let totalRepayment = 0;
  for (const entry of loanSchedule) {
    totalInterest += entry.interest;
    totalRepayment += entry.emi;
  }
  totalInterest = Math.round(totalInterest);
  totalRepayment = Math.round(totalRepayment);

  // ── 8. Depreciation (Straight Line, 10-yr, 0 salvage) ────────────────
  const annualDepreciation = Math.round(
    (financials.machineryAndEquipment - SALVAGE_VALUE) / DEPRECIATION_YEARS,
  );

  // ── 9. Monthly Operating Costs ────────────────────────────────────────
  const monthlyOperatingCosts = Math.round(
    employees.totalMonthlyWages +
      utilities.totalMonthlyOverheads +
      rawMaterials.totalMonthlyCost,
  );

  // ── 10. Annual Revenue ────────────────────────────────────────────────
  const annualRevenue = financials.projectedMonthlySales * 12;

  // ── 11. Annual Expenditure ────────────────────────────────────────────
  const annualExpenditure = Math.round(
    monthlyOperatingCosts * 12 + annualDepreciation,
  );

  // ── 12. Annual Net Profit ─────────────────────────────────────────────
  const annualNetProfit = annualRevenue - annualExpenditure;

  // ── 13. DSCR ──────────────────────────────────────────────────────────
  //
  //  DSCR = (Annual Net Profit + Depreciation)
  //         / (Annual Principal Repayment + Annual Interest Payment)
  //
  //  Computed for the first full 12-month repayment window (after
  //  moratorium) to represent steady-state debt service.
  //
  const repaymentStartMonth = moratoriumMonths + 1;
  let annualPrincipalRepayment = 0;
  let annualInterestPayment = 0;
  let repaymentMonthsCounted = 0;

  for (const entry of loanSchedule) {
    if (
      entry.month >= repaymentStartMonth &&
      entry.emi > 0 &&
      repaymentMonthsCounted < 12
    ) {
      annualPrincipalRepayment += entry.principal;
      annualInterestPayment += entry.interest;
      repaymentMonthsCounted++;
    }
  }

  const debtService = annualPrincipalRepayment + annualInterestPayment;
  const dscr =
    debtService > 0
      ? (annualNetProfit + annualDepreciation) / debtService
      : 0;

  // ── 14. Break-even % ──────────────────────────────────────────────────
  //
  //  Fixed Costs   = (monthlyOverheads × 12) + annualDepreciation
  //  Variable Costs = rawMaterials.totalMonthlyCost × 12
  //  Break-even %  = Fixed Costs / (Revenue − Variable Costs) × 100
  //
  const fixedCosts = Math.round(
    utilities.totalMonthlyOverheads * 12 + annualDepreciation,
  );
  const variableCosts = Math.round(rawMaterials.totalMonthlyCost * 12);
  const contribution = annualRevenue - variableCosts;
  const breakEvenPercent = contribution > 0 ? (fixedCosts / contribution) * 100 : 0;

  // ── Assemble result ───────────────────────────────────────────────────
  return {
    // Means of Finance
    totalProjectCost,
    ownContribution,
    ownContributionPercent,
    bankFinance,
    subsidyRate,
    subsidyAmount,
    bankTermLoan,
    bankWorkingCapital,

    // Loan
    emi,
    loanTenureMonths,
    repaymentMoratoriumMonths: moratoriumMonths,
    totalInterest,
    totalRepayment,

    // Profitability
    monthlyOperatingCosts,
    annualRevenue,
    annualExpenditure,
    annualNetProfit,

    // Ratios
    annualDepreciation,
    dscr,
    breakEvenPercent,

    // Repayment schedule
    loanSchedule,
  };
}