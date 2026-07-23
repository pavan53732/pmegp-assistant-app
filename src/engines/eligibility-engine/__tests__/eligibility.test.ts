// ─── Eligibility Engine Tests ───────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { checkEligibility, evaluateEligibility } from "../index";
import { createTestProfile } from "@/test-helpers/create-test-profile";

describe("Eligibility Engine — checkEligibility() [backward-compatible]", () => {
  // ── 1. Fully eligible applicant ────────────────────────────────────────
  test("fully eligible applicant passes all checks", () => {
    const profile = createTestProfile();
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.checks.length).toBe(7);
    for (const check of result.checks) {
      expect(check.passed).toBe(true);
    }
  });

  // ── 2. Under 18 → fails age.min ────────────────────────────────────────
  test("age 17: fails age.min check", () => {
    const profile = createTestProfile({ applicant: { age: 17 } });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(false);
    const ageCheck = result.checks.find((c) => c.criterionId === "age.min");
    expect(ageCheck).toBeDefined();
    expect(ageCheck!.passed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  // ── 3. Over 65 → fails age.max ────────────────────────────────────────
  test("age 66: fails age.max check", () => {
    const profile = createTestProfile({ applicant: { age: 66 } });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(false);
    const ageCheck = result.checks.find((c) => c.criterionId === "age.max");
    expect(ageCheck).toBeDefined();
    expect(ageCheck!.passed).toBe(false);
  });

  // ── 4. Prior PMEGP subsidy → fails prior-assistance ───────────────────
  test("prior PMEGP subsidy: fails prior-assistance check", () => {
    const profile = createTestProfile({
      applicant: { priorSubsidy: true, priorSubsidyDetail: "PMRY 2018" },
    });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(false);
    const check = result.checks.find((c) => c.criterionId === "applicant.prior-assistance");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  // ── 5. LLP entity type → fails entity-type ────────────────────────────
  test("LLP entity type: fails entity-type check", () => {
    const profile = createTestProfile({
      applicant: { entityType: "LLP" },
    });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(false);
    const check = result.checks.find((c) => c.criterionId === "applicant.entity-type");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  // ── 6. Private Limited → fails entity-type ────────────────────────────
  test("PRIVATE_LIMITED entity type: fails entity-type check", () => {
    const profile = createTestProfile({
      applicant: { entityType: "PRIVATE_LIMITED" },
    });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(false);
    const check = result.checks.find((c) => c.criterionId === "applicant.entity-type");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  // ── 7. Cost above ceiling → fails cost.ceiling ─────────────────────────
  test("MANUFACTURING cost ₹51L: fails cost.ceiling", () => {
    const profile = createTestProfile({
      financials: { totalProjectCost: 51_00_000 },
    });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(false);
    const check = result.checks.find((c) => c.criterionId === "cost.ceiling");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  // ── 8. Education NONE for project > ₹10L → fails education ────────────
  test("education NONE with cost ₹15L: fails education check", () => {
    const profile = createTestProfile({
      applicant: { education: "NONE" },
      financials: { totalProjectCost: 15_00_000 },
    });
    const result = checkEligibility(profile);

    const check = result.checks.find((c) => c.criterionId === "education");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  // ── 9. Education BELOW_8TH for project > ₹10L → fails education ───────
  test("education BELOW_8TH with cost ₹15L: fails education check", () => {
    const profile = createTestProfile({
      applicant: { education: "BELOW_8TH" },
      financials: { totalProjectCost: 15_00_000 },
    });
    const result = checkEligibility(profile);

    const check = result.checks.find((c) => c.criterionId === "education");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  // ── 10. Education 8TH_PASS for project > ₹10L → passes education ──────
  test("education 8TH_PASS with cost ₹15L: passes education check", () => {
    const profile = createTestProfile({
      applicant: { education: "8TH_PASS" },
      financials: { totalProjectCost: 15_00_000 },
    });
    const result = checkEligibility(profile);

    const check = result.checks.find((c) => c.criterionId === "education");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  // ── 11. EDP not completed → warning (not blocker) ─────────────────────
  test("EDP not completed: warning emitted but still eligible", () => {
    const profile = createTestProfile({
      applicant: { edpCompleted: false },
    });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // ── 12. EDP completed → no EDP warning ─────────────────────────────────
  test("EDP completed: no EDP warning", () => {
    const profile = createTestProfile({
      applicant: { edpCompleted: true, edpCertificateNo: "EDP-2024-001" },
    });
    const result = checkEligibility(profile);

    expect(result.warnings.some((w) => w.includes("EDP"))).toBe(false);
  });

  // ── 13. All permitted entity types pass ────────────────────────────────
  test("SHG entity type: passes entity-type check", () => {
    const profile = createTestProfile({
      applicant: { entityType: "SHG", entityRegistrationNo: "SHG-001" },
    });
    const result = checkEligibility(profile);

    const check = result.checks.find((c) => c.criterionId === "applicant.entity-type");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  // ── 14. Cost within ceiling → passes ───────────────────────────────────
  test("cost exactly at ceiling (₹50L MANUFACTURING): passes", () => {
    const profile = createTestProfile({
      financials: { totalProjectCost: 50_00_000 },
    });
    const result = checkEligibility(profile);

    const check = result.checks.find((c) => c.criterionId === "cost.ceiling");
    expect(check!.passed).toBe(true);
  });

  // ── 15. Negative list always passes (empty list) ───────────────────────
  test("negative list check always passes (no populated entries)", () => {
    const profile = createTestProfile();
    const result = checkEligibility(profile);

    const check = result.checks.find((c) => c.criterionId === "activity.negative-list");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(true);
  });

  // ── 16. Multiple failures → all blockers reported ─────────────────────
  test("multiple failures: all blockers reported", () => {
    const profile = createTestProfile({
      applicant: { age: 17, entityType: "LLP", priorSubsidy: true },
      financials: { totalProjectCost: 51_00_000 },
    });
    const result = checkEligibility(profile);

    expect(result.eligible).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(3);
  });

  // ── 17. Determinism ───────────────────────────────────────────────────
  test("pure function: same input produces identical output", () => {
    const profile = createTestProfile();
    const a = checkEligibility(profile);
    const b = checkEligibility(profile);
    expect(a).toEqual(b);
  });
});

describe("Eligibility Engine — evaluateEligibility() [new API]", () => {
  // ── 18. New API with asOfDate and scheme ──────────────────────────────
  test("evaluateEligibility includes asOfDate and scheme in result", () => {
    const profile = createTestProfile();
    const result = evaluateEligibility({
      asOfDate: "2026-03-15",
      scheme: "PMEGP",
      profile,
    });

    expect(result.asOfDate).toBe("2026-03-15");
    expect(result.scheme).toBe("PMEGP");
    expect(result.eligible).toBe(true);
  });

  // ── 19. Source citation on every check ────────────────────────────────
  test("every check includes source citation", () => {
    const profile = createTestProfile();
    const result = evaluateEligibility({
      asOfDate: "2026-03-15",
      scheme: "PMEGP",
      profile,
    });

    for (const check of result.checks) {
      expect(check.source).toBeDefined();
      expect(check.source.clause).toBeTruthy();
      expect(check.source.version).toBeTruthy();
    }
  });

  // ── 20. Determinism with new API ──────────────────────────────────────
  test("new API is deterministic", () => {
    const profile = createTestProfile();
    const input = { asOfDate: "2026-03-15", scheme: "PMEGP", profile };
    const a = evaluateEligibility(input);
    const b = evaluateEligibility(input);
    expect(a).toEqual(b);
  });
});

describe("Eligibility Engine — Worked Example Fixtures", () => {
  test("Case 1: GEN Male Urban Manufacturing — fully eligible", () => {
    const profile = createTestProfile({
      applicant: { category: "GEN", gender: "MALE", age: 35, education: "GRADUATE" },
      location: { area: "URBAN" },
      business: { activityType: "MANUFACTURING" },
      financials: { totalProjectCost: 25_00_000 },
    });
    const result = evaluateEligibility({ asOfDate: "2026-01-01", scheme: "PMEGP", profile });
    expect(result.eligible).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  test("Case 2: SC Female Rural Service — fully eligible with higher subsidy", () => {
    const profile = createTestProfile({
      applicant: { category: "SC", gender: "FEMALE", age: 28, education: "12TH_PASS" },
      location: { area: "RURAL" },
      business: { activityType: "SERVICE" },
      financials: { totalProjectCost: 15_00_000 },
    });
    const result = evaluateEligibility({ asOfDate: "2026-01-01", scheme: "PMEGP", profile });
    expect(result.eligible).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  test("Case 3: OBC Male Rural Manufacturing at ceiling — eligible at boundary", () => {
    const profile = createTestProfile({
      applicant: { category: "OBC", gender: "MALE", age: 30, education: "10TH_PASS" },
      location: { area: "RURAL" },
      business: { activityType: "MANUFACTURING" },
      financials: { totalProjectCost: 50_00_000 },
    });
    const result = evaluateEligibility({ asOfDate: "2026-01-01", scheme: "PMEGP", profile });
    expect(result.eligible).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  test("Case 4: ST Male Hill Border Service — eligible with special location", () => {
    const profile = createTestProfile({
      applicant: { category: "ST", gender: "MALE", age: 25, education: "8TH_PASS" },
      location: { area: "RURAL", isHillBorderArea: true },
      business: { activityType: "SERVICE" },
      financials: { totalProjectCost: 20_00_000 },
    });
    const result = evaluateEligibility({ asOfDate: "2026-01-01", scheme: "PMEGP", profile });
    expect(result.eligible).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});
