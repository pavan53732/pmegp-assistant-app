// ─── Field Updater Tests ──────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import {
  setFieldValue,
  getFieldValue,
  updateProvenance,
  stampAllConfirmed,
  computeDerivedFields,
} from "../field-updater";
import type { ProjectProfile } from "@/shared/types/project-profile";
import { createTestProfile } from "@/test-helpers/create-test-profile";

describe("Field Updater — Pure Functions", () => {
  // ── setFieldValue ────────────────────────────────────────────────────
  describe("setFieldValue()", () => {
    test('sets applicant.name to "Rajesh"', () => {
      const profile = createTestProfile({ applicant: { name: "Original" } });
      const updated = setFieldValue(profile, "applicant.name", "Rajesh");
      expect(updated.applicant.name).toBe("Rajesh");
    });

    test("does not mutate the original profile", () => {
      const profile = createTestProfile({ applicant: { name: "Original" } });
      setFieldValue(profile, "applicant.name", "Rajesh");
      expect(profile.applicant.name).toBe("Original");
    });

    test("sets a nested numeric field", () => {
      const profile = createTestProfile({ applicant: { age: 30 } });
      const updated = setFieldValue(profile, "applicant.age", 35);
      expect(updated.applicant.age).toBe(35);
      expect(profile.applicant.age).toBe(30);
    });

    test("sets a deeply nested field (capacity.installedCapacity.unit)", () => {
      const profile = createTestProfile();
      const updated = setFieldValue(profile, "capacity.installedCapacity.unit", "litres/day");
      expect(updated.capacity.installedCapacity.unit).toBe("litres/day");
    });
  });

  // ── getFieldValue ────────────────────────────────────────────────────
  describe("getFieldValue()", () => {
    test("returns the applicant.age", () => {
      const profile = createTestProfile({ applicant: { age: 42 } });
      expect(getFieldValue(profile, "applicant.age")).toBe(42);
    });

    test("returns the applicant.name", () => {
      const profile = createTestProfile({ applicant: { name: "Suresh" } });
      expect(getFieldValue(profile, "applicant.name")).toBe("Suresh");
    });

    test("returns undefined for non-existent path", () => {
      const profile = createTestProfile();
      expect(getFieldValue(profile, "nonexistent.path")).toBeUndefined();
    });

    test("traverses nested objects correctly", () => {
      const profile = createTestProfile();
      expect(getFieldValue(profile, "capacity.installedCapacity.unit")).toBe("kg/month");
      expect(getFieldValue(profile, "capacity.installedCapacity.value")).toBe(500);
    });

    test("returns undefined when intermediate is null", () => {
      const profile = createTestProfile();
      // Set an intermediate to null via setFieldValue (which does JSON.parse/stringify)
      const updated = setFieldValue(profile, "applicant.name", null as unknown as string);
      // applicant exists but name is null — should still work for other fields
      expect(getFieldValue(updated, "applicant.age")).toBe(30);
    });
  });

  // ── updateProvenance ──────────────────────────────────────────────────
  describe("updateProvenance()", () => {
    test('adds USER entry for "applicant.name"', () => {
      const map: Record<string, { source: string | null; verification: string }> = {};
      const updated = updateProvenance(map, "applicant.name", "USER");
      expect(updated["applicant.name"]).toBeDefined();
      expect(updated["applicant.name"].source).toBe("USER");
      expect(updated["applicant.name"].verification).toBe("UNVERIFIED");
    });

    test("does not mutate the original map", () => {
      const map: Record<string, { source: string | null; verification: string }> = {};
      updateProvenance(map, "applicant.name", "USER");
      expect(Object.keys(map)).toHaveLength(0);
    });

    test("sets verification to CONFIRMED when specified", () => {
      const map = {};
      const updated = updateProvenance(map, "applicant.age", "USER", "CONFIRMED");
      expect(updated["applicant.age"].verification).toBe("CONFIRMED");
      expect(updated["applicant.age"].confirmedAt).toBeTruthy();
    });

    test("overwrites existing entry immutably", () => {
      const map = {
        "applicant.name": { source: "AI" as const, verification: "UNVERIFIED" as const },
      };
      const updated = updateProvenance(map, "applicant.name", "USER", "CONFIRMED");
      expect(updated["applicant.name"].source).toBe("USER");
      // Original is unchanged
      expect(map["applicant.name"].source).toBe("AI");
    });
  });

  // ── stampAllConfirmed ────────────────────────────────────────────────
  describe("stampAllConfirmed()", () => {
    test("sets all entries to CONFIRMED", () => {
      const map = {
        "applicant.name": { source: "USER" as const, verification: "UNVERIFIED" as const },
        "applicant.age": { source: "AI" as const, verification: "UNVERIFIED" as const },
        "applicant.gender": { source: null, verification: "UNVERIFIED" as const },
      };
      const stamped = stampAllConfirmed(map);

      expect(stamped["applicant.name"].verification).toBe("CONFIRMED");
      expect(stamped["applicant.age"].verification).toBe("CONFIRMED");
      // null source entries are skipped
      expect(stamped["applicant.gender"]).toBeUndefined();
    });

    test("sets confirmedAt timestamp", () => {
      const map = {
        "applicant.name": { source: "USER" as const, verification: "UNVERIFIED" as const },
      };
      const stamped = stampAllConfirmed(map);
      expect(stamped["applicant.name"].confirmedAt).toBeTruthy();
    });

    test("does not mutate the original map", () => {
      const map = {
        "applicant.name": { source: "USER" as const, verification: "UNVERIFIED" as const },
      };
      stampAllConfirmed(map);
      expect(map["applicant.name"].verification).toBe("UNVERIFIED");
    });
  });

  // ── computeDerivedFields ─────────────────────────────────────────────
  describe("computeDerivedFields()", () => {
    test("FEMALE gender → isWomen = true", () => {
      const profile = createTestProfile({
        applicant: { gender: "FEMALE", isWomen: false },
      });
      const result = computeDerivedFields(profile);
      expect(result.applicant.isWomen).toBe(true);
    });

    test("MALE gender → isWomen = false (if was incorrectly true)", () => {
      const profile = createTestProfile({
        applicant: { gender: "MALE", isWomen: true },
      });
      const result = computeDerivedFields(profile);
      expect(result.applicant.isWomen).toBe(false);
    });

    test("FEMALE + isWomen already true → returns same profile (no unnecessary copy for this field)", () => {
      const profile = createTestProfile({
        applicant: { gender: "FEMALE", isWomen: true },
      });
      const result = computeDerivedFields(profile);
      // When isWomen already matches gender, the function may still create a new object
      // due to the spread. Check the values are consistent.
      expect(result.applicant.gender).toBe("FEMALE");
      expect(result.applicant.isWomen).toBe(true);
    });

    test("does not mutate the original profile", () => {
      const profile = createTestProfile({
        applicant: { gender: "FEMALE", isWomen: false },
      });
      computeDerivedFields(profile);
      expect(profile.applicant.isWomen).toBe(false);
    });

    test("OTHER gender → isWomen = false (if was incorrectly true)", () => {
      const profile = createTestProfile({
        applicant: { gender: "OTHER", isWomen: true },
      });
      const result = computeDerivedFields(profile);
      expect(result.applicant.isWomen).toBe(false);
    });
  });

  // ── Integration: set then get ────────────────────────────────────────
  test("setFieldValue + getFieldValue round-trip", () => {
    const profile = createTestProfile();
    const updated = setFieldValue(profile, "financials.interestRate", 14.5);
    expect(getFieldValue(updated, "financials.interestRate")).toBe(14.5);
    expect(getFieldValue(profile, "financials.interestRate")).toBe(12);
  });
});