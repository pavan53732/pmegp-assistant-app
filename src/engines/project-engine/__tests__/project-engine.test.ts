// Smoke test for project-engine — verifies the engine contract.
import { describe, it, expect } from "vitest";
import { projectEngine } from "@/engines/project-engine";
import type { ProjectProfile } from "@/shared/types/project-profile";

/** Directly set a provenance marker (bypasses applyEdit which is for real fields). */
function withMarker(profile: ProjectProfile, key: string): ProjectProfile {
  const next = structuredClone(profile);
  next.provenance.perField[key] = { source: "AI", verification: "VALIDATED" };
  return next;
}

describe("project-engine.createProject", () => {
  it("mints a UUID id, empty profile, EMPTY status", () => {
    const { id, profile, status } = projectEngine.createProject("Test");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(profile.applicant.name).toBe("");
    expect(profile.completion.phaseProgress.APPLICANT_DISCOVERY.status).toBe("NOT_STARTED");
    expect(profile.provenance.perField).toEqual({});
    expect(status).toBe("EMPTY");
  });

  it("generates unique ids on repeated calls", () => {
    const a = projectEngine.createProject("A").id;
    const b = projectEngine.createProject("B").id;
    expect(a).not.toBe(b);
  });
});

describe("project-engine.inferState", () => {
  it("empty profile => EMPTY", () => {
    const { profile } = projectEngine.createProject("x");
    expect(projectEngine.inferState(profile)).toBe("EMPTY");
  });

  it("some progress but no discovery complete => PARTIAL", () => {
    const { profile } = projectEngine.createProject("x");
    const p = structuredClone(profile);
    p.completion.phaseProgress.APPLICANT_DISCOVERY.status = "IN_PROGRESS";
    expect(projectEngine.inferState(p)).toBe("PARTIAL");
  });

  it("APPLICANT + BUSINESS complete => DISCOVERING", () => {
    const { profile } = projectEngine.createProject("x");
    const p = structuredClone(profile);
    p.completion.phaseProgress.APPLICANT_DISCOVERY.status = "COMPLETED";
    p.completion.phaseProgress.BUSINESS_DISCOVERY.status = "COMPLETED";
    expect(projectEngine.inferState(p)).toBe("DISCOVERING");
  });

  it("all 5 discovery phases complete => COMPLETE", () => {
    const { profile } = projectEngine.createProject("x");
    const p = structuredClone(profile);
    (["APPLICANT_DISCOVERY", "BUSINESS_DISCOVERY", "ACTIVITY_RESOLUTION", "PROJECT_SIZING", "FINANCIAL_PLANNING"] as const).forEach((ph) => {
      p.completion.phaseProgress[ph].status = "COMPLETED";
    });
    expect(projectEngine.inferState(p)).toBe("COMPLETE");
  });

  it("completeness 100 + no errors => REVIEW_PENDING", () => {
    const { profile } = projectEngine.createProject("x");
    const p = structuredClone(profile);
    // Move at least one phase past NOT_STARTED so the EMPTY guard doesn't fire.
    p.completion.phaseProgress.APPLICANT_DISCOVERY.status = "COMPLETED";
    p.validation.completeness = 100;
    p.validation.errors = [];
    expect(projectEngine.inferState(p)).toBe("REVIEW_PENDING");
  });

  it("completeness 100 + REVIEW phase COMPLETED => VALIDATED", () => {
    const { profile } = projectEngine.createProject("x");
    const p = structuredClone(profile);
    p.validation.completeness = 100;
    p.validation.errors = [];
    p.completion.phaseProgress.REVIEW.status = "COMPLETED";
    expect(projectEngine.inferState(p)).toBe("VALIDATED");
  });

  it("eligibility marker => ELIGIBILITY_READY", () => {
    const { profile } = projectEngine.createProject("x");
    const p = withMarker(profile, "_eligibility.computed");
    expect(projectEngine.inferState(p)).toBe("ELIGIBILITY_READY");
  });

  it("financials marker => FINANCIAL_READY", () => {
    const { profile } = projectEngine.createProject("x");
    const p = withMarker(profile, "_financials.computed");
    expect(projectEngine.inferState(p)).toBe("FINANCIAL_READY");
  });

  it("dpr marker => DPR_READY", () => {
    const { profile } = projectEngine.createProject("x");
    const p = withMarker(profile, "_dpr.generated");
    expect(projectEngine.inferState(p)).toBe("DPR_READY");
  });

  it("dpr marker beats eligibility marker (highest wins)", () => {
    const { profile } = projectEngine.createProject("x");
    let p = withMarker(profile, "_eligibility.computed");
    p = withMarker(p, "_dpr.generated");
    expect(projectEngine.inferState(p)).toBe("DPR_READY");
  });
});

describe("project-engine.canEdit", () => {
  const empty = () => projectEngine.createProject("x").profile;

  it("same status => true", () => {
    expect(projectEngine.canEdit(empty(), "EMPTY")).toBe(true);
  });

  it("one step forward => true", () => {
    expect(projectEngine.canEdit(empty(), "PARTIAL")).toBe(true);
  });

  it("two steps forward => false", () => {
    expect(projectEngine.canEdit(empty(), "DISCOVERING")).toBe(false);
  });

  it("many steps forward => false", () => {
    expect(projectEngine.canEdit(empty(), "DPR_READY")).toBe(false);
  });

  it("backward always allowed (REVIEW_PENDING -> EMPTY)", () => {
    const p = structuredClone(empty());
    p.completion.phaseProgress.APPLICANT_DISCOVERY.status = "COMPLETED";
    p.validation.completeness = 100;
    p.validation.errors = [];
    expect(projectEngine.inferState(p)).toBe("REVIEW_PENDING");
    expect(projectEngine.canEdit(p, "EMPTY")).toBe(true);
    expect(projectEngine.canEdit(p, "COMPLETE")).toBe(true);
  });

  it("REVIEW_PENDING -> VALIDATED (one forward) => true", () => {
    const p = structuredClone(empty());
    p.completion.phaseProgress.APPLICANT_DISCOVERY.status = "COMPLETED";
    p.validation.completeness = 100;
    p.validation.errors = [];
    expect(projectEngine.canEdit(p, "VALIDATED")).toBe(true);
  });

  it("REVIEW_PENDING -> ELIGIBILITY_READY (two forward) => false", () => {
    const p = structuredClone(empty());
    p.completion.phaseProgress.APPLICANT_DISCOVERY.status = "COMPLETED";
    p.validation.completeness = 100;
    p.validation.errors = [];
    expect(projectEngine.canEdit(p, "ELIGIBILITY_READY")).toBe(false);
  });

  it("DPR_READY -> FINANCIAL_READY (backward) => true", () => {
    const p = withMarker(empty(), "_dpr.generated");
    expect(projectEngine.inferState(p)).toBe("DPR_READY");
    expect(projectEngine.canEdit(p, "FINANCIAL_READY")).toBe(true);
    expect(projectEngine.canEdit(p, "ELIGIBILITY_READY")).toBe(true);
    expect(projectEngine.canEdit(p, "EMPTY")).toBe(true);
  });

  it("DPR_READY -> DPR_READY (same) => true", () => {
    const p = withMarker(empty(), "_dpr.generated");
    expect(projectEngine.canEdit(p, "DPR_READY")).toBe(true);
  });
});

describe("project-engine.applyEdit", () => {
  it("does not mutate input", () => {
    const { profile } = projectEngine.createProject("x");
    const before = JSON.stringify(profile);
    projectEngine.applyEdit(profile, [
      { fieldPath: "applicant.name", value: "Ramesh", source: "USER" },
    ]);
    expect(JSON.stringify(profile)).toBe(before);
  });

  it("sets simple dot-path value", () => {
    const { profile } = projectEngine.createProject("x");
    const next = projectEngine.applyEdit(profile, [
      { fieldPath: "applicant.name", value: "Ramesh" },
    ]);
    expect(next.applicant.name).toBe("Ramesh");
  });

  it("stamps provenance when source provided", () => {
    const { profile } = projectEngine.createProject("x");
    const next = projectEngine.applyEdit(profile, [
      { fieldPath: "applicant.age", value: 32, source: "USER" },
    ]);
    expect(next.provenance.perField["applicant.age"]?.source).toBe("USER");
    expect(next.provenance.perField["applicant.age"]?.verification).toBe("UNVERIFIED");
  });

  it("does not stamp provenance when source omitted", () => {
    const { profile } = projectEngine.createProject("x");
    const next = projectEngine.applyEdit(profile, [
      { fieldPath: "applicant.age", value: 32 },
    ]);
    expect(next.provenance.perField["applicant.age"]).toBeUndefined();
  });

  it("sets nested array element via integer index path", () => {
    const { profile } = projectEngine.createProject("x");
    const next = projectEngine.applyEdit(profile, [
      { fieldPath: "machinery.items.0.name", value: "Lathe" },
      { fieldPath: "machinery.items.0.unitCost", value: 100000 },
    ]);
    expect(next.machinery.items[0].name).toBe("Lathe");
    expect(next.machinery.items[0].unitCost).toBe(100000);
  });

  it("applies multiple edits in one call", () => {
    const { profile } = projectEngine.createProject("x");
    const next = projectEngine.applyEdit(profile, [
      { fieldPath: "applicant.name", value: "A" },
      { fieldPath: "business.name", value: "B" },
      { fieldPath: "location.state", value: "S" },
    ]);
    expect(next.applicant.name).toBe("A");
    expect(next.business.name).toBe("B");
    expect(next.location.state).toBe("S");
  });
});

describe("project-engine.getStaleSnapshots", () => {
  it("returns empty list for fresh profile", () => {
    const { profile } = projectEngine.createProject("x");
    expect(projectEngine.getStaleSnapshots(profile)).toEqual([]);
  });

  it("returns empty when values match snapshots", () => {
    const { profile } = projectEngine.createProject("x");
    const next = projectEngine.applyEdit(profile, [
      { fieldPath: "applicant.name", value: "Ramesh", source: "USER" },
    ]);
    expect(projectEngine.getStaleSnapshots(next)).toEqual([]);
  });

  it("detects field changed after snapshot was taken", () => {
    const { profile } = projectEngine.createProject("x");
    const withSnapshot = projectEngine.applyEdit(profile, [
      { fieldPath: "machinery.totalCost", value: 100000, source: "AI" },
    ]);
    // Later change the value WITHOUT a source (so provenance snapshot stays)
    const changed = projectEngine.applyEdit(withSnapshot, [
      { fieldPath: "machinery.totalCost", value: 150000 },
    ]);
    const stale = projectEngine.getStaleSnapshots(changed);
    expect(stale).toHaveLength(1);
    expect(stale[0].fieldPath).toBe("machinery.totalCost");
    expect(stale[0].previousValue).toBe(100000);
    expect(stale[0].staleReason).toContain("AI");
  });

  it("skips synthetic marker keys (leading underscore)", () => {
    const { profile } = projectEngine.createProject("x");
    const p = structuredClone(profile);
    p.provenance.perField["_eligibility.computed"] = {
      source: "AI",
      verification: "VALIDATED",
    };
    expect(projectEngine.getStaleSnapshots(p)).toEqual([]);
  });
});
