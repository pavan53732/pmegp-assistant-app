// ─── Project Engine ───────────────────────────────────────────────────────
// Pure state-machine + lifecycle logic for a ProjectProfile.
// See doc 01 §3 and doc 16 §11.
//
// Responsibilities (doc 16 §11):
//   • createProject     — mint id + empty profile
//   • inferState        — derive the highest ProjectStatus reached from
//                         phaseProgress + validation + provenance markers
//   • canEdit           — enforce monotonic one-step-forward / any-backward
//                         transition legality
//   • applyEdit         — immutable dot-path field updates with provenance
//                         snapshotting
//   • getStaleSnapshots — detect fields whose provenance snapshot no longer
//                         matches the current profile value
//
// Determinism: NO `Date.now()`, NO `Math.random()`. `crypto.randomUUID()` is
// used ONLY inside `createProject` (ID minting is not a calculation).
//
// Boundary: imports only from `@/shared/*`. Never `@/features/*`,
// `@/providers/*`, or `@/database/*`.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";
import type { InterviewPhase } from "@/shared/types/interview";
import type {
  FieldProvenance,
  ProvenanceSource,
} from "@/shared/types/provenance";

// ── Public Types ────────────────────────────────────────────────────────────

export interface FieldEdit {
  /** Dot-path into ProjectProfile, e.g. "applicant.name" or "machinery.items.0.unitCost". */
  fieldPath: string;
  value: unknown;
  source?: "USER" | "AI" | "KNOWLEDGE" | "OCR";
}

export interface StaleSnapshotInfo {
  fieldPath: string;
  previousValue: unknown;
  staleReason: string;
}

export interface ProjectEngine {
  createProject(name: string): {
    id: string;
    profile: ProjectProfile;
    status: ProjectStatus;
  };
  inferState(profile: ProjectProfile): ProjectStatus;
  canEdit(profile: ProjectProfile, targetStatus: ProjectStatus): boolean;
  applyEdit(profile: ProjectProfile, edits: FieldEdit[]): ProjectProfile;
  getStaleSnapshots(profile: ProjectProfile): StaleSnapshotInfo[];
}

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Deterministic timestamp used by the empty-profile template. The empty
 * profile is a *static* default; creating it must not depend on the wall
 * clock. (Mirrors the same constant in src/database/sqlite/repositories.ts.)
 */
const EMPTY_PROFILE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

/**
 * The 9 ProjectStatus values in lifecycle order, lowest → highest.
 * Used by `canEdit` to enforce monotonic one-step-forward transitions.
 *
 *   EMPTY → PARTIAL → DISCOVERING → COMPLETE → REVIEW_PENDING
 *        → VALIDATED → ELIGIBILITY_READY → FINANCIAL_READY → DPR_READY
 */
const STATUS_ORDER: readonly ProjectStatus[] = [
  "EMPTY",
  "PARTIAL",
  "DISCOVERING",
  "COMPLETE",
  "REVIEW_PENDING",
  "VALIDATED",
  "ELIGIBILITY_READY",
  "FINANCIAL_READY",
  "DPR_READY",
];

/**
 * The five discovery-phase InterviewPhases. When all five are COMPLETED the
 * profile is in the `COMPLETE` state (ready for validation → REVIEW_PENDING).
 */
const DISCOVERY_PHASES: readonly InterviewPhase[] = [
  "APPLICANT_DISCOVERY",
  "BUSINESS_DISCOVERY",
  "ACTIVITY_RESOLUTION",
  "PROJECT_SIZING",
  "FINANCIAL_PLANNING",
];

/**
 * Synthetic provenance keys for downstream-stage markers (Wave 2 convention).
 *
 * The canonical `ProjectProfile` type carries no field for eligibility /
 * financial / DPR computation outputs — those engines produce side outputs.
 * To let `inferState` see that those stages have run, downstream engines stamp
 * a synthetic entry in `provenance.perField` under one of these keys with
 * `verification: "VALIDATED"`. The leading underscore marks them as synthetic
 * (not real field paths) and excludes them from stale-snapshot scanning.
 */
const ELIGIBILITY_MARKER = "_eligibility.computed";
const FINANCIALS_MARKER = "_financials.computed";
const DPR_MARKER = "_dpr.generated";

/**
 * Wave 2 snapshot extension.
 *
 * `FieldProvenance` does not (yet) declare a value-snapshot field, but the
 * stale-detection feature requires one. We extend the type locally with
 * `__snapshotValue` so `applyEdit` can record the value at the time provenance
 * was set and `getStaleSnapshots` can later compare. The double-underscore
 * prefix marks it as engine-private. This is forward-compatible: if the
 * canonical type is later extended with a real `snapshotValue` field, this
 * code continues to work unchanged.
 */
type FieldProvenanceWithSnapshot = FieldProvenance & {
  __snapshotValue?: unknown;
};

// ── buildEmptyProfile ───────────────────────────────────────────────────────

/**
 * Build the canonical empty `ProjectProfile`.
 *
 * Mirrors `buildEmptyProfile` in `src/database/sqlite/repositories.ts` (same
 * shape + defaults). Duplicated here so the engine has zero coupling to the
 * database layer — `@/engines/*` must not import `@/database/*` (architecture
 * boundary, doc 02). If the DB template changes, this must change to match.
 */
function buildEmptyProfile(): ProjectProfile {
  return {
    applicant: {
      name: "",
      age: 0,
      gender: "MALE",
      category: "GEN",
      isWomen: false,
      education: "NONE",
      entityType: "INDIVIDUAL",
      priorSubsidy: false,
      edpCompleted: false,
    },
    business: {
      name: "",
      description: "",
      activityType: "MANUFACTURING",
      sector: "MANUFACTURING",
      subCategory: "MANUFACTURING",
    },
    location: {
      state: "",
      district: "",
      area: "RURAL",
      isHillBorderArea: false,
      isAspirationalDistrict: false,
    },
    land: { status: "NONE" },
    capacity: {
      installedCapacity: { unit: "", value: 0 },
      projectedCapacityUtil: 0,
      workingDaysPerMonth: 25,
      workingHoursPerDay: 8,
      shifts: 1,
    },
    machinery: { items: [], totalCost: 0 },
    rawMaterials: { items: [], totalMonthlyCost: 0 },
    employees: {
      skilled: { male: 0, female: 0, monthlyWagePerPerson: 0 },
      unskilled: { male: 0, female: 0, monthlyWagePerPerson: 0 },
      administrative: { count: 0, monthlyWagePerPerson: 0 },
      totalMonthlyWages: 0,
      totalEmployment: 0,
    },
    utilities: {
      monthlyPowerCost: 0,
      monthlyWaterCost: 0,
      monthlyRentCost: 0,
      monthlyMaintenanceCost: 0,
      monthlyTransportCost: 0,
      monthlyCommunicationCost: 0,
      monthlyInsuranceCost: 0,
      monthlyMiscCost: 0,
      totalMonthlyOverheads: 0,
    },
    financials: {
      machineryAndEquipment: 0,
      otherFixedAssets: 0,
      preOperativeExpenses: 0,
      buildingAndCivilWorks: 0,
      totalFixedCapital: 0,
      workingCapital: 0,
      totalProjectCost: 0,
      interestRate: 0,
      loanTenureYears: 7,
      repaymentMoratoriumMonths: 6,
      projectedMonthlySales: 0,
    },
    workingCapitalDetail: {
      rawMaterialDays: 30,
      workInProgressDays: 15,
      finishedGoodsDays: 15,
      creditorsDays: 15,
      method: "USER_PROVIDED",
    },
    market: { targetMarket: "" },
    attachments: { items: [] },
    validation: {
      completeness: 0,
      missingFields: [],
      errors: [],
      contradictions: [],
    },
    provenance: { perField: {}, aggregate: 0 },
    completion: {
      currentPhase: "APPLICANT_DISCOVERY",
      phaseProgress: {
        APPLICANT_DISCOVERY: {
          status: "NOT_STARTED",
          completedFields: 0,
          totalFields: 0,
        },
        BUSINESS_DISCOVERY: {
          status: "NOT_STARTED",
          completedFields: 0,
          totalFields: 0,
        },
        ACTIVITY_RESOLUTION: {
          status: "NOT_STARTED",
          completedFields: 0,
          totalFields: 0,
        },
        PROJECT_SIZING: {
          status: "NOT_STARTED",
          completedFields: 0,
          totalFields: 0,
        },
        FINANCIAL_PLANNING: {
          status: "NOT_STARTED",
          completedFields: 0,
          totalFields: 0,
        },
        REVIEW: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
        VALIDATION_COMPLETION: {
          status: "NOT_STARTED",
          completedFields: 0,
          totalFields: 0,
        },
      },
      startedAt: EMPTY_PROFILE_TIMESTAMP,
      lastUpdatedAt: EMPTY_PROFILE_TIMESTAMP,
      interactionCount: 0,
    },
  };
}

// ── Dot-path helpers ────────────────────────────────────────────────────────

/**
 * Read a value at a dot-path. Supports object traversal and integer array
 * indices (e.g. "machinery.items.0.unitCost"). Returns `undefined` for any
 * missing segment — never throws.
 */
function getPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    if (Array.isArray(acc)) {
      const idx = Number.parseInt(key, 10);
      return Number.isNaN(idx) ? undefined : acc[idx];
    }
    if (typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, root);
}

/**
 * Write a value at a dot-path. Auto-creates intermediate objects (or arrays
 * when the next path segment is a non-negative integer) as needed. Mutates
 * `root` in place — callers must pass a fresh clone.
 */
function setPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);
    let next = cursor[key];
    if (next == null || typeof next !== "object") {
      next = nextIsIndex ? [] : {};
      cursor[key] = next;
    }
    cursor = next as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

/**
 * Structural deep-clone. Prefers the platform `structuredClone` (handles
 * Date, Map, Set, typed arrays) and falls back to JSON for older runtimes.
 */
function deepClone<T>(value: T): T {
  if (typeof globalThis !== "undefined" && typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Cheap structural equality for snapshot comparison. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Engine Implementation ───────────────────────────────────────────────────

/**
 * Mint a new project: fresh UUID + canonical empty profile + `EMPTY` status.
 *
 * The `name` parameter is accepted for API ergonomics (callers like the
 * repository / UI layer pass it) but is NOT stored on `ProjectProfile` — the
 * canonical type has no top-level name field. The caller persists the name
 * out-of-band (e.g. the `projects.name` column in SQLite). `void name;`
 * marks the intentional non-use.
 */
function createProject(name: string): {
  id: string;
  profile: ProjectProfile;
  status: ProjectStatus;
} {
  void name;
  return {
    id: crypto.randomUUID(),
    profile: buildEmptyProfile(),
    status: "EMPTY",
  };
}

/**
 * Infer the highest `ProjectStatus` reached by a profile.
 *
 * Inference rules (checked highest → lowest so the result is monotonic in the
 * data: more progress never yields a lower state):
 *
 *   1. `provenance.perField["_dpr.generated"].verification === "VALIDATED"`
 *                                                                    → DPR_READY
 *   2. `provenance.perField["_financials.computed"]` VALIDATED     → FINANCIAL_READY
 *   3. `provenance.perField["_eligibility.computed"]` VALIDATED    → ELIGIBILITY_READY
 *   4. All phases NOT_STARTED                                       → EMPTY
 *   5. validation.completeness ≥ 100 AND no errors AND REVIEW phase
 *      COMPLETED                                                    → VALIDATED
 *   6. validation.completeness ≥ 100 AND no errors                  → REVIEW_PENDING
 *   7. All five discovery phases COMPLETED                          → COMPLETE
 *   8. APPLICANT_DISCOVERY AND BUSINESS_DISCOVERY both COMPLETED    → DISCOVERING
 *   9. Otherwise (any phase IN_PROGRESS / NEEDS_REVIEW)             → PARTIAL
 *
 * Downstream markers are checked BEFORE the EMPTY guard so an explicit
 * "this stage ran" signal always wins (a profile cannot be EMPTY if its DPR
 * was generated, even if the phase tracker is out of sync). Transitions are
 * approximate (doc 16 §11) but monotonic: filling more data can only hold or
 * raise the inferred state, never lower it (a state can lower only if data
 * is *removed* — e.g. completeness drops below 100, which is a legitimate
 * backward transition).
 */
function inferState(profile: ProjectProfile): ProjectStatus {
  const phases = profile.completion.phaseProgress;
  const validation = profile.validation;
  const perField = profile.provenance.perField;

  // 1–3. Downstream computation markers (highest first — explicit stage-ran
  // signals take precedence over the phase tracker).
  if (perField[DPR_MARKER]?.verification === "VALIDATED") return "DPR_READY";
  if (perField[FINANCIALS_MARKER]?.verification === "VALIDATED")
    return "FINANCIAL_READY";
  if (perField[ELIGIBILITY_MARKER]?.verification === "VALIDATED")
    return "ELIGIBILITY_READY";

  // 4. Nothing started yet.
  const allNotStarted = Object.values(phases).every(
    (p) => p.status === "NOT_STARTED",
  );
  if (allNotStarted) return "EMPTY";

  // 5–6. Validation-driven gates.
  const completeness100 = validation.completeness >= 100;
  const noErrors = validation.errors.length === 0;
  const reviewConfirmed = phases.REVIEW?.status === "COMPLETED";

  if (completeness100 && noErrors && reviewConfirmed) return "VALIDATED";
  if (completeness100 && noErrors) return "REVIEW_PENDING";

  // 7. All discovery phases complete.
  const allDiscoveryComplete = DISCOVERY_PHASES.every(
    (p) => phases[p]?.status === "COMPLETED",
  );
  if (allDiscoveryComplete) return "COMPLETE";

  // 8. Applicant + Business discovery complete (early discovery milestone).
  const applicantBusinessComplete =
    phases.APPLICANT_DISCOVERY?.status === "COMPLETED" &&
    phases.BUSINESS_DISCOVERY?.status === "COMPLETED";
  if (applicantBusinessComplete) return "DISCOVERING";

  // 9. Some progress but nothing higher matched.
  return "PARTIAL";
}

/**
 * Whether editing the profile to reach `targetStatus` is allowed.
 *
 * Rules (doc 16 §11.3):
 *   • Backward edits (target ≤ current) — ALWAYS allowed. Editing an earlier
 *     stage invalidates downstream stages (the caller is responsible for
 *     clearing the corresponding provenance markers / re-running engines).
 *   • Same-state edits (target === current) — allowed.
 *   • Forward edits — allowed ONLY one step at a time. E.g. VALIDATED →
 *     ELIGIBILITY_READY is OK; VALIDATED → DPR_READY is NOT (must pass
 *     through FINANCIAL_READY first).
 *   • DPR_READY has no forward successor, so any forward target is rejected
 *     — satisfying "NEVER allow editing a DPR_READY project's downstream
 *     without invalidating" (you must first move backward).
 */
function canEdit(profile: ProjectProfile, targetStatus: ProjectStatus): boolean {
  const current = inferState(profile);
  const currentIdx = STATUS_ORDER.indexOf(current);
  const targetIdx = STATUS_ORDER.indexOf(targetStatus);

  if (targetIdx < 0) return false; // Unknown target status (defensive).

  // Backward or same — always allowed.
  if (targetIdx <= currentIdx) return true;

  // Forward — only one step at a time.
  if (targetIdx === currentIdx + 1) return true;

  // More than one step forward — rejected.
  return false;
}

/**
 * Immutable field update. Deep-clones the input profile, applies each edit at
 * its dot-path, and (when `source` is provided) stamps the field's provenance
 * with the source + a `__snapshotValue` of the new value (used by
 * `getStaleSnapshots`). The input profile is never mutated.
 *
 * Array indexing in paths (e.g. "machinery.items.0.unitCost") is supported;
 * intermediate missing segments are auto-created as objects (or arrays when
 * the next segment is an integer).
 */
function applyEdit(profile: ProjectProfile, edits: FieldEdit[]): ProjectProfile {
  const next = deepClone(profile);
  for (const edit of edits) {
    if (!edit.fieldPath) continue;
    setPath(next as unknown as Record<string, unknown>, edit.fieldPath, edit.value);

    if (edit.source) {
      const entry: FieldProvenanceWithSnapshot = {
        source: edit.source as ProvenanceSource,
        verification: "UNVERIFIED",
        __snapshotValue: edit.value,
      };
      next.provenance.perField[edit.fieldPath] = entry as FieldProvenance;
    }
  }
  return next;
}

/**
 * Detect fields whose provenance snapshot no longer matches the current
 * profile value (Wave 2 simple version, per task spec).
 *
 * For each non-synthetic entry in `provenance.perField` that carries a
 * `__snapshotValue` (set by `applyEdit`), compare the snapshot to the value
 * currently at that dot-path. If they differ, the field is stale — typically
 * because an upstream field changed (e.g. machinery items edited after
 * financials were computed) and the downstream derivation is now out of date.
 */
function getStaleSnapshots(profile: ProjectProfile): StaleSnapshotInfo[] {
  const stale: StaleSnapshotInfo[] = [];
  for (const [fieldPath, entry] of Object.entries(profile.provenance.perField)) {
    // Skip synthetic stage markers.
    if (fieldPath.startsWith("_")) continue;

    const snapshot = (entry as FieldProvenanceWithSnapshot).__snapshotValue;
    if (snapshot === undefined) continue;

    const currentValue = getPath(profile, fieldPath);
    if (!deepEqual(snapshot, currentValue)) {
      stale.push({
        fieldPath,
        previousValue: snapshot,
        staleReason:
          `Provenance snapshot (source=${entry.source ?? "unknown"}, ` +
          `verification=${entry.verification}) no longer matches current value`,
      });
    }
  }
  return stale;
}

// ── Exported singleton ──────────────────────────────────────────────────────

export const projectEngine: ProjectEngine = {
  createProject,
  inferState,
  canEdit,
  applyEdit,
  getStaleSnapshots,
};
