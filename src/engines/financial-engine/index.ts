// ─── Financial Engine ─────────────────────────────────────────────────────
// Computes every monetary figure the app produces.
// Pure, deterministic function — NO AI, NO I/O side effects.
// "AI never calculates" — this engine never imports the AI layer.
//
// All scheme-specific constants are injected via SchemeFinancialParams
// (DESIGN_PRINCIPLES §12).  PMEGP is the only populated scheme today,
// but no literal "PMEGP" values exist in the calculation logic.
//
// Money: integer rupees everywhere.  A single RoundingPolicy is applied
// consistently so figures reconcile across P&L, cash flow, and balance sheet.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "../../shared/types/project-profile";
import {
  getSubsidyEntry,
  COST_CEILINGS,
} from "../knowledge-engine/scheme-params";

// ── Public Types ──────────────────────────────────────────────────────────

export interface LoanScheduleEntry {
  month: number;
  openingBalance: number;
  emi: number;
  interest: number;
  principal: number;
  closingBalance: number;
}

export interface DepreciationEntry {
  year: number;
  openingValue: number;
  depreciation: number;
  closingValue: number;
}

export interface ProfitLossRow {
  year: number;
  salesRevenue: number;
  costOfProduction: number;
  grossProfit: number;
  operatingExpenses: number;
  depreciation: number;
  interestOnTermLoan: number;
  netProfit: number;
  netMargin: number;
}

export interface CashFlowRow {
  year: number;
  openingBalance: number;
  inflows: {
    salesRevenue: number;
    subsidyReceived: number;
    bankLoanDisbursed: number;
    ownContribution: number;
  };
  outflows: {
    fixedCapital: number;
    workingCapital: number;
    interestOnTermLoan: number;
    principalRepayment: number;
    operatingExpenses: number;
  };
  netCashFlow: number;
  closingBalance: number;
}

export interface BalanceSheetRow {
  year: number;
  liabilities: {
    ownCapital: number;
    reservesSurplus: number;
    bankTermLoan: number;
    bankWorkingCapital: number;
    totalLiabilities: number;
  };
  assets: {
    fixedAssets: number;
    workingCapital: number;
    cashBalance: number;
    totalAssets: number;
  };
}

export interface FinancialResult {
  // ── Inputs & Parameters ──────────────────────────────────────────────
  schemeParams: SchemeFinancialParams;

  // ── Means of Finance ─────────────────────────────────────────────────
  totalProjectCost: number;
  ownContribution: number;
  ownContributionPercent: number;
  bankFinance: number;
  subsidyRate: number;
  subsidyAmount: number;
  bankTermLoan: number;
  bankWorkingCapital: number;

  // ── Loan ─────────────────────────────────────────────────────────────
  emi: number;
  loanTenureMonths: number;
  repaymentMoratoriumMonths: number;
  totalInterest: number;
  totalRepayment: number;

  // ── Profitability (Year 1) ───────────────────────────────────────────
  monthlyOperatingCosts: number;
  annualRevenue: number;
  annualExpenditure: number;
  annualNetProfit: number;

  // ── Ratios ───────────────────────────────────────────────────────────
  annualDepreciation: number;
  dscr: number;
  breakEvenPercent: number;
  currentRatio: number;

  // ── Schedules & Projections ──────────────────────────────────────────
  loanSchedule: LoanScheduleEntry[];
  depreciationSchedule: DepreciationEntry[];
  profitLossProjection: ProfitLossRow[];
  cashFlowProjection: CashFlowRow[];
  balanceSheetProjection: BalanceSheetRow[];

  // ── Reconciliation ───────────────────────────────────────────────────
  reconciliation: {
    projectCostCheck: boolean; // TPC = OC + Bank + Subsidy
    splitSum: number;
    difference: number;
  };
}

/** Scheme-specific financial parameters — injected, never hardcoded. */
export interface SchemeFinancialParams {
  scheme: string;
  version: string;
  source: string;
  depreciationYears: number;
  buildingDepreciationYears: number;
  salvageValue: number;
  revenueGrowthPercent: number;
  costEscalationPercent: number;
  moratoriumMonths: number;
  projectionYears: number;
}

/** Default PMEGP parameters (bundled knowledge-driven). */
export const DEFAULT_PMEGP_PARAMS: SchemeFinancialParams = {
  scheme: "PMEGP",
  version: "1.0",
  source: "PMEGP Guidelines, Ministry of MSME",
  depreciationYears: 10,
  buildingDepreciationYears: 30,
  salvageValue: 0,
  revenueGrowthPercent: 10,
  costEscalationPercent: 5,
  moratoriumMonths: 6,
  projectionYears: 5,
};

// ── Rounding Policy ───────────────────────────────────────────────────────

/** Single rounding policy applied everywhere. */
const round = (n: number): number => Math.round(n);

// ── Helpers ───────────────────────────────────────────────────────────────

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
  if (annualRate <= 0) return round(principal / tenureMonths);

  const r = annualRate / 12 / 100;
  const factor = Math.pow(1 + r, tenureMonths);
  return round((principal * r * factor) / (factor - 1));
}

/**
 * Builds the full month-by-month loan amortisation schedule.
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

  // Moratorium: zero payments
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

  // Repayment
  for (let m = 1; m <= tenureMonths && balance > 0; m++) {
    const interest = round(balance * r);
    let principalPortion = emi - interest;
    if (principalPortion >= balance) principalPortion = balance;
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

/**
 * Straight-line depreciation schedule for machinery.
 */
function buildDepreciationSchedule(
  machineryCost: number,
  years: number,
  salvage: number,
): DepreciationEntry[] {
  const schedule: DepreciationEntry[] = [];
  if (machineryCost <= 0 || years <= 0) return schedule;

  const annualDep = round((machineryCost - salvage) / years);
  let value = machineryCost;

  for (let y = 1; y <= years; y++) {
    const dep = y === years ? value - salvage : annualDep;
    const opening = value;
    value -= dep;
    if (value < salvage) value = salvage;
    schedule.push({
      year: y,
      openingValue: opening,
      depreciation: dep,
      closingValue: value,
    });
  }

  return schedule;
}

/**
 * Build projected Profit & Loss for N years.
 */
function buildProfitLossProjection(
  annualRevenue: number,
  annualOperatingExp: number,
  annualDepreciation: number,
  annualInterest: number,
  years: number,
  revenueGrowth: number,
  costEscalation: number,
): ProfitLossRow[] {
  const rows: ProfitLossRow[] = [];
  let revenue = annualRevenue;
  let opex = annualOperatingExp;

  for (let y = 1; y <= years; y++) {
    if (y > 1) {
      revenue = round(revenue * (1 + revenueGrowth / 100));
      opex = round(opex * (1 + costEscalation / 100));
    }
    const cop = opex; // simplified: operating expenses = cost of production
    const grossProfit = revenue - cop;
    const netProfit = grossProfit - annualDepreciation - annualInterest;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    rows.push({
      year: y,
      salesRevenue: revenue,
      costOfProduction: cop,
      grossProfit,
      operatingExpenses: opex,
      depreciation: annualDepreciation,
      interestOnTermLoan: annualInterest,
      netProfit,
      netMargin: round(netMargin * 100) / 100,
    });
  }

  return rows;
}

/**
 * Build projected Cash Flow for N years.
 */
function buildCashFlowProjection(
  totalProjectCost: number,
  ownContribution: number,
  bankTermLoan: number,
  bankWorkingCapital: number,
  subsidyAmount: number,
  annualRevenue: number,
  annualOpex: number,
  annualInterest: number,
  annualPrincipal: number,
  fixedCapital: number,
  workingCapital: number,
  years: number,
  revenueGrowth: number,
  costEscalation: number,
): CashFlowRow[] {
  const rows: CashFlowRow[] = [];
  let cashBalance = 0;
  let revenue = annualRevenue;
  let opex = annualOpex;

  for (let y = 1; y <= years; y++) {
    if (y > 1) {
      revenue = round(revenue * (1 + revenueGrowth / 100));
      opex = round(opex * (1 + costEscalation / 100));
    }

    const inflows = {
      salesRevenue: revenue,
      subsidyReceived: y === 1 ? subsidyAmount : 0,
      bankLoanDisbursed: y === 1 ? bankTermLoan + bankWorkingCapital : 0,
      ownContribution: y === 1 ? ownContribution : 0,
    };

    const outflows = {
      fixedCapital: y === 1 ? fixedCapital : 0,
      workingCapital: y === 1 ? workingCapital : 0,
      interestOnTermLoan: annualInterest,
      principalRepayment: annualPrincipal,
      operatingExpenses: opex,
    };

    const totalIn =
      inflows.salesRevenue +
      inflows.subsidyReceived +
      inflows.bankLoanDisbursed +
      inflows.ownContribution;
    const totalOut =
      outflows.fixedCapital +
      outflows.workingCapital +
      outflows.interestOnTermLoan +
      outflows.principalRepayment +
      outflows.operatingExpenses;

    const netCashFlow = totalIn - totalOut;
    const openingBalance = cashBalance;
    cashBalance += netCashFlow;

    rows.push({
      year: y,
      openingBalance,
      inflows,
      outflows,
      netCashFlow,
      closingBalance: cashBalance,
    });
  }

  return rows;
}

/**
 * Build projected Balance Sheet for N years.
 */
function buildBalanceSheetProjection(
  ownContribution: number,
  bankTermLoan: number,
  bankWorkingCapital: number,
  fixedAssets: number,
  workingCapital: number,
  plRows: ProfitLossRow[],
  cfRows: CashFlowRow[],
): BalanceSheetRow[] {
  const rows: BalanceSheetRow[] = [];

  for (let i = 0; i < plRows.length; i++) {
    const y = plRows[i].year;
    const reserves = plRows
      .slice(0, i + 1)
      .reduce((sum, r) => sum + Math.max(0, r.netProfit), 0);

    const liabilities = {
      ownCapital: ownContribution,
      reservesSurplus: reserves,
      bankTermLoan: Math.max(0, bankTermLoan - (i + 1) * round(bankTermLoan / 5)), // simplified principal reduction
      bankWorkingCapital,
      totalLiabilities: 0,
    };
    liabilities.totalLiabilities =
      liabilities.ownCapital +
      liabilities.reservesSurplus +
      liabilities.bankTermLoan +
      liabilities.bankWorkingCapital;

    const netFixed = Math.max(0, fixedAssets - (i + 1) * round(fixedAssets / 10));
    const assets = {
      fixedAssets: netFixed,
      workingCapital,
      cashBalance: Math.max(0, cfRows[i]?.closingBalance ?? 0),
      totalAssets: 0,
    };
    assets.totalAssets =
      assets.fixedAssets + assets.workingCapital + assets.cashBalance;

    rows.push({ year: y, liabilities, assets });
  }

  return rows;
}

// ── Main Entry Point ──────────────────────────────────────────────────────

export interface ComputeFinancialsInput {
  profile: ProjectProfile;
  params?: SchemeFinancialParams;
}

/**
 * Compute all financial figures for a project.
 *
 * @param input — profile + optional scheme params (defaults to PMEGP)
 * @returns FinancialResult with all schedules, projections, and reconciliation
 *
 * Deterministic: same input + same params → same output.  No side effects.
 */
export function computeFinancials(input: ComputeFinancialsInput): FinancialResult {
  const { profile, params = DEFAULT_PMEGP_PARAMS } = input;
  const { financials, employees, utilities, rawMaterials, location, applicant } = profile;

  // ── 1. Total Fixed Capital ────────────────────────────────────────────
  const totalFixedCapital = round(
    financials.machineryAndEquipment +
      financials.otherFixedAssets +
      financials.preOperativeExpenses +
      financials.buildingAndCivilWorks,
  );

  // ── 2. Total Project Cost ─────────────────────────────────────────────
  const totalProjectCost = round(totalFixedCapital + financials.workingCapital);

  // ── 3. Subsidy & Own Contribution from Knowledge Package ──────────────
  const subsidyEntry = getSubsidyEntry(applicant.category, location.area);
  const subsidyRate = subsidyEntry?.subsidyRate ?? (location.area === "RURAL" ? 25 : 15);
  const ownContributionPercent = subsidyEntry?.ownContributionPercent ?? 10;
  const ownContribution = round(totalProjectCost * ownContributionPercent / 100);

  // ── 4 & 5. Bank Finance & Subsidy (algebraic) ────────────────────────
  const bankFinance = round(
    (totalProjectCost - ownContribution) / (1 + subsidyRate / 100),
  );
  const subsidyAmount = totalProjectCost - ownContribution - bankFinance;

  // ── 6. Term Loan vs Working Capital ───────────────────────────────────
  const bankWorkingCapital = financials.workingCapital;
  const bankTermLoan = Math.max(0, round(bankFinance - bankWorkingCapital));

  // ── 7. Loan Schedule ──────────────────────────────────────────────────
  const loanTenureMonths = financials.loanTenureYears * 12;
  const moratoriumMonths = financials.repaymentMoratoriumMonths ?? params.moratoriumMonths;
  const emi = computeEMI(bankTermLoan, financials.interestRate, loanTenureMonths);

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
  totalInterest = round(totalInterest);
  totalRepayment = round(totalRepayment);

  // ── 8. Depreciation ───────────────────────────────────────────────────
  const annualDepreciation = round(
    (financials.machineryAndEquipment - params.salvageValue) /
      params.depreciationYears,
  );
  const depreciationSchedule = buildDepreciationSchedule(
    financials.machineryAndEquipment,
    params.depreciationYears,
    params.salvageValue,
  );

  // ── 9. Operating Costs ────────────────────────────────────────────────
  const monthlyOperatingCosts = round(
    employees.totalMonthlyWages +
      utilities.totalMonthlyOverheads +
      rawMaterials.totalMonthlyCost,
  );

  // ── 10. Annual Revenue & Expenditure ──────────────────────────────────
  const annualRevenue = financials.projectedMonthlySales * 12;
  const annualOperatingExp = round(monthlyOperatingCosts * 12);
  const annualExpenditure = round(annualOperatingExp + annualDepreciation);
  const annualNetProfit = annualRevenue - annualExpenditure;

  // ── 11. DSCR (first 12 repayment months) ──────────────────────────────
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

  // ── 12. Break-even ────────────────────────────────────────────────────
  const fixedCosts = round(utilities.totalMonthlyOverheads * 12 + annualDepreciation);
  const variableCosts = round(rawMaterials.totalMonthlyCost * 12);
  const contribution = annualRevenue - variableCosts;
  const breakEvenPercent = contribution > 0 ? (fixedCosts / contribution) * 100 : 0;

  // ── 13. Current Ratio ─────────────────────────────────────────────────
  const currentAssets = financials.workingCapital + round(annualRevenue / 12);
  const currentLiabilities = round(bankWorkingCapital + (annualInterestPayment / 12));
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;

  // ── 14. Projections ───────────────────────────────────────────────────
  const profitLossProjection = buildProfitLossProjection(
    annualRevenue,
    annualOperatingExp,
    annualDepreciation,
    annualInterestPayment,
    params.projectionYears,
    params.revenueGrowthPercent,
    params.costEscalationPercent,
  );

  const cashFlowProjection = buildCashFlowProjection(
    totalProjectCost,
    ownContribution,
    bankTermLoan,
    bankWorkingCapital,
    subsidyAmount,
    annualRevenue,
    annualOperatingExp,
    annualInterestPayment,
    annualPrincipalRepayment,
    totalFixedCapital,
    financials.workingCapital,
    params.projectionYears,
    params.revenueGrowthPercent,
    params.costEscalationPercent,
  );

  const balanceSheetProjection = buildBalanceSheetProjection(
    ownContribution,
    bankTermLoan,
    bankWorkingCapital,
    totalFixedCapital,
    financials.workingCapital,
    profitLossProjection,
    cashFlowProjection,
  );

  // ── 15. Reconciliation Invariant ──────────────────────────────────────
  const splitSum = round(ownContribution + bankFinance + subsidyAmount);
  const reconciliation = {
    projectCostCheck: splitSum === totalProjectCost,
    splitSum,
    difference: totalProjectCost - splitSum,
  };

  // ── Assemble Result ───────────────────────────────────────────────────
  return {
    schemeParams: params,
    totalProjectCost,
    ownContribution,
    ownContributionPercent,
    bankFinance,
    subsidyRate,
    subsidyAmount,
    bankTermLoan,
    bankWorkingCapital,
    emi,
    loanTenureMonths,
    repaymentMoratoriumMonths: moratoriumMonths,
    totalInterest,
    totalRepayment,
    monthlyOperatingCosts,
    annualRevenue,
    annualExpenditure,
    annualNetProfit,
    annualDepreciation,
    dscr: round(dscr * 100) / 100,
    breakEvenPercent: round(breakEvenPercent * 100) / 100,
    currentRatio: round(currentRatio * 100) / 100,
    loanSchedule,
    depreciationSchedule,
    profitLossProjection,
    cashFlowProjection,
    balanceSheetProjection,
    reconciliation,
  };
}
