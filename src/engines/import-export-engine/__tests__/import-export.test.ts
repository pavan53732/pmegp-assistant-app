// ─── Import/Export Engine Tests ────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { exportProject, importProject, validateExport } from "../index";
import { createTestProfile } from "@/test-helpers/create-test-profile";

describe("Import/Export Engine", () => {
  test("exportProject returns valid JSON string", () => {
    const profile = createTestProfile();
    const exported = exportProject(profile);
    expect(typeof exported).toBe("string");
    const parsed = JSON.parse(exported);
    expect(parsed.schemaVersion).toBeDefined();
    expect(parsed.schemeCode).toBeDefined();
    expect(parsed.knowledgeVersion).toBeDefined();
    expect(parsed.profile).toBeDefined();
  });

  test("export does NOT include API key", () => {
    const profile = createTestProfile();
    const exported = exportProject(profile);
    expect(exported).not.toContain("apiKey");
    expect(exported).not.toContain("sk-");
  });

  test("validateExport passes for valid export", () => {
    const profile = createTestProfile();
    const exported = exportProject(profile);
    const result = validateExport(exported);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("validateExport fails for invalid JSON", () => {
    const result = validateExport("not json");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("importProject round-trips data correctly", () => {
    const profile = createTestProfile();
    const exported = exportProject(profile);
    const imported = importProject(exported);
    expect(imported.profile.applicant.name).toBe(profile.applicant.name);
    expect(imported.profile.applicant.category).toBe(profile.applicant.category);
  });
});
