// ─── PDF Engine Tests ──────────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { generatePdf, formatINR } from "../index";
import { generateDpr } from "@/engines/dpr-engine";
import { computeFinancials } from "@/engines/financial-engine";
import { checkEligibility } from "@/engines/eligibility-engine";
import { createTestProfile } from "@/test-helpers/create-test-profile";

function buildDpr(overrides?: Parameters<typeof createTestProfile>[0]) {
  const profile = createTestProfile(overrides);
  const financialResult = computeFinancials({ profile });
  const eligibilityResult = checkEligibility(profile);
  return generateDpr({ profile, financialResult, eligibilityResult });
}

describe("PDF Engine — formatINR()", () => {
  test("formats 1234567 as Indian notation", () => {
    expect(formatINR(1234567)).toBe("12,34,567");
  });
  test("formats 5000000 correctly", () => {
    expect(formatINR(5000000)).toBe("50,00,000");
  });
  test("formats 500 correctly", () => {
    expect(formatINR(500)).toBe("500");
  });
  test("formats negative numbers", () => {
    expect(formatINR(-1234567)).toBe("-12,34,567");
  });
  test("formats 0", () => {
    expect(formatINR(0)).toBe("0");
  });
});

describe("PDF Engine — generatePdf()", () => {
  test("generates a non-empty ArrayBuffer", async () => {
    const dpr = buildDpr();
    const pdf = await generatePdf(dpr);
    expect(pdf).toBeInstanceOf(ArrayBuffer);
    expect(pdf.byteLength).toBeGreaterThan(0);
  });

  test("generated PDF starts with %PDF magic bytes", async () => {
    const dpr = buildDpr();
    const pdf = await generatePdf(dpr);
    const bytes = new Uint8Array(pdf.slice(0, 4));
    const header = String.fromCharCode(...bytes);
    expect(header).toBe("%PDF");
  });

  test("deterministic: same Dpr → same byte length", async () => {
    const dpr = buildDpr();
    const a = await generatePdf(dpr);
    const b = await generatePdf(dpr);
    expect(a.byteLength).toBe(b.byteLength);
  });
});
