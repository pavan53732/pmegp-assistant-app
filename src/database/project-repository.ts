// ─── Project Repository (re-export shim) ───────────────────────────────────
// Compatibility layer: the SQLite-backed implementation now lives under
// `@/database/sqlite`. This file preserves the `@/database/project-repository`
// import path for any code that still references it.
//
// The `getProjectRepository` exported here is `async` (it lazily awaits
// `getDB()`). Callers that previously treated it as synchronous must now
// `await` it once and cache the instance — see doc 02 §persistence.
// ───────────────────────────────────────────────────────────────────────────

export { getProjectRepository } from "./sqlite";
export type {
  IProjectRepository,
  ProjectSummary,
  ChatMessageRecord,
} from "./interfaces";
