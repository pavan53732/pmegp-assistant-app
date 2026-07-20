// ─── Financial Engine Tests ────────────────────────────────────────────
import { describe, test, expect } from "bun:test";
import { computeFinancials } from "../index";
import { createTestProfile } from "@/test-helpers/create-test-profile";

describe("Financial Engine — computeFinancials()", () => {
  // ── 1. General category, urban → 15% subsidy ──────────────────────────
  test("GEN + URBAN: subsidy rate is 15%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", isWomen: false },
      location: { area: "URBAN", isHillBorderArea: false },
    });
    const result = computeFinancials(profile);
    expect(result.subsidyRate).toBe(15);
  });

  // ── 2. Special category (SC), rural → 35% subsidy ─────────────────────
  test("SC + RURAL: subsidy rate is 35%", () => {
    const profile = createTestProfile({
      applicant: { category: "SC", gender: "MALE", isWomen: false },
      location: { area: "RURAL", isHillBorderArea: false },
    });
    const result = computeFinancials(profile);
    expect(result.subsidyRate).toBe(35);
  });

  // ── 3. Women, rural → 35% subsidy ─────────────────────────────────────
  test("FEMALE + RURAL: subsidy rate is 35%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "FEMALE", isWomen: true },
      location: { area: "RURAL", isHillBorderArea: false },
    });
    const result = computeFinancials(profile);
    expect(result.subsidyRate).toBe(35);
  });

  // ── 4. Women, urban → 25% subsidy (special) ───────────────────────────
  test("FEMALE + URBAN: subsidy rate is 25%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "FEMALE", isWomen: true },
      location: { area: "URBAN", isHillBorderArea: false },
    });
    const result = computeFinancials(profile);
    expect(result.subsidyRate).toBe(25);
  });

  // ── 5. General, rural → 25% subsidy ───────────────────────────────────
  test("GEN + RURAL: subsidy rate is 25%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", isWomen: false },
      location: { area: "RURAL", isHillBorderArea: false },
    });
    const result = computeFinancials(profile);
    expect(result.subsidyRate).toBe(25);
  });

  // ── 6. EMI is positive and reasonable ──────────────────────────────────
  test("EMI is positive for a reasonable project", () => {
    const profile = createTestProfile({
      financials: {
        totalProjectCost: 10_00_000,
        workingCapital: 2_00_000,
        interestRate: 12,
        loanTenureYears: 7,
      },
    });
    const result = computeFinancials(profile);
    expect(result.emi).toBeGreaterThan(0);
    // EMI should be less than the total project cost
    expect(result.emi).toBeLessThan(result.totalProjectCost);
  });

  // ── 7. Loan schedule: total principal repayments ≈ bankTermLoan ───────
  test("loan schedule principal repayments approximately equal bankTermLoan", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);

    let totalPrincipal = 0;
    for (const entry of result.loanSchedule) {
      totalPrincipal += entry.principal;
    }
    // Total principal should be very close to bankTermLoan.
    // Small rounding drift can accumulate across the moratorium + repayment months.
    const tolerance = Math.max(1, result.bankTermLoan * 0.001); // 0.1%
    expect(Math.abs(totalPrincipal - result.bankTermLoan)).toBeLessThanOrEqual(tolerance);

    // The schedule should have exactly moratoriumMonths + tenureMonths entries
    // (or fewer if the loan is paid off early)
    const expectedEntries = profile.financials.repaymentMoratoriumMonths + profile.financials.loanTenureYears * 12;
    expect(result.loanSchedule.length).toBeLessThanOrEqual(expectedEntries);
  });

  // ── 8. DSCR > 0 (computable) ──────────────────────────────────────────
  test("DSCR is a finite number", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);

    // DSCR may be negative for a losing project, but it must be a real number
    expect(typeof result.dscr).toBe("number");
    expect(Number.isFinite(result.dscr)).toBe(true);
  });

  // ── 9. Break-even percent is between 0-100 ───────────────────────────
  test("breakEvenPercent is between 0 and 100", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);

    expect(result.breakEvenPercent).toBeGreaterThanOrEqual(0);
    expect(result.breakEvenPercent).toBeLessThanOrEqual(100);
  });

  // ── 10. Total project cost = fixed capital + working capital ───────────
  test("totalProjectCost = totalFixedCapital + workingCapital", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);

    expect(result.totalProjectCost).toBe(
      result.annualDepreciation * 10 + // reverse depreciation to get machinery cost
        profile.financials.otherFixedAssets +
        profile.financials.preOperativeExpenses +
        profile.financials.buildingAndCivilWorks +
        profile.financials.workingCapital,
    );
    // More directly: engine computes it from profile values
    const expectedFixed = Math.round(
      profile.financials.machineryAndEquipment +
        profile.financials.otherFixedAssets +
        profile.financials.preOperativeExpenses +
        profile.financials.buildingAndCivilWorks,
    );
    const expectedTotal = expectedFixed + profile.financials.workingCapital;
    expect(result.totalProjectCost).toBe(expectedTotal);
  });

  // ── 11. Own contribution = 5% for special category ─────────────────────
  // NOTE: computeFinancials() recomputes totalProjectCost from individual
  // components (machineryAndEquipment + otherFixedAssets + preOperativeExpenses +
  // buildingAndCivilWorks + workingCapital).  Overriding totalProjectCost in
  // the profile has no effect — we must set the component values instead.
  test("SC own contribution is 5% of computed total project cost", () => {
    // Set components so totalFixedCapital = 800000, totalProjectCost = 1000000
    const profile = createTestProfile({
      applicant: { category: "SC" },
      financials: {
        machineryAndEquipment: 7_00_000,
        otherFixedAssets: 50_000,
        preOperativeExpenses: 20_000,
        buildingAndCivilWorks: 30_000,
        workingCapital: 2_00_000,
      },
    });
    const result = computeFinancials(profile);
    expect(result.ownContributionPercent).toBe(5);
    expect(result.totalProjectCost).toBe(10_00_000);
    expect(result.ownContribution).toBe(Math.round(10_00_000 * 5 / 100));
  });

  // ── 12. Own contribution = 10% for general category ────────────────────
  test("GEN own contribution is 10% of computed total project cost", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", isWomen: false },
      location: { area: "URBAN", isHillBorderArea: false },
      financials: {
        machineryAndEquipment: 7_00_000,
        otherFixedAssets: 50_000,
        preOperativeExpenses: 20_000,
        buildingAndCivilWorks: 30_000,
        workingCapital: 2_00_000,
      },
    });
    const result = computeFinancials(profile);
    expect(result.ownContributionPercent).toBe(10);
    expect(result.totalProjectCost).toBe(10_00_000);
    expect(result.ownContribution).toBe(Math.round(10_00_000 * 10 / 100));
  });

  // ── 13. All rupee values are integers ──────────────────────────────────
  test("all money values are integers (whole rupees)", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);

    const intFields: (keyof typeof result)[] = [
      "totalProjectCost", "ownContribution", "bankFinance", "subsidyAmount",
      "bankTermLoan", "bankWorkingCapital", "emi", "totalInterest",
      "totalRepayment", "monthlyOperatingCosts", "annualRevenue",
      "annualExpenditure", "annualNetProfit", "annualDepreciation",
    ];
    for (const field of intFields) {
      const val = result[field];
      expect(Number.isInteger(val), `${String(field)} should be integer, got ${val}`).toBe(true);
    }
  });

  // ── 14. Annual revenue = projectedMonthlySales × 12 ────────────────────
  test("annualRevenue = projectedMonthlySales × 12", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);

    expect(result.annualRevenue).toBe(profile.financials.projectedMonthlySales * 12);
  });

  // ── 15. Loan tenure months = years × 12 ───────────────────────────────
  test("loanTenureMonths = loanTenureYears × 12", () => {
    const profile = createTestProfile({
      financials: { loanTenureYears: 7 },
    });
    const result = computeFinancials(profile);
    expect(result.loanTenureMonths).toBe(84);
  });

  // ── 16. Means of finance equation ──────────────────────────────────────
  test("TPC = ownContribution + bankFinance + subsidyAmount", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);

    const sum = result.ownContribution + result.bankFinance + result.subsidyAmount;
    expect(sum).toBe(result.totalProjectCost);
  });

  // ── 17. Moratorium months preserved ────────────────────────────────────
  test("repaymentMoratoriumMonths is preserved from profile", () => {
    const profile = createTestProfile({
      financials: { repaymentMoratoriumMonths: 6 },
    });
    const result = computeFinancials(profile);
    expect(result.repaymentMoratoriumMonths).toBe(6);
  });

  // ── 18. Depreciation calculation ───────────────────────────────────────
  test("annualDepreciation = machineryAndEquipment / 10 (straight line)", () => {
    const profile = createTestProfile();
    const result = computeFinancials(profile);
    expect(result.annualDepreciation).toBe(
      Math.round(profile.financials.machineryAndEquipment / 10),
    );
  });

  // ── 19. Loan schedule has moratorium entries ───────────────────────────
  test("loan schedule includes moratorium entries with zero EMI", () => {
    const profile = createTestProfile({
      financials: { repaymentMoratoriumMonths: 6 },
    });
    const result = computeFinancials(profile);

    // First 6 entries should be moratorium
    for (let i = 0; i < 6; i++) {
      expect(result.loanSchedule[i].emi).toBe(0);
      expect(result.loanSchedule[i].principal).toBe(0);
    }
  });

  // ── 20. Hill & border area gets special category rates ─────────────────
  test("hill/border area: gets special category subsidy rates", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", isWomen: false },
      location: { area: "RURAL", isHillBorderArea: true },
    });
    const result = computeFinancials(profile);
    // Hill/border area makes it special → rural + special = 35%
    expect(result.subsidyRate).toBe(35);
    expect(result.ownContributionPercent).toBe(5);
  });

  // ── 21. Determinism ───────────────────────────────────────────────────
  test("pure function: same input produces identical output", () => {
    const profile = createTestProfile();
    const a = computeFinancials(profile);
    const b = computeFinancials(profile);
    expect(a).toEqual(b);
  });
});