// ─── SQLite Project Repository ─────────────────────────────────────────────
// Implements `IProjectRepository` against the `DbAdapter` from `connection.ts`.
// Replaces the former Prisma implementation. Boundary-safe: only imports from
// `@/shared/*` and `@/database/*` — never from `@/features/*` or `@/providers/*`.
// ───────────────────────────────────────────────────────────────────────────

import type { ProjectProfile } from "@/shared/types/project-profile";
import type { ProjectStatus } from "@/shared/types/state-machine";
import type {
  ChatMessageRecord,
  IProjectRepository,
  ProjectSummary,
} from "@/database/interfaces";
import type { DbAdapter } from "./connection";
import type { ProjectRow } from "./types";
import { getDB } from "./connection";

/** Maximum number of chat messages stored per project (FIFO trim). */
const MAX_CHAT_MESSAGES = 200;

/**
 * Deterministic timestamp used by the empty-profile template. The empty
 * profile is a *static* default; creating it must not depend on the wall
 * clock. (The DB layer is allowed to use `new Date()` for actual row
 * timestamps — only engines/ are strictly deterministic per doc 02.)
 */
const EMPTY_PROFILE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

/**
 * Build the canonical empty `ProjectProfile`.
 *
 * Mirrors the defaults the old Prisma repo seeded. Two corrections from the
 * audit:
 *   - `workingCapitalDetail.method` is `"USER_PROVIDED"` (was `"User_PROVIDED"`).
 *   - `completion.startedAt` / `lastUpdatedAt` use a deterministic constant
 *     instead of `new Date().toISOString()` so the empty template is stable.
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
    validation: { completeness: 0, missingFields: [], errors: [], contradictions: [] },
    provenance: { perField: {}, aggregate: 0 },
    completion: {
      currentPhase: "APPLICANT_DISCOVERY",
      phaseProgress: {
        APPLICANT_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
        BUSINESS_DISCOVERY: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
        ACTIVITY_RESOLUTION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
        PROJECT_SIZING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
        FINANCIAL_PLANNING: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
        REVIEW: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
        VALIDATION_COMPLETION: { status: "NOT_STARTED", completedFields: 0, totalFields: 0 },
      },
      startedAt: EMPTY_PROFILE_TIMESTAMP,
      lastUpdatedAt: EMPTY_PROFILE_TIMESTAMP,
      interactionCount: 0,
    },
  };
}

/** Extract a lightweight `ProjectSummary` from a projects row. */
function extractSummary(row: ProjectRow): ProjectSummary {
  let profile: ProjectProfile | null = null;
  try {
    profile = JSON.parse(row.profile_data) as ProjectProfile;
  } catch {
    // Corrupted profile JSON — fall back to safe defaults.
  }
  return {
    id: row.id,
    name: row.name,
    status: row.status as ProjectStatus,
    businessName: profile?.business?.name ?? "",
    businessDescription: profile?.business?.description ?? "",
    nicCode: profile?.business?.nicCode ?? null,
    totalProjectCost: profile?.financials?.totalProjectCost ?? 0,
    completeness: profile?.validation?.completeness ?? 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ── Repository implementation ───────────────────────────────────────────────

export class SqliteProjectRepository implements IProjectRepository {
  /**
   * Lazy DB promise. `getDB()` returns a Promise synchronously (it caches the
   * init work in `_initPromise`), so the repository can be constructed without
   * awaiting — keeping `getProjectRepository()` synchronous for callers. Each
   * async method awaits the adapter on first use.
   */
  constructor(private dbPromise: Promise<DbAdapter>) {}

  private db(): Promise<DbAdapter> {
    return this.dbPromise;
  }

  async create(name: string): Promise<ProjectSummary> {
    const db = await this.db();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const profile = buildEmptyProfile();
    await db.run(
      `INSERT INTO projects (id, name, status, profile_data, provenance_data, completion_data, chat_history, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        name,
        "EMPTY",
        JSON.stringify(profile),
        JSON.stringify(profile.provenance),
        JSON.stringify(profile.completion),
        "[]",
        now,
        now,
      ]
    );
    const rows = await db.query<ProjectRow>(
      `SELECT * FROM projects WHERE id = ?;`,
      [id]
    );
    if (rows.length === 0) {
      throw new Error(`Failed to create project (no row for id=${id})`);
    }
    return extractSummary(rows[0]);
  }

  async getById(id: string): Promise<(ProjectSummary & { profile: ProjectProfile }) | null> {
    const db = await this.db();
    const rows = await db.query<ProjectRow>(
      `SELECT * FROM projects WHERE id = ?;`,
      [id]
    );
    if (rows.length === 0) return null;
    const summary = extractSummary(rows[0]);
    return { ...summary, profile: JSON.parse(rows[0].profile_data) as ProjectProfile };
  }

  async list(): Promise<ProjectSummary[]> {
    const db = await this.db();
    const rows = await db.query<ProjectRow>(
      `SELECT * FROM projects ORDER BY updated_at DESC;`
    );
    return rows.map(extractSummary);
  }

  async updateProfile(id: string, profile: ProjectProfile, status?: ProjectStatus): Promise<void> {
    const db = await this.db();
    const now = new Date().toISOString();
    if (status) {
      await db.run(
        `UPDATE projects
           SET profile_data = ?, provenance_data = ?, completion_data = ?, status = ?, updated_at = ?
         WHERE id = ?;`,
        [
          JSON.stringify(profile),
          JSON.stringify(profile.provenance),
          JSON.stringify(profile.completion),
          status,
          now,
          id,
        ]
      );
    } else {
      await db.run(
        `UPDATE projects
           SET profile_data = ?, provenance_data = ?, completion_data = ?, updated_at = ?
         WHERE id = ?;`,
        [
          JSON.stringify(profile),
          JSON.stringify(profile.provenance),
          JSON.stringify(profile.completion),
          now,
          id,
        ]
      );
    }
  }

  async updateStatus(id: string, status: ProjectStatus): Promise<void> {
    const db = await this.db();
    const now = new Date().toISOString();
    await db.run(
      `UPDATE projects SET status = ?, updated_at = ? WHERE id = ?;`,
      [status, now, id]
    );
  }

  async delete(id: string): Promise<void> {
    const db = await this.db();
    await db.run(`DELETE FROM projects WHERE id = ?;`, [id]);
  }

  async getChatHistory(id: string): Promise<ChatMessageRecord[]> {
    const db = await this.db();
    const rows = await db.query<{ chat_history: string }>(
      `SELECT chat_history FROM projects WHERE id = ?;`,
      [id]
    );
    if (rows.length === 0) return [];
    try {
      const parsed = JSON.parse(rows[0].chat_history) as ChatMessageRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async appendChatMessages(id: string, messages: ChatMessageRecord[]): Promise<void> {
    if (messages.length === 0) return;
    const db = await this.db();
    // Read-modify-write inside a transaction so concurrent appends don't lose
    // history.
    await db.executeTransaction(async (tx) => {
      const rows = await tx.query<{ chat_history: string }>(
        `SELECT chat_history FROM projects WHERE id = ?;`,
        [id]
      );
      if (rows.length === 0) return;
      let existing: ChatMessageRecord[] = [];
      try {
        const parsed = JSON.parse(rows[0].chat_history);
        if (Array.isArray(parsed)) existing = parsed as ChatMessageRecord[];
      } catch {
        // Corrupted history — start fresh.
      }
      const combined = [...existing, ...messages];
      const trimmed =
        combined.length > MAX_CHAT_MESSAGES
          ? combined.slice(combined.length - MAX_CHAT_MESSAGES)
          : combined;
      const now = new Date().toISOString();
      await tx.run(
        `UPDATE projects SET chat_history = ?, updated_at = ? WHERE id = ?;`,
        [JSON.stringify(trimmed), now, id]
      );
    });
  }
}

// ── Singleton accessor ──────────────────────────────────────────────────────

let _instance: SqliteProjectRepository | null = null;

/**
 * Get the singleton `SqliteProjectRepository` (synchronous).
 *
 * `getDB()` returns a Promise synchronously (it caches the adapter init in
 * `_initPromise`), so we capture that promise in the repository at construction
 * time. Each async repo method awaits the adapter on first use. This preserves
 * the original synchronous accessor signature and avoids forcing callers
 * (e.g. `InterviewStore`) to become async just to obtain the repository.
 */
export function getProjectRepository(): SqliteProjectRepository {
  if (!_instance) {
    _instance = new SqliteProjectRepository(getDB());
  }
  return _instance;
}
