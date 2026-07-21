# PMEGP Assistant — Stage B Implementation Worklog

**Mission:** Transform Next.js web app → offline-first Capacitor 7 Android app.
**Source:** `AUDIT_REPORT.md` (Stage A findings) + `STAGE_B_IMPLEMENTATION_PROMPT.md`.
**Audit's own estimate:** 34–44 weeks total effort (Phase 0 alone = 4–6 weeks).

---

Task ID: 0
Agent: orchestrator (main)
Task: Read audit + Stage B prompt, assess current codebase, identify blockers before execution.

Work Log:
- Read AUDIT_REPORT.md (695 lines) — 5 core engines complete & tested; PDF engine server-only (pdfkit); OCR mock-only; 3 engines missing (Import/Export, Update, Project); 8 feature UI modules missing; DB not encrypted; Next.js API routes violate "no backend".
- Read STAGE_B_IMPLEMENTATION_PROMPT.md (579 lines) — full transformation plan.
- Inspected current package.json: next ^16, next-auth, next-intl, prisma, @prisma/client, pdfkit all present (all must be removed).
- Inspected src/ tree: 7 engines exist (validation, financial, eligibility, knowledge, dpr, pdf, ocr); AI interview orchestration exists; 9 API routes under src/app/api; Prisma repo at src/database/project-repository.ts; pipeline-service.ts + pipeline-api.ts + interview-api.ts to be deleted.
- Sampled financial-engine (pure, integer rupees, deterministic — good), pdf-engine (pdfkit, Node-only — must rewrite), project-repository (imports @/features/ai — boundary violation flagged in prompt).

Stage Summary:
- Codebase is high-quality where implemented; the gap is platform (Next.js→Capacitor) + 3 missing engines + 8 missing feature UIs.
- 8 concrete blockers in the Stage B prompt identified (see main response). Will apply corrected decisions and proceed with Wave 1 (scaffold) as critical path.
- Honest scope: cannot deliver full 44-week scope in one turn. Executing in waves; Wave 1 = architectural scaffold + DB migration + engine preservation.

---
Task ID: 1-DB
Agent: sqlite-db-layer
Task: Build src/database/sqlite/ layer + rewrite project-repository.ts for Capacitor SQLite

Work Log:
- Read worklog.md (orchestrator's Wave 1 state) and existing src/database/{interfaces,project-repository}.ts to anchor the contract; confirmed interfaces.ts already defines ChatMessageRecord locally (no features/ import).
- Created src/database/sqlite/types.ts — ProjectRow, AiProviderConfigRow, AppMetaRow (snake_case to match SQL columns; money lives in profile_data JSON).
- Created src/database/sqlite/schema.ts — SCHEMA_STATEMENTS array (projects with status CHECK constraint, ai_provider_config singleton, app_meta key/value).
- Created src/database/sqlite/migrations.ts — runMigrations(db): reads schema_version from app_meta (try/catch around first query handles a not-yet-created table), applies v0→v1 block inside executeTransaction, seeds knowledge_version/first_run_ack/schema_version/last_update_check; CURRENT_SCHEMA_VERSION=1, future blocks stubbed.
- Created src/database/sqlite/connection.ts — DbAdapter interface {execute, run, query<T>, executeTransaction}; getDB()/initDB() singletons that branch on Capacitor.isNativePlatform(). Native branch uses dynamic import("@capacitor-community/sqlite") and import("@capacitor-community/secure-storage") ONLY inside the native branch (zero top-level plugin imports — only `@capacitor/core`). Passphrase fetched from secure-storage key "db_passphrase" (32 random bytes hex); generated + persisted on first run. SQLiteConnection wrapped defensively (handles both no-arg and CapacitorSQLite-arg constructor forms); createConnection("pmegp", true, "secret", 1, false); setDatabaseSubstitution(passphrase) called before open(). NativeSqliteAdapter implements BEGIN/COMMIT/ROLLBACK around executeTransaction. Web branch is a clearly-labeled dev-only WebDbAdapter: in-memory Map-backed mock implementing the small SQL subset the repo+migrations use (parameterized INSERT [OR IGNORE|REPLACE], UPDATE...WHERE, DELETE...WHERE, SELECT [cols|*]...WHERE...ORDER BY).
- Created src/database/sqlite/repositories.ts — SqliteProjectRepository implements IProjectRepository (all 8 methods) via DbAdapter. buildEmptyProfile() mirrors the old Prisma defaults with two corrections: workingCapitalDetail.method is "USER_PROVIDED" (was typo "User_PROVIDED"), and completion.startedAt/lastUpdatedAt use deterministic "1970-01-01T00:00:00.000Z" (DB row timestamps still use new Date() — only the static template is deterministic). IDs via crypto.randomUUID(). appendChatMessages uses executeTransaction for read-modify-write with FIFO trim at MAX_CHAT_MESSAGES=200. getProjectRepository() is now async (lazily awaits getDB()); single instance + single promise cached.
- Created src/database/sqlite/index.ts barrel (getDB, initDB, SqliteProjectRepository, getProjectRepository, runMigrations, CURRENT_SCHEMA_VERSION, SCHEMA_STATEMENTS, type DbAdapter, type ProjectRow/AiProviderConfigRow/AppMetaRow).
- Rewrote src/database/project-repository.ts as a thin re-export shim: `export { getProjectRepository } from "./sqlite"` + type re-exports from interfaces.ts. Preserves the `@/database/project-repository` import path.
- Verified boundaries: grep confirmed zero imports from @/features/* or @/providers/* under src/database/, zero prisma/@prisma/client imports, and only `@capacitor/core` imported at top level of connection.ts (no top-level @capacitor-community/* imports — they are dynamic-import-only inside the native branch).

Stage Summary:
- Artifacts produced (all under src/database/, no other directories touched):
  - src/database/sqlite/types.ts        (new, 36 lines)
  - src/database/sqlite/schema.ts       (new, 36 lines)
  - src/database/sqlite/migrations.ts   (new, 80 lines)
  - src/database/sqlite/connection.ts   (new, 366 lines)
  - src/database/sqlite/repositories.ts (new, 327 lines)
  - src/database/sqlite/index.ts        (new, 19 lines)
  - src/database/project-repository.ts  (rewritten — was 139-line Prisma impl, now 16-line re-export shim)
- DbAdapter interface signature (final):
    execute(sql: string): Promise<void>;
    run(sql: string, params?: unknown[]): Promise<void>;
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
    executeTransaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void>;
- Native vs Web branch: native = @capacitor-community/sqlite + secure-storage (SQLCipher "secret" mode, 32-byte random passphrase from Android Keystore, dynamic-imported only when Capacitor.isNativePlatform()); web = in-memory Map-backed mock with a tiny SQL-subset interpreter (handles only the parameterized INSERT/UPDATE/DELETE/SELECT patterns the repo + migrations issue) so the vite dev server renders the UI in a browser without Capacitor.
- Decisions / assumptions:
  1. getProjectRepository() is now async (returns Promise<SqliteProjectRepository>). This is a BREAKING change to the existing sync signature — the one in-repo caller at src/features/ai/interview-store/interview-store.ts (lines 25, 51, 59) still treats it as sync and will need updating by the next agent (features/ is out of my boundary).
  2. NativeSqliteConn is declared as a local structural interface instead of `import type { SQLiteDBConnection }` — keeps top-level imports completely free of native plugin references (defensive against any strict Vite dep scanner).
  3. SQLiteConnection is constructed defensively: prefers the explicit-CapacitorSQLite form when that export is present, falls back to no-arg constructor (modern plugin auto-resolves). Cast via `as unknown as` so the code compiles whether or not `CapacitorSQLite` is exported.
  4. The plugin's `open()` is called when available to surface encryption errors at app startup rather than on the first user query.
  5. Migrations wrap each version block in a transaction; the first `SELECT value FROM app_meta` (which throws when the table doesn't exist on a fresh DB) is wrapped in try/catch — version defaults to 0 on first run.
  6. Web mock does not enforce CHECK constraints, transactions, or types — it's strictly a dev affordance. Production runs only on the native branch.
- Could not run `tsc` to verify (node_modules not yet installed — orchestrator is handling `bun install`). Type-safety verified by manual review against interfaces.ts, project-profile.ts, state-machine.ts, provenance.ts, and interview.ts.
- Next-agent action items:
  • Update src/features/ai/interview-store/interview-store.ts to `await getProjectRepository()` once and cache the resolved instance.
  • App startup (src/main.tsx or src/App.tsx) should call `await initDB()` before rendering routes that touch the repo.
  • Once @capacitor-community/sqlite + secure-storage are installed, run a native smoke test (create/list/update/appendChatMessages) — the exact plugin API quirks (setDatabaseSubstitution signature, createConnection arg form, open() availability) may need a one-line tweak in createNativeAdapter().

---
Task ID: 1 (Wave 1)
Agent: orchestrator (main)
Task: Architectural correction — Vite + Capacitor scaffold, DB migration, engine preservation, verify build.

Work Log:
- Wrote corrected package.json: Capacitor 8 (not 7 — sqlite plugin has no v7), @capacitor-community/sqlite ^8.1.0, capacitor-secure-storage-plugin ^0.13.0 (the official @capacitor/secure-storage does not exist), pdf-lib, @noble/ed25519, tesseract.js; removed next/prisma/pdfkit/z-ai-web-dev-sdk/next-auth/next-intl.
- Wrote vite.config.ts (port 3000 for Caddy gateway, @/ alias, vitest config), tsconfig.json (strict, vite-style, excludes _legacy + tests), index.html, src/main.tsx (BrowserRouter + QueryClient), src/App.tsx (scaffold home + /engines routes).
- Wrote capacitor.config.ts: SQLite mode 'secret' (corrected from the self-contradictory 'no-encryption'), SplashScreen/StatusBar green theme.
- Deleted: src/app/api/*, src/app/layout.tsx, src/app/page.tsx, src/lib/{db,pipeline-api,interview-api}.ts, src/services/*, next.config.ts, components.json, prisma/, db/, node_modules, .next.
- Dispatched sub-agent 1-DB: built src/database/sqlite/{types,schema,migrations,connection,repositories,index}.ts + rewrote project-repository.ts as a re-export shim. DbAdapter interface (execute/run/query/executeTransaction); native branch uses @capacitor-community/sqlite + capacitor-secure-storage-plugin (SQLCipher passphrase from Keystore); web branch uses in-memory mock for dev.
- Refactored repositories.ts: getProjectRepository() back to SYNC (captures getDB() promise; methods lazy-await) to avoid rippling async through InterviewStore.
- Fixed database/interfaces.ts boundary violation: removed @/features/ai import; defined ChatMessageRecord locally.
- Rewrote providers/index.ts: removed z-ai-web-dev-sdk path; getAIResponse(messages, connectionConfig, config?) — raw fetch to user's OpenAI-compatible endpoint only.
- Fixed orchestrator.ts call sites (arg order swap) with providerConfig! guard.
- Stubbed pdf-engine with pdf-lib (Wave 2 will do full 18-section layout).
- Rewrote eslint.config.mjs (flat config, Vite/TS, import-boundary rule: engines/ cannot import features/ or providers/).
- Moved legacy Next.js components (dashboard, interview, theme-toggle, etc.) to src/_legacy (excluded from tsc + eslint).
- Fixed postcss.config.mjs (object-form plugins for Vite), vite.config.ts (vitest/config for test field).
- bun install: 544 packages clean. typecheck: exit 0. lint: 0 errors / 13 warnings (unused-vars only).
- Verified dev server: GET / returns Vite HTML shell + HMR; /src/main.tsx + /src/App.tsx serve as compiled modules (HTTP 200); zero runtime errors in dev.log.
- Committed + pushed to main: bbf25d5.

Stage Summary:
- Wave 1 complete: Next.js → Vite + React 19 + Capacitor 8 scaffold builds, lints, and serves.
- 5 core engines preserved (validation, financial, eligibility, knowledge, dpr). PDF engine stubbed (Wave 2). OCR engine unchanged (Wave 2). 3 new engines pending (Wave 2).
- DB layer: Prisma removed; Capacitor SQLite (SQLCipher) + web dev mock in place; IProjectRepository implemented.
- 8 blockers from the Stage B prompt documented + corrected (see main response).
- Note: background dev server is reaped by the tool across commands (environment constraint); server proven working via in-command curl. Environment/preview panel restarts `bun run dev`.
- Next: Wave 2 — 3 new engines (Import/Export, Update, Project) + PDF full rewrite + OCR Tesseract rewrite, in parallel sub-agents.
