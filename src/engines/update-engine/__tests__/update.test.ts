// ─── Update Engine Tests ───────────────────────────────────────────────
import { describe, test, expect } from "vitest";
import { verifyManifest, validatePack } from "../index";

describe("Update Engine — verifyManifest()", () => {
  test("valid manifest structure is accepted", () => {
    const manifest = {
      version: "1.1.0",
      scheme: "PMEGP",
      releasedAt: "2026-01-15T00:00:00Z",
      files: [{ path: "data/test.json", hash: "abc123", size: 1024 }],
      signature: "test-signature",
    };
    const result = verifyManifest(manifest);
    expect(result).toBeDefined();
  });
});

describe("Update Engine — validatePack()", () => {
  test("valid pack data passes validation", () => {
    const pack = { version: "1.1.0", scheme: "PMEGP", data: { subsidyMatrix: {} } };
    const result = validatePack(pack);
    expect(result.valid).toBe(true);
  });

  test("pack with wrong scheme fails", () => {
    const pack = { version: "1.1.0", scheme: "UNKNOWN", data: {} };
    const result = validatePack(pack);
    expect(result.valid).toBe(false);
  });
});
