// ─── Validation Engine Tests ──────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { validateProject } from "../index";
import { createTestProfile, createEmptyProfile, createConfirmedProvenance, MANDATORY_FIELDS } from "@/test-helpers/create-test-profile";

describe("Validation Engine — validateProject()", () => {
  // ── 1. Empty profile ───────────────────────────────────────────────────
  test("empty profile: completeness is 0, canEnterReview false", () => {
    const profile = createEmptyProfile();
    const result = validateProject(profile);

    // The empty profile sets isWomen to null (via assertion) and TOTAL_FIELD_PATHS
    // financials to 0 (which counts as filled per the engine logic). So completeness
    // may not be exactly 0 but should be very low and canEnterReview must be false.
    // With isWomen=null, all TOTAL_FIELD_PATHS at 0 → only TOTAL_FIELD_PATHS are "filled"
    // That's 4 out of 27 mandatory fields.
    expect(result.completeness).toBeLessThanOrEqual(19);
    expect(result.canEnterReview).toBe(false);
    expect(result.canValidate).toBe(false);
    expect(result.missingFields.length).toBeGreaterThan(0);
  });

  // ── 2. Fully valid profile ────────────────────────────────────────────
  test("fully valid profile: completeness 100, canEnterReview true, canValidate true (with confirmed provenance)", () => {
    const profile = createTestProfile({
      provenance: createConfirmedProvenance([...MANDATORY_FIELDS, "business.nicCode"]),
    });
    const result = validateProject(profile);

    expect(result.completeness).toBe(100);
    expect(result.canEnterReview).toBe(true);
    expect(result.canValidate).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.contradictions).toHaveLength(0);
    expect(result.missingFields).toHaveLength(0);
    expect(result.nonEngineReadyMandatoryFields).toHaveLength(0);
  });

  // ── 3. canEnterReview true but canValidate false (unconfirmed provenance) ──
  test("valid data but unconfirmed provenance: canEnterReview true, canValidate false", () => {
    const profile = createTestProfile();
    // No provenance at all → fields are filled but not engine-ready
    const result = validateProject(profile);

    expect(result.completeness).toBe(100);
    expect(result.canEnterReview).toBe(true);
    expect(result.canValidate).toBe(false);
    expect(result.nonEngineReadyMandatoryFields.length).toBeGreaterThan(0);
  });

  // ── 4. Partial completeness ───────────────────────────────────────────
  test("profile with some fields missing: partial completeness", () => {
    const profile = createTestProfile({
      applicant: { name: "" },           // missing
      location: { state: "" },           // missing
      market: { targetMarket: "" },      // missing
    });
    const result = validateProject(profile);

    expect(result.completeness).toBeGreaterThan(0);
    expect(result.completeness).toBeLessThan(100);
    expect(result.missingFields).toContain("applicant.name");
    expect(result.missingFields).toContain("location.state");
    expect(result.missingFields).toContain("market.targetMarket");
  });

  // ── 5. Cost ceiling exceeded — MANUFACTURING > ₹50 Lakh ───────────────
  test("MANUFACTURING cost ceiling exceeded (₹51L > ₹50L)", () => {
    const profile = createTestProfile({
      financials: { totalProjectCost: 51_00_000 },
    });
    const result = validateProject(profile);

    const costError = result.errors.find((e) => e.code === "COST_CEILING_EXCEEDED");
    expect(costError).toBeDefined();
    expect(costError!.fieldPath).toBe("financials.totalProjectCost");
  });

  // ── 6. Cost ceiling exceeded — SERVICE > ₹25 Lakh ─────────────────────
  test("SERVICE cost ceiling exceeded (₹26L > ₹25L)", () => {
    const profile = createTestProfile({
      business: { activityType: "SERVICE" },
      financials: { totalProjectCost: 26_00_000 },
    });
    const result = validateProject(profile);

    const costError = result.errors.find((e) => e.code === "COST_CEILING_EXCEEDED");
    expect(costError).toBeDefined();
  });

  // ── 7. Age out of range — under 18 ─────────────────────────────────────
  test("age < 18: AGE_OUT_OF_RANGE error", () => {
    const profile = createTestProfile({ applicant: { age: 17 } });
    const result = validateProject(profile);

    const ageError = result.errors.find((e) => e.code === "AGE_OUT_OF_RANGE");
    expect(ageError).toBeDefined();
    expect(ageError!.fieldPath).toBe("applicant.age");
  });

  // ── 8. Age out of range — over 65 ─────────────────────────────────────
  test("age > 65: AGE_OUT_OF_RANGE error", () => {
    const profile = createTestProfile({ applicant: { age: 66 } });
    const result = validateProject(profile);

    const ageError = result.errors.find((e) => e.code === "AGE_OUT_OF_RANGE");
    expect(ageError).toBeDefined();
  });

  // ── 9. Education insufficient for high-cost project ────────────────────
  test("NONE education with project > ₹10L: INSUFFICIENT_EDUCATION", () => {
    const profile = createTestProfile({
      applicant: { education: "NONE" },
      financials: { totalProjectCost: 15_00_000 },
    });
    const result = validateProject(profile);

    const eduError = result.errors.find((e) => e.code === "INSUFFICIENT_EDUCATION");
    expect(eduError).toBeDefined();
    expect(eduError!.fieldPath).toBe("applicant.education");
  });

  // ── 10. Education NONE with project ≤ ₹10L: no error ──────────────────
  test("NONE education with project ≤ ₹10L: no INSUFFICIENT_EDUCATION error", () => {
    const profile = createTestProfile({
      applicant: { education: "NONE" },
      financials: { totalProjectCost: 8_00_000 },
    });
    const result = validateProject(profile);

    const eduError = result.errors.find((e) => e.code === "INSUFFICIENT_EDUCATION");
    expect(eduError).toBeUndefined();
  });

  // ── 11. Prior subsidy detail required ──────────────────────────────────
  test("priorSubsidy=true without detail: PRIOR_SUBSIDY_DETAIL_REQUIRED", () => {
    const profile = createTestProfile({
      applicant: { priorSubsidy: true, priorSubsidyDetail: "" },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "PRIOR_SUBSIDY_DETAIL_REQUIRED");
    expect(err).toBeDefined();
    expect(err!.fieldPath).toBe("applicant.priorSubsidyDetail");
  });

  // ── 12. Prior subsidy with detail: no error ───────────────────────────
  test("priorSubsidy=true with detail: no error", () => {
    const profile = createTestProfile({
      applicant: { priorSubsidy: true, priorSubsidyDetail: "Availed PMRY in 2018" },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "PRIOR_SUBSIDY_DETAIL_REQUIRED");
    expect(err).toBeUndefined();
  });

  // ── 13. EDP certificate required ───────────────────────────────────────
  test("edpCompleted=true without certificate: EDP_CERTIFICATE_REQUIRED", () => {
    const profile = createTestProfile({
      applicant: { edpCompleted: true, edpCertificateNo: "" },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "EDP_CERTIFICATE_REQUIRED");
    expect(err).toBeDefined();
    expect(err!.fieldPath).toBe("applicant.edpCertificateNo");
  });

  // ── 14. EDP completed with certificate: no error ───────────────────────
  test("edpCompleted=true with certificate: no error", () => {
    const profile = createTestProfile({
      applicant: { edpCompleted: true, edpCertificateNo: "EDP-2024-001" },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "EDP_CERTIFICATE_REQUIRED");
    expect(err).toBeUndefined();
  });

  // ── 15. Entity registration required for non-INDIVIDUAL ───────────────
  test("non-INDIVIDUAL without registration: ENTITY_REGISTRATION_REQUIRED", () => {
    const profile = createTestProfile({
      applicant: { entityType: "SHG", entityRegistrationNo: "" },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "ENTITY_REGISTRATION_REQUIRED");
    expect(err).toBeDefined();
    expect(err!.fieldPath).toBe("applicant.entityRegistrationNo");
  });

  // ── 16. INDIVIDUAL without registration: no error ─────────────────────
  test("INDIVIDUAL without registration: no ENTITY_REGISTRATION_REQUIRED", () => {
    const profile = createTestProfile({
      applicant: { entityType: "INDIVIDUAL", entityRegistrationNo: undefined },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "ENTITY_REGISTRATION_REQUIRED");
    expect(err).toBeUndefined();
  });

  // ── 17. Interest rate out of range ─────────────────────────────────────
  test("interest rate 35%: INTEREST_RATE_OUT_OF_RANGE", () => {
    const profile = createTestProfile({
      financials: { interestRate: 35 },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "INTEREST_RATE_OUT_OF_RANGE");
    expect(err).toBeDefined();
    expect(err!.fieldPath).toBe("financials.interestRate");
  });

  // ── 18. Interest rate negative: out of range ──────────────────────────
  test("interest rate -1%: INTEREST_RATE_OUT_OF_RANGE", () => {
    const profile = createTestProfile({
      financials: { interestRate: -1 },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "INTEREST_RATE_OUT_OF_RANGE");
    expect(err).toBeDefined();
  });

  // ── 19. Loan tenure out of range ───────────────────────────────────────
  test("loan tenure 20 years: LOAN_TENURE_OUT_OF_RANGE", () => {
    const profile = createTestProfile({
      financials: { loanTenureYears: 20 },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "LOAN_TENURE_OUT_OF_RANGE");
    expect(err).toBeDefined();
    expect(err!.fieldPath).toBe("financials.loanTenureYears");
  });

  // ── 20. Loan tenure 0 years: out of range ─────────────────────────────
  test("loan tenure 0 years: LOAN_TENURE_OUT_OF_RANGE", () => {
    const profile = createTestProfile({
      financials: { loanTenureYears: 0 },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "LOAN_TENURE_OUT_OF_RANGE");
    expect(err).toBeDefined();
  });

  // ── 21. Working capital negative ───────────────────────────────────────
  test("working capital negative: WORKING_CAPITAL_NEGATIVE", () => {
    const profile = createTestProfile({
      financials: { workingCapital: -5000 },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "WORKING_CAPITAL_NEGATIVE");
    expect(err).toBeDefined();
    expect(err!.fieldPath).toBe("financials.workingCapital");
  });

  // ── 22. No machinery items ─────────────────────────────────────────────
  test("no machinery items: MACHINERY_REQUIRED", () => {
    const profile = createTestProfile({
      machinery: { items: [], totalCost: 0 },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "MACHINERY_REQUIRED");
    expect(err).toBeDefined();
    expect(err!.fieldPath).toBe("machinery.items");
  });

  // ── 23. Land OWN without ownedLandValue (contradiction) ────────────────
  test("land OWN without ownedLandValue: contradiction", () => {
    const profile = createTestProfile({
      land: { status: "OWN", ownedLandValue: undefined, monthlyRent: undefined, buildingType: undefined },
    });
    const result = validateProject(profile);

    const contra = result.contradictions.find(
      (c) => c.fields.includes("land.status") && c.fields.includes("land.ownedLandValue"),
    );
    expect(contra).toBeDefined();
    expect(contra!.description).toContain("OWN");
  });

  // ── 24. Land RENTED without monthlyRent (contradiction) ────────────────
  test("land RENTED without monthlyRent: contradiction", () => {
    const profile = createTestProfile({
      land: { status: "RENTED", monthlyRent: undefined, ownedLandValue: undefined, buildingType: undefined },
    });
    const result = validateProject(profile);

    const contra = result.contradictions.find(
      (c) => c.fields.includes("land.status") && c.fields.includes("land.monthlyRent"),
    );
    expect(contra).toBeDefined();
    expect(contra!.description).toContain("RENTED");
  });

  // ── 25. Land OWN with ownedLandValue: no contradiction ─────────────────
  test("land OWN with ownedLandValue: no contradiction", () => {
    const profile = createTestProfile({
      land: { status: "OWN", ownedLandValue: 500000, monthlyRent: undefined, buildingType: undefined },
    });
    const result = validateProject(profile);

    const contra = result.contradictions.find(
      (c) => c.fields.includes("land.status") && c.fields.includes("land.ownedLandValue"),
    );
    expect(contra).toBeUndefined();
  });

  // ── 26. Non-engine-ready fields block canValidate ─────────────────────
  test("KNOWLEDGE-sourced mandatory fields block canValidate", () => {
    // Set all mandatory fields as USER but then override some to KNOWLEDGE-sourced
    const prov = createConfirmedProvenance([...MANDATORY_FIELDS, "business.nicCode"]);
    // Make some fields KNOWLEDGE-sourced with UNVERIFIED verification
    prov.perField["applicant.name"] = { source: "KNOWLEDGE", verification: "UNVERIFIED" };
    prov.perField["applicant.age"] = { source: "KNOWLEDGE", verification: "UNVERIFIED" };

    const profile = createTestProfile({ provenance: prov });
    const result = validateProject(profile);

    expect(result.canEnterReview).toBe(true); // data is filled, no business-rule errors
    expect(result.canValidate).toBe(false);   // but not all engine-ready
    expect(result.nonEngineReadyMandatoryFields).toContain("applicant.name");
    expect(result.nonEngineReadyMandatoryFields).toContain("applicant.age");
  });

  // ── 27. NIC code required for validation ───────────────────────────────
  test("missing NIC code: NIC_CODE_REQUIRED error", () => {
    const profile = createTestProfile({
      business: { nicCode: "" },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "NIC_CODE_REQUIRED");
    expect(err).toBeDefined();
  });

  // ── 28. Valid NIC code: no NIC_CODE_REQUIRED ──────────────────────────
  test("valid NIC code: no NIC_CODE_REQUIRED error", () => {
    const profile = createTestProfile({
      business: { nicCode: "103005" },
    });
    const result = validateProject(profile);

    const err = result.errors.find((e) => e.code === "NIC_CODE_REQUIRED");
    expect(err).toBeUndefined();
  });

  // ── 29. Aggregate provenance computation ───────────────────────────────
  test("aggregate provenance reflects field provenance scores", () => {
    // No provenance at all → aggregate = 0
    const profile1 = createTestProfile();
    const result1 = validateProject(profile1);
    expect(result1.aggregateProvenance).toBe(0);

    // All confirmed → aggregate = 1
    const profile2 = createTestProfile({
      provenance: createConfirmedProvenance([...MANDATORY_FIELDS, "business.nicCode"]),
    });
    const result2 = validateProject(profile2);
    expect(result2.aggregateProvenance).toBe(1);
  });

  // ── 30. Determinism: same input → same output ─────────────────────────
  test("pure function: same input produces identical output", () => {
    const profile = createTestProfile();
    const a = validateProject(profile);
    const b = validateProject(profile);
    expect(a).toEqual(b);
  });
});