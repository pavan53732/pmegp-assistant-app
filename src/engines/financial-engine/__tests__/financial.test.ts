// ─── Financial Engine Tests ────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { computeFinancials, DEFAULT_PMEGP_PARAMS } from "../index";
import { createTestProfile } from "@/test-helpers/create-test-profile";

describe("Financial Engine — computeFinancials()", () => {
  // ── 1. General category, urban → 15% subsidy ──────────────────────────
  test("GEN + URBAN: subsidy rate is 15%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", isWomen: false },
      location: { area: "URBAN", isHillBorderArea: false },
    });
    const result = computeFinancials({ profile });
    expect(result.subsidyRate).toBe(15);
  });

  // ── 2. Special category (SC), rural → 35% subsidy ─────────────────────
  test("SC + RURAL: subsidy rate is 35%", () => {
    const profile = createTestProfile({
      applicant: { category: "SC", gender: "MALE", isWomen: false },
      location: { area: "RURAL", isHillBorderArea: false },
    });
    const result = computeFinancials({ profile });
    expect(result.subsidyRate).toBe(35);
  });

  // ── 3. Women, rural → 35% subsidy ─────────────────────────────────────
  test("FEMALE + RURAL: subsidy rate is 35%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "FEMALE", isWomen: true },
      location: { area: "RURAL", isHillBorderArea: false },
    });
    const result = computeFinancials({ profile });
    expect(result.subsidyRate).toBe(35);
  });

  // ── 4. Women, urban → 25% subsidy (special) ───────────────────────────
  test("FEMALE + URBAN: subsidy rate is 25%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "FEMALE", isWomen: true },
      location: { area: "URBAN", isHillBorderArea: false },
    });
    const result = computeFinancials({ profile });
    expect(result.subsidyRate).toBe(25);
  });

  // ── 5. General, rural → 25% subsidy ───────────────────────────────────
  test("GEN + RURAL: subsidy rate is 25%", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", isWomen: false },
      location: { area: "RURAL", isHillBorderArea: false },
    });
    const result = computeFinancials({ profile });
    expect(result.subsidyRate).toBe(25);
  });

  // ── 6. Reconciliation invariant ───────────────────────────────────────
  test("project cost reconciles: TPC = OC + Bank + Subsidy", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.reconciliation.projectCostCheck).toBe(true);
    expect(result.reconciliation.difference).toBe(0);
  });

  // ── 7. EMI > 0 when principal > 0 ─────────────────────────────────────
  test("EMI is positive for non-zero term loan", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.emi).toBeGreaterThan(0);
  });

  // ── 8. Loan schedule length ───────────────────────────────────────────
  test("loan schedule covers tenure + moratorium", () => {
    const profile = createTestProfile({
      financials: { loanTenureYears: 3, repaymentMoratoriumMonths: 6 },
    });
    const result = computeFinancials({ profile });
    expect(result.loanSchedule.length).toBe(3 * 12 + 6);
  });

  // ── 9. Depreciation schedule ──────────────────────────────────────────
  test("depreciation schedule has correct years", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.depreciationSchedule.length).toBe(
      DEFAULT_PMEGP_PARAMS.depreciationYears,
    );
  });

  // ── 10. P&L projection ────────────────────────────────────────────────
  test("P&L projection has correct number of years", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.profitLossProjection.length).toBe(
      DEFAULT_PMEGP_PARAMS.projectionYears,
    );
  });

  // ── 11. Cash flow projection ──────────────────────────────────────────
  test("cash flow projection has correct number of years", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.cashFlowProjection.length).toBe(
      DEFAULT_PMEGP_PARAMS.projectionYears,
    );
  });

  // ── 12. Balance sheet projection ──────────────────────────────────────
  test("balance sheet projection has correct number of years", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.balanceSheetProjection.length).toBe(
      DEFAULT_PMEGP_PARAMS.projectionYears,
    );
  });

  // ── 13. Scheme params are returned ────────────────────────────────────
  test("result includes scheme params for auditability", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.schemeParams.scheme).toBe("PMEGP");
    expect(result.schemeParams.version).toBe("1.0");
  });

  // ── 14. Custom params override defaults ───────────────────────────────
  test("custom scheme params are respected", () => {
    const profile = createTestProfile();
    const customParams = {
      ...DEFAULT_PMEGP_PARAMS,
      scheme: "TEST_SCHEME",
      depreciationYears: 5,
    };
    const result = computeFinancials({ profile, params: customParams });
    expect(result.schemeParams.scheme).toBe("TEST_SCHEME");
    expect(result.depreciationSchedule.length).toBe(5);
  });

  // ── 15. Current ratio is computed ─────────────────────────────────────
  test("current ratio is a non-negative number", () => {
    const profile = createTestProfile();
    const result = computeFinancials({ profile });
    expect(result.currentRatio).toBeGreaterThanOrEqual(0);
  });
});

describe("Financial Engine — Worked Example Fixtures", () => {
  test("Case 1: GEN Male Urban Manufacturing — reconciliation passes", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", age: 35 },
      location: { area: "URBAN" },
      business: { activityType: "MANUFACTURING" },
    });
    const result = computeFinancials({ profile });
    expect(result.reconciliation.projectCostCheck).toBe(true);
    expect(result.subsidyRate).toBe(15);
    expect(result.ownContributionPercent).toBe(10);
  });

  test("Case 2: SC Female Rural Service — higher subsidy rate", () => {
    const profile = createTestProfile({
      applicant: { category: "SC", gender: "FEMALE", age: 28 },
      location: { area: "RURAL" },
      business: { activityType: "SERVICE" },
    });
    const result = computeFinancials({ profile });
    expect(result.subsidyRate).toBe(35);
    expect(result.reconciliation.projectCostCheck).toBe(true);
  });

  test("Case 3: OBC Male Rural Manufacturing at ceiling edge", () => {
    const profile = createTestProfile({
      applicant: { category: "OBC", gender: "MALE", age: 30 },
      location: { area: "RURAL" },
      business: { activityType: "MANUFACTURING" },
      financials: { totalProjectCost: 50_00_000 },
    });
    const result = computeFinancials({ profile });
    expect(result.reconciliation.projectCostCheck).toBe(true);
    expect(result.totalProjectCost).toBeLessThanOrEqual(50_00_000);
  });

  test("Case 4: ST Male Hill Border Service — hill area benefits", () => {
    const profile = createTestProfile({
      applicant: { category: "ST", gender: "MALE", age: 25 },
      location: { area: "RURAL", isHillBorderArea: true },
      business: { activityType: "SERVICE" },
    });
    const result = computeFinancials({ profile });
    expect(result.reconciliation.projectCostCheck).toBe(true);
    expect(result.subsidyRate).toBe(35);
  });
});
