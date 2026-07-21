// ─── SQLite Database Layer Barrel ──────────────────────────────────────────
// Public surface for the offline-first persistence layer. Engine/feature code
// imports from here (or from `@/database/project-repository`).
// ───────────────────────────────────────────────────────────────────────────

export { getDB, initDB } from "./connection";
export {
  SqliteProjectRepository,
  getProjectRepository,
} from "./repositories";
export { runMigrations, CURRENT_SCHEMA_VERSION } from "./migrations";
export { SCHEMA_STATEMENTS } from "./schema";

export type { DbAdapter } from "./connection";
export type {
  ProjectRow,
  AiProviderConfigRow,
  AppMetaRow,
} from "./types";
