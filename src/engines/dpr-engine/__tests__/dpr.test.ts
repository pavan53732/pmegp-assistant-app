// ─── DPR Engine Tests ──────────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { generateDpr } from "../index";
import { computeFinancials } from "@/engines/financial-engine";
import { checkEligibility } from "@/engines/eligibility-engine";
import { createTestProfile } from "@/test-helpers/create-test-profile";

function buildDprInput(overrides?: Parameters<typeof createTestProfile>[0]) {
  const profile = createTestProfile(overrides);
  const financialResult = computeFinancials({ profile });
  const eligibilityResult = checkEligibility(profile);
  return { profile, financialResult, eligibilityResult };
}

describe("DPR Engine — generateDpr()", () => {
  test("returns a complete DprDocument", () => {
    const input = buildDprInput();
    const dpr = generateDpr(input);
    expect(dpr).toBeDefined();
    expect(dpr.sections.length).toBeGreaterThan(0);
    expect(dpr.financialResult).toBeDefined();
    expect(dpr.eligibilityResult).toBeDefined();
    expect(dpr.generatedAt).toBeTruthy();
    expect(dpr.wordCount).toBeGreaterThan(0);
  });

  test("sections are ordered by order field", () => {
    const input = buildDprInput();
    const dpr = generateDpr(input);
    const orders = dpr.sections.map((s) => s.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  test("every section has id, title, and content", () => {
    const input = buildDprInput();
    const dpr = generateDpr(input);
    for (const section of dpr.sections) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.content).toBeTruthy();
    }
  });

  test("deterministic: same input → same section IDs", () => {
    const input = buildDprInput();
    const a = generateDpr(input);
    const b = generateDpr(input);
    expect(a.sections.map((s) => s.id)).toEqual(b.sections.map((s) => s.id));
  });

  test("ineligible project still generates DPR", () => {
    const input = buildDprInput({ applicant: { age: 17 } });
    const dpr = generateDpr(input);
    expect(dpr.eligibilityResult.eligible).toBe(false);
    expect(dpr.sections.length).toBeGreaterThan(0);
  });
});
