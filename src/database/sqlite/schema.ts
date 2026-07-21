// ─── SQLite Schema (v1) ───────────────────────────────────────────────────
// `CREATE TABLE` statements applied by `migrations.ts` on first run.
//
// Design notes:
//   - All money fields live inside `projects.profile_data` JSON (integer
//     rupees — never float-coerced). No money columns exist in the schema.
//   - `projects.status` is CHECK-constrained to the 9 ProjectStatus values
//     defined in `@/shared/types/state-machine`.
//   - `ai_provider_config` is a singleton row (id = 1).
//   - `app_meta` is a generic key/value store used for schema versioning and
//     other app-level flags (knowledge_version, first_run_ack, …).
// ───────────────────────────────────────────────────────────────────────────

export const SCHEMA_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('EMPTY','PARTIAL','DISCOVERING','COMPLETE','REVIEW_PENDING','VALIDATED','ELIGIBILITY_READY','FINANCIAL_READY','DPR_READY')),
     profile_data TEXT NOT NULL,
     provenance_data TEXT NOT NULL,
     completion_data TEXT NOT NULL,
     chat_history TEXT NOT NULL DEFAULT '[]',
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS ai_provider_config (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     base_url TEXT NOT NULL,
     model_name TEXT NOT NULL,
     is_active INTEGER DEFAULT 1,
     updated_at TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS app_meta (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
] as const;
