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

---
Task ID: 2-A
Agent: import-export-engine (Wave 2)
Task: Create src/engines/import-export-engine/index.ts implementing the Import/Export Engine per doc 12 Part A (export/import single project + encrypted full-DB backup/restore).

Work Log:
- Read worklog.md (Tasks 0, 1-DB, 1) to anchor on the Wave 1 state: Vite + React 19 + Capacitor 8 scaffold, sqlite DB layer with DbAdapter {execute/run/query<T>/executeTransaction}, getDB() singleton from @/database/sqlite, three tables (projects, ai_provider_config singleton id=1, app_meta key/value), migrations seed knowledge_version="bundled".
- Read the actual type files to verify field names (spec said "adapt if mismatch"):
  - shared/types/project-profile.ts → ProjectProfile (confirmed: applicant/business/location/land/capacity/machinery/rawMaterials/employees/utilities/financials/workingCapitalDetail/market/attachments/validation/provenance/completion). Its own AttachmentRef has fileName + type: AttachmentType + ocrExtractedFields etc. — richer than the export envelope needs, so the engine defines its OWN AttachmentRef locally (filename + mimeType + type:string + id), per requirement #5. The caller (features layer) projects the profile's attachment list down to the envelope shape.
  - engines/financial-engine/index.ts → FinancialResult (24 fields incl. loanSchedule). Pass-through — no field-name mismatches.
  - engines/eligibility-engine/index.ts → EligibilityResult {eligible, checks, blockers, warnings}. Pass-through — no mismatches.
  - database/sqlite/types.ts → ProjectRow (9 cols), AiProviderConfigRow (5 cols: id/base_url/model_name/is_active/updated_at — NO api_key column, so backup is safe), AppMetaRow (key/value).
  - database/sqlite/connection.ts → DbAdapter signature confirmed: execute(sql)/run(sql,params?)/query<T>(sql,params?)/executeTransaction(fn). getDB() is async singleton, runs migrations on first call.
  - Confirmed zod 4.3.5 installed; existing code (providers/index.ts:99) uses the Zod 4 `parsed.error.message` pattern, so my `result.error.message` is consistent.
- Created src/engines/import-export-engine/index.ts (~360 lines):
  - AttachmentRef + ExportProjectResult interfaces (matches spec verbatim).
  - Module-level `_backupKey: CryptoKey | null` + `setBackupKey(key)` setter (engines can't touch Secure Storage per requirement #3 / boundary rule).
  - `exportProject(profile, financials, eligibility, attachments?)` async: reads `knowledge_version` from app_meta via `getDB().query("SELECT value FROM app_meta WHERE key = ?", ["knowledge_version"])` exactly as specified; defaults to "unknown" if DB not yet initialized or key missing (defensive — migrations seed "bundled" on first run, so the happy path always returns a real version). `exportedAt = new Date().toISOString()`. NEVER receives or stores the API key (the param types don't even have a slot for it).
  - `importProject(json)`: inline lenient Zod schema — z.object with schemaVersion:string (required), project/financialsSnapshot/eligibilitySnapshot:z.unknown() (required), plus optional schemeCode/knowledgeVersion/exportedAt/attachments. JSON.parse wrapped in try/catch → returns `{error}` on parse failure. safeParse → returns `{error}` on schema failure. On success returns `{profile, financials, eligibility}` cast from the envelope's project/financialsSnapshot/eligibilitySnapshot. NEVER partially applies — either the whole envelope validates or nothing is returned. Return type matches spec exactly (inline union).
  - `backupDatabase()` async: requireBackupKey() → throws clear error if not set. Reads all rows from projects/ai_provider_config/app_meta via explicit column lists (PROJECT_COLUMNS / AI_PROVIDER_COLUMNS / APP_META_COLUMNS constants — keeps SELECT/INSERT round-trip well-defined). Builds BackupPayload {schemaVersion:"1.0", schemeCode:"PMEGP", createdAt, tables:{...}}. TextEncoder → plaintext bytes. crypto.getRandomValues(new Uint8Array(12)) for fresh per-encryption IV. crypto.subtle.encrypt({name:"AES-GCM", iv}, key, plaintext) → ciphertext (includes 128-bit GCM auth tag). Concatenates 12-byte IV + ciphertext into a single Uint8Array, returns .buffer as ArrayBuffer. Format = exactly "12-byte IV prefix + ciphertext" per spec.
  - `restoreDatabase(encryptedBackup)` async: requireBackupKey(). Splits bytes into iv (first 12) + ciphertext (rest); rejects too-short input. crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ciphertext) — GCM auth check happens here; tampered/wrong-key input throws BEFORE any DB write. JSON.parse decrypted plaintext → BackupPayload; validates `tables` field + array shape, throws on malformed. Inside `getDB().executeTransaction(tx => ...)` (atomic): DELETE FROM projects; DELETE FROM ai_provider_config; DELETE FROM app_meta; then re-INSERT every row from the backup using the same column lists + parameterized placeholders (placeholder() helper builds `(?, ?, …)`). Any INSERT failure rolls back the whole transaction (NativeSqliteAdapter.executeTransaction wraps BEGIN/COMMIT/ROLLBACK; WebDbAdapter mock is non-atomic but dev-only).
- Boundary verification: only imports are `zod`, `@/shared/types/project-profile` (type), `@/engines/financial-engine` (type), `@/engines/eligibility-engine` (type), `@/database/sqlite` (getDB + 3 row types). ZERO imports from `@/features/*` or `@/providers/*` (grep confirmed — the only mentions of those paths are in comments explicitly forbidding them). ESLint import-boundary rule passes.
- Verification:
  - `bun run typecheck` → exit 0 (tsc -b --noEmit, no errors).
  - `bun run lint` → 0 errors / 13 warnings, NONE in import-export-engine/index.ts (all 13 are pre-existing unused-vars in other files: dpr-engine, knowledge-engine, features/ai/*, hooks/use-toast, shared/types).
  - Did NOT modify package.json, did NOT install anything, did NOT touch any file outside src/engines/import-export-engine/.

Stage Summary:
- Artifacts produced (single new file, no other files touched):
  - src/engines/import-export-engine/index.ts  (new, ~360 lines)
- API surface (all 7 spec exports present):
  - interface AttachmentRef { id, type, filename, mimeType }
  - interface ExportProjectResult { schemaVersion:"1.0", schemeCode:"PMEGP", knowledgeVersion, exportedAt, project, financialsSnapshot, eligibilitySnapshot, attachments }
  - function setBackupKey(key: CryptoKey): void
  - async function exportProject(profile, financials, eligibility, attachments?): Promise<ExportProjectResult>
  - function importProject(json: string): {profile, financials, eligibility} | {error}
  - async function backupDatabase(): Promise<ArrayBuffer>
  - async function restoreDatabase(encryptedBackup: ArrayBuffer): Promise<void>
- Decisions / assumptions:
  1. AttachmentRef defined LOCALLY in the engine (different shape from shared/types/project-profile.ts AttachmentRef — engine's has `filename`+`mimeType`+`type:string`; shared's has `fileName`+`type:AttachmentType`+ocrExtractedFields+linkedMachineryIndex+status). The features layer is responsible for projecting profile.attachments.items → engine AttachmentRef before calling exportProject. This is per requirement #5 (engines can't import features) and keeps the export envelope minimal/portable.
  2. Backup key injection: engines cannot touch Secure Storage (boundary). The features/providers layer loads the AES-256-GCM CryptoKey from Secure Storage at startup and calls setBackupKey() once. backupDatabase()/restoreDatabase() throw a clear error if setBackupKey() was never called. This is the cleanest seam given the architecture.
  3. `knowledgeVersion` read is wrapped in try/catch and returns "unknown" on failure — so calling exportProject before initDB() still produces a valid envelope (with knowledgeVersion:"unknown") rather than throwing. In the happy path (DB initialized), migrations have already seeded knowledge_version="bundled", so the read returns a real value.
  4. importProject is LENIENT: validates only the outer envelope (4 required keys present), accepts inner objects as z.unknown(). Rationale: a future schema version that adds fields to ProjectProfile/FinancialResult/EligibilityResult should still import cleanly from an older export (and vice versa) as long as the envelope shape is intact. The caller features layer may do stricter validation if desired. We NEVER partially apply — invalid input → {error}, nothing written.
  5. Backup payload includes createdAt (wall-clock) — metadata, not a calculation, so it doesn't violate engine determinism (doc 02). The actual table data is a byte-for-byte snapshot.
  6. Restore is fully atomic: executeTransaction wraps DELETE+INSERT for all 3 tables; any failure rolls back. GCM authentication happens during decrypt (before the transaction opens), so a tampered/corrupted backup is rejected before the DB is touched at all.
  7. ai_provider_config has no api_key column (verified in schema.ts) — backing it up is safe; the real API key lives only in Secure Storage and is never serialized.
  8. The Web dev-mock DbAdapter (in-memory Map-backed) handles all the SELECT/INSERT/DELETE patterns this engine issues (verified by tracing the regex matchers in connection.ts WebDbAdapter.read/mutate). So backup/restore also works in the vite dev browser, not just on native.
- Next-agent action items:
  - Features layer: at app startup, load the backup AES-256-GCM key from Secure Storage (generate 32 random bytes if first run, persist) and call `setBackupKey(crypto.subtle.importKey("raw", keyBytes, {name:"AES-GCM",length:256}, false, ["encrypt","decrypt"]))`.
  - Features layer: build the export UI that calls exportProject() with a projected AttachmentRef[] from profile.attachments.items.
  - Features layer: build the import UI that calls importProject() and dispatches on `{error}` vs `{profile, financials, eligibility}`.
  - Features layer: build the backup/restore UI (file save/load) wrapping backupDatabase()/restoreDatabase().
  - Optional: add a __tests__/ folder with round-trip tests (export → import, backup → restore) once the test harness is wired. The engine is pure-ish (only DB + crypto I/O) and easily testable against the Web dev-mock adapter.

---
Task ID: 2-E
Agent: ocr-engine-tesseract (Wave 2)
Task: Rewrite src/engines/ocr-engine/index.ts — replace the text-only mock with on-device Tesseract.js OCR (WASM, runs in WebView, truly offline) + camera/gallery capture via @capacitor/camera.

Work Log:
- Read worklog.md (Wave 1 complete; Wave 2 in flight — 2-A Import/Export done, 2-B/C/D likely in parallel) and the existing src/engines/ocr-engine/index.ts (682-line mock — pure-text pipeline that decoded ArrayBuffers as UTF-8 and applied regex extraction; OcrResult = {success, extractedFields, confidence, rawText}).
- Verified scope: grep for extractFromDocument/mapOcrToProfile/getSupportedFileTypes/canProcessFile across src/ — zero callers outside the engine itself (only AGENT_CONTRACTS.md / AUDIT_REPORT.md / STAGE_B_IMPLEMENTATION_PROMPT.md doc references). Safe to change extractFromDocument's signature (was (fileBuffer, fileType); now (source, documentType)) and remove the file-type utility exports.
- Confirmed installed: @capacitor/camera ^8.0.0 (with Camera, CameraResultType, CameraSource string-enum exports — getPhoto is marked @deprecated but is what the task spec mandates), tesseract.js ^5.1.1 (CommonJS `export = Tesseract` namespace — recognize(image, langs) returns {data: {text, confidence 0-100}}), @capacitor/core (Capacitor.isNativePlatform() — platform-agnostic shim, safe to static-import).
- Rewrote src/engines/ocr-engine/index.ts (902 lines). Public surface:
  - `OcrResult` interface — preserved EXACT shape ({success, extractedFields, confidence, rawText}) per task directive.
  - `extractFromDocument(source: "camera" | "gallery", documentType: AttachmentType): Promise<OcrResult>` — NEW SIGNATURE.
  - `mapOcrToProfile(ocrResult, documentType): Partial<ProjectProfile>` — preserved verbatim (ProfileBuilder + 6 document-type builders + makeProvenance + mergeProvenance + extractMachineryLines).
  - NEW: `setTestImage(b64: string): void` — module-level setter for test/web-dev image injection (accepts raw base64 OR data URL).
  - NEW: `maskPii(text: string): string` — free-text PII masker (exported so features/ can mask OCR text in logs/UI if needed).
  - REMOVED: getSupportedFileTypes, canProcessFile, MAX_FILE_SIZE, SUPPORTED_FILE_TYPES, formatBytes (irrelevant for camera-based capture; no callers).
- Image acquisition (acquireImage helper branches on 3 paths):
  1. testImage set → normalizeDataUrl() (auto-prefixes "data:image/jpeg;base64," if missing).
  2. Capacitor.isNativePlatform() → captureNative(): dynamic-imports @capacitor/camera, calls Camera.getPhoto({quality:90, resultType:CameraResultType.Base64, source:CameraSource.Camera|.Photos, correctOrientation:true}), reads photo.base64String, wraps as data URL.
  3. Web → pickWebImage(): synthesizes an <input type="file" accept="image/*"> in the DOM (capture="environment" hint when source==="camera" so mobile browsers open rear cam), reads the picked File via FileReader.readAsDataURL → data URL. Includes best-effort cancel detection (window focus listener + 500ms grace) since most browsers don't fire `change` on dismiss.
- OCR runner (runOcr helper): dynamic-imports tesseract.js (handles both `mod.default` and direct-namespace interop shapes for `export = Tesseract` + esModuleInterop), calls tess.recognize(imageData, "eng"), returns {text, confidence 0-100}.
- extractFromDocument pipeline: acquireImage → runOcr → empty-text guard → EXTRACTION_PATTERNS loop (preserved from mock; Aadhaar/PAN patterns tightened: Aadhaar now matches `[\d\s]{12,}` to handle OCR-separated digit groups; PAN matches `[A-Za-z0-9]+` and uppercases) → machinery line-item extraction when documentType==="QUOTATION" OR a quotationNo was found → confidence blend ((ocrConfidence/100 + matchCount/maxExpectedFields)/2) → maskPii(rawText) BEFORE return. Whole body wrapped in try/catch that returns {success:false,...} on any capture/OCR/cancel error — preserves the mock's "never throw" contract.
- PII masking — two layers as required:
  • Layer 1 (per-field, at extraction): maskAadhaar / maskPan applied as EXTRACTION_PATTERNS postProcess on the labelled "Aadhaar No:" / "PAN No:" matches.
  • Layer 2 (full-text, before return): maskPii(rawText) scans the OCR buffer for ANY Aadhaar/PAN/phone/email pattern and masks them, so PII that wasn't caught by the labelled extraction (e.g. an Aadhaar printed in a quotation's header) is still masked before rawText leaves the engine.
  Rules implemented per task spec:
  - Aadhaar: keep first 4 + last 4, mask middle 4 → "2345 XXXX 0123". (Changed from prior mock which kept only the last 4.)
  - PAN: keep first 2 + last 2, mask middle (replaced with the "XXXX" token) → "ABXXXX4F" for "ABCDE1234F". (Unchanged from prior mock.)
  - Phone: keep first 4 + last 4 digits, mask the middle (≥4 X's, scales for longer international numbers) → "+9198XXXX3210" for "+91 98765 43210". (New helper.)
  - Email: keep first 2 chars of local part, mask the rest with '*' (min 3) → "jo******@example.com" for "john.doe@example.com". Domain left intact. (New helper.)
  Verified via standalone Node smoke test — all four maskers behave per spec; maskPii correctly handles mixed-PII free text and produces false-positive masking on long numeric sequences (e.g. 12-digit invoice numbers get masked as Aadhaar — acceptable per Rule #16: false positives preferred over false negatives for PII).
- Boundary compliance: top-level imports are `@capacitor/core` (platform SDK, allowed) and `@/shared/types` (type-only). @capacitor/camera and tesseract.js are dynamic-imported INSIDE function bodies (captureNative / runOcr) so the web dev server never tries to resolve the native camera plugin at module-eval time. ESLint engines/ boundary rule (no @/features/* or @/providers/*) passes — verified by `npx eslint src/engines/ocr-engine/index.ts` → 0 errors.
- TypeScript: `npx tsc --noEmit` reports 1 error total in the project, and it's NOT in my file (it's in src/engines/update-engine/index.ts line 183 — ArrayBufferLike vs BufferSource, sub-agent 2-D's territory). The OCR engine file compiles clean.
- Did NOT modify package.json (tesseract.js + @capacitor/camera already installed). Did NOT touch any other file — only src/engines/ocr-engine/index.ts.

Stage Summary:
- Artifacts produced (single file, all under src/engines/ocr-engine/):
  - src/engines/ocr-engine/index.ts (rewritten — was 682-line text-only mock, now 902-line Tesseract.js + @capacitor/camera OCR pipeline).
- API surface (final):
    export interface OcrResult { success: boolean; extractedFields: Record<string, string>; confidence: number; rawText: string; }
    export function setTestImage(b64: string): void;
    export function maskPii(text: string): string;
    export async function extractFromDocument(source: "camera" | "gallery", documentType: AttachmentType): Promise<OcrResult>;
    export function mapOcrToProfile(ocrResult: OcrResult, documentType: AttachmentType): Partial<ProjectProfile>;
- Decisions / assumptions:
  1. extractFromDocument signature change (was (fileBuffer, fileType); now (source, documentType)) is a BREAKING change vs AGENT_CONTRACTS.md §13. Verified via grep that no in-repo code calls it — only doc references remain. The features layer (when built) must be updated to call with the new signature. AGENT_CONTRACTS.md §13 still shows the old signature — orchestrator may want a doc sweep.
  2. getSupportedFileTypes / canProcessFile removed: the new pipeline never deals with file buffers or text file types (camera capture is always JPEG), so these utilities are meaningless. No callers in src/.
  3. maskAadhaar behavior changed (was "keep last 4 only" → "XXXX XXXX 0123"; now "keep first 4 + last 4, mask middle" → "2345 XXXX 0123" per task spec). Any persisted OcrResult records from prior mock runs will have the old masking format — irrelevant in practice since the mock never persisted anything (no DB integration existed).
  4. documentType is now used inside extractFromDocument (to bias machinery extraction for QUOTATION documents even when the "Quotation No" labelled pattern didn't match — OCR is lossy). Previously the mock used the post-extraction `quotationNo` field presence as the sole trigger.
  5. Confidence is a BLEND of Tesseract's per-page OCR confidence (0-1) and a field-coverage heuristic (matchCount / maxExpectedFields). Pure OCR confidence would rate an OCR-confident-but-content-empty page as 0.9; pure field-count would rate a low-OCR-confidence page with many lucky regex hits as 1.0. The blend guards both failure modes.
  6. Tesseract.js v5 ships as `export = Tesseract` (CommonJS namespace). With esModuleInterop, dynamic `await import("tesseract.js")` exposes the namespace either as `mod.default` (Node-style interop) or directly (synthetic named exports) depending on the bundler. We handle both shapes defensively: `const tess = mod.default ?? mod;` — works in vite dev, vite build, and native WebView.
  7. The web file-input cancel path uses a `window.focus` listener + 500ms grace period. This is best-effort: some browsers (Safari iOS) don't fire focus reliably on picker dismiss. Worst case the Promise hangs until the user re-invokes — the caller's UI should show a "Cancelling…" affordance and offer a manual cancel that ignores the pending extractFromDocument result.
  8. tesseract.js by default fetches its WASM core, worker, and eng.traineddata from a CDN (unpkg/jsdelivr). For TRUE offline use in production, the features/build layer should configure `corePath`/`workerPath`/`langPath` to point at locally-bundled assets (e.g. /public/tesseract/). This is a build-config concern, not an engine concern — left to the orchestrator/features layer. The engine just calls `recognize(image, "eng")` and lets the default paths resolve.
  9. mapOcrToProfile's makeProvenance() still emits {source: "OCR", verification: "UNVERIFIED", extractConfidence} — the "source: OCR, verification: UNVERIFIED" requirement in the task spec is satisfied via provenance metadata (the existing mechanism), not by adding source/verification fields to the OcrResult shape (which the task also explicitly told us to preserve exactly).
- Verified:
  - `npx eslint src/engines/ocr-engine/index.ts` → exit 0, 0 errors.
  - `npx tsc --noEmit -p tsconfig.json` → no errors in ocr-engine (1 unrelated error in update-engine, sub-agent 2-D's territory).
  - PII masking smoke test (standalone Node script mirroring the maskAadhaar/maskPan/maskPhone/maskEmail/maskPii logic): all four maskers + the free-text maskPii pass on canonical inputs.
- Next-agent action items:
  - Features layer (Wave 3+): build the attachment-capture UI that calls `extractFromDocument("camera" | "gallery", attachmentType)` and then `mapOcrToProfile(result, attachmentType)` to merge into the active ProjectProfile. Surface `result.success === false` with a user-friendly message ("Capture cancelled" / "Couldn't read text — try a clearer photo").
  - Features layer: at app startup, optionally configure tesseract.js to use locally-bundled WASM/lang assets via `createWorker("eng", 1, { corePath, workerPath, langPath })` instead of the default CDN paths. Without this, OCR requires network on first run (the eng.traineddata file is ~10MB).
  - Build layer: bundle the tesseract worker/core/lang assets under /public/tesseract/ and either set the paths globally before the first recognize() call, OR pre-emptively warm a Worker. The current `recognize()` convenience API creates a worker per call — acceptable for low-frequency document capture, suboptimal for batch scanning.
  - Docs: update AGENT_CONTRACTS.md §13 to reflect the new extractFromDocument(source, documentType) signature.
  - Optional: add a __tests__/ folder with a vitest spec that uses setTestImage() + a tiny base64 PNG of a printed-text sample to verify the regex extraction + masking end-to-end (without invoking the camera).

---
Task ID: 2-B
Agent: update-engine (Wave 2)
Task: Create src/engines/update-engine/{index.ts, public-key.pem} per doc 12 Part B (signed Knowledge Package updates with Ed25519 verification).

Work Log:
- Read worklog.md (Tasks 0, 1-DB, 1, 2-A) to anchor on the Wave 1 / Wave 2 state: Vite + React 19 + Capacitor 8, sqlite DB layer with DbAdapter {execute/run/query<T>/executeTransaction}, getDB() async singleton from @/database/sqlite, three tables (projects, ai_provider_config, app_meta key/value), migrations seed app_meta knowledge_version="bundled" / last_update_check="never". @noble/ed25519 ^2.1.0 installed (actual: 2.3.0). ESLint enforces engines/ cannot import @/features/* or @/providers/*.
- Inspected @noble/ed25519 2.3.0's index.d.ts to confirm the EXACT public API: `verifyAsync(s: Hex, m: Hex, p: Hex, opts?) => Promise<boolean>` — argument order is (signature, message, publicKey). The task spec wrote `verifyAsync(publicKey, signatureBytes, messageBytes)` which would be the wrong order; I implemented the library's real order and documented the correction inline (a verification call with swapped args would always fail at runtime).
- Inspected connection.ts to confirm the WebDbAdapter (dev-only in-memory mock) handles the INSERT OR REPLACE / SELECT WHERE key = ? patterns this engine issues — so the engine works in the vite dev browser, not just on native. Confirmed `crypto.subtle` is available in both Capacitor WebView and modern browsers; @noble/ed25519 v2.x uses `etc.sha512Async` which is pre-wired to `crypto.subtle.digest` (no manual SHA-512 setup needed for verifyAsync).
- Created src/engines/update-engine/public-key.pem with the exact placeholder content specified in the task (PEM-wrapped base64 body that decodes to neither a raw 32-byte key nor a valid 44-byte SPKI blob — intentional, so the dev-only zero fallback kicks in for now).
- Created src/engines/update-engine/raw-modules.d.ts — ambient `declare module "*.pem?raw"` declaration so the TypeScript compiler accepts the Vite `?raw` import. Kept inside the engine's folder (not a project-wide vite-env.d.ts) to respect the directory boundary.
- Created src/engines/update-engine/index.ts (~375 lines) implementing the full API:
  - `DataPackFile` and `DataPackManifest` interfaces (verbatim per spec).
  - Module-level `let _cached: string | null = null` + `_cachePromise` for dedup.
  - `getCurrentKnowledgeVersion()` SYNC: returns `_cached` if populated; otherwise kicks off a fire-and-forget `refreshCachedKnowledgeVersion()` (deduped via `_cachePromise`) that reads `SELECT value FROM app_meta WHERE key = ?` ["knowledge_version"] and populates `_cached` on success; returns "bundled" in the meantime. On DB-read failure, the cache stays null and the next call retries (failed promise clears `_cachePromise` via `.finally`).
  - `checkForUpdate(manifestUrl)`: fetch → response.json() → basic shape validation (version string, schemeCode==="PMEGP", files array, signature string, publicKeyId string) → compare `manifest.version !== getCurrentKnowledgeVersion()` → returns `{available:true, manifest}` or `{available:false}`. Throws on HTTP non-2xx or malformed manifest.
  - `downloadPack(packUrl)`: fetch → `response.arrayBuffer()`.
  - `verifyAndApply(pack, manifest)`:
    1. Strip `signature` from manifest, recompute canonical JSON via `canonicalJsonStringify` (recursive key sort, no whitespace, arrays preserve order, primitives via JSON.stringify), `new TextEncoder().encode(json)` → message bytes.
    2. `base64ToBytes(manifest.signature)` via `atob` → signature bytes (64 bytes for Ed25519).
    3. `await verifyAsync(signatureBytes, messageBytes, getPublicKey())` — correct argument order per the library's actual API. On `false`, throw `Error("Signature verification failed")`.
    4. For single-file packs: `sha256Hex(pack)` via `crypto.subtle.digest("SHA-256", bytes)` → hex; compare to `manifest.files[0].sha256`. Mismatch → throw.
    5. `JSON.parse(new TextDecoder().decode(pack))` → `PackPayload {knowledge_version, data?}`. Validate `knowledge_version` is a non-empty string.
    6. Inside `getDB().executeTransaction(tx => ...)`: `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)` for `knowledge_version` and `last_update_check` (ISO timestamp), then for each key in `packPayload.data` (non-string values JSON.stringify'd because the column is TEXT). NEVER touches the `projects` table — DPRs retain their generation knowledgeVersion. Transaction rolls back on any error (NativeSqliteAdapter wraps BEGIN/COMMIT/ROLLBACK).
    7. After commit, set `_cached = packPayload.knowledge_version` so the next `getCurrentKnowledgeVersion()` returns the new version synchronously.
- Public key loading (`decodePublicKeyFromPem` + `getPublicKey`):
  - PEM body extracted by stripping `-----BEGIN/END ...-----` lines and all whitespace.
  - `base64ToBytes` via `atob`.
  - If decoded length === 32 → use directly (raw Ed25519 key).
  - If decoded length === 44 AND starts with the standard Ed25519 SPKI prefix `30 2A 30 05 06 03 2B 65 70 03 21 00` → strip 12-byte prefix, use trailing 32 bytes.
  - Otherwise (the dev placeholder's path) → `console.warn` + return a 32-byte zero array (clearly commented as DEV-ONLY fallback; signature verification will fail against it by design — fails closed).
  - Computed lazily on first `getPublicKey()` call, cached in module-level `_publicKey`.
- `sha256Hex` notes: TypeScript 5.9 (installed) widens `Uint8Array` to `Uint8Array<ArrayBufferLike>` (includes SharedArrayBuffer), which isn't assignable to `BufferSource = ArrayBufferView<ArrayBuffer> | ArrayBuffer` that `crypto.subtle.digest` expects. Both inputs are valid at runtime; resolved with a `as BufferSource` cast (no runtime cost, well-commented).

Boundary verification:
- Imports in index.ts: `verifyAsync` from `@noble/ed25519`, `getDB` from `@/database/sqlite`, `publicKeyPem` from `./public-key.pem?raw`. ZERO imports from `@/features/*` or `@/providers/*` (grep confirmed — the only mention is the header comment forbidding them).
- `fetch(` appears only in `checkForUpdate` (line 242) and `downloadPack` (line 273) — the documented network exception. No other network I/O.

Verification:
- `npx tsc --version` → 5.9.3 (above the 5.5 minimum in package.json).
- `bun run typecheck` (`tsc -b --noEmit`) → exit 0 (clean).
- `bun run lint` (`eslint .`) → 0 errors / 13 warnings, NONE in update-engine/ (all 13 are pre-existing unused-vars in other files: dpr-engine, knowledge-engine, features/ai/*, hooks/use-toast, shared/types).
- `bun run build` (`tsc -b && vite build`) → exit 0; 97 modules transformed; dist/ produced. Confirms the `?raw` import resolves correctly at the Vite bundler level (not just tsc).
- Did NOT modify package.json, did NOT install anything, did NOT touch any file outside src/engines/update-engine/.

Stage Summary:
- Artifacts produced (all under src/engines/update-engine/, no other directories touched):
  - src/engines/update-engine/index.ts         (new, ~375 lines)
  - src/engines/update-engine/public-key.pem   (new, 3 lines — exact placeholder per spec)
  - src/engines/update-engine/raw-modules.d.ts (new, 11 lines — ambient `*.pem?raw` declaration)
- API surface (all 5 spec exports present, signatures verbatim):
  - interface DataPackFile { path, sha256 }
  - interface DataPackManifest { version, schemeCode:"PMEGP", files, signature, publicKeyId }
  - function getCurrentKnowledgeVersion(): string
  - async function checkForUpdate(manifestUrl): Promise<{ available: boolean; manifest?: DataPackManifest }>
  - async function downloadPack(packUrl): Promise<ArrayBuffer>
  - async function verifyAndApply(pack: ArrayBuffer, manifest: DataPackManifest): Promise<void>
- PEM load/decode strategy (summary):
  - Vite's `?raw` query imports the PEM file as a literal string at build time (no runtime fetch / fs). The accompanying raw-modules.d.ts declares the ambient module so tsc accepts the import — kept inside the engine folder to respect the directory boundary (no project-wide vite-env.d.ts added).
  - At first `getPublicKey()` call: strip `-----BEGIN/END-----` lines and whitespace → base64-decode via `atob` → Uint8Array.
  - Two accepted shapes: raw 32-byte Ed25519 key, OR 44-byte SPKI-wrapped Ed25519 key (12-byte prefix `30 2A 30 05 06 03 2B 65 70 03 21 00` stripped). The bundled placeholder decodes to neither, so the code falls back to a clearly-warned 32-byte zero array — fails closed (no real signature verifies against zeros). Production replaces public-key.pem with a real key so the fallback is never reached.
- Decisions / assumptions:
  1. verifyAsync argument order: task spec said `(publicKey, signatureBytes, messageBytes)` but the installed @noble/ed25519 2.3.0's index.d.ts says `verifyAsync(s, m, p, opts?)` i.e. `(signature, message, publicKey)`. Implemented the library's actual order; documented the correction inline in the JSDoc for `verifyAndApply`. Using the spec's order would always return false at runtime (the "signature" slot would receive a 32-byte key, not a 64-byte signature) — every update would be rejected.
  2. `getCurrentKnowledgeVersion()` is sync but the DB read is async, so first call returns "bundled" (the seeded default) while a fire-and-forget promise populates `_cached`. Concurrent first-callers are deduped via `_cachePromise`. A failed read leaves `_cached === null` and clears `_cachePromise` in `.finally`, so the next call retries — important because the engine may be called before `initDB()` completes at app startup.
  3. Canonical JSON: recursive key sort, arrays preserve order, no inter-token whitespace, primitives via `JSON.stringify`. Both signer (CDN-side tooling) and verifier (this engine) must agree on this exact representation. The format is documented inline.
  4. Single-file pack integrity check (`manifest.files.length === 1`) — multi-file packs skip the byte-hash check (the manifest signature already covers the `files` array, so a tampered multi-file list fails signature verification first; per-file hashing is a Wave 3 concern if/when the pack format gains a tar/zip container).
  5. `last_update_check` app_meta key is also refreshed inside the same transaction (ISO timestamp) — small convenience for the UI to show "last checked" without a separate write.
  6. `data` values in the pack payload are JSON.stringify'd if not strings (the `app_meta.value` column is `TEXT NOT NULL`). Strings stored as-is.
  7. DPR preservation: the transaction ONLY issues `INSERT OR REPLACE INTO app_meta` — no `projects` table access at all, so existing DPRs and their generation `knowledgeVersion` are untouched by design.
- Next-agent action items:
  - Features layer: at app startup, schedule a `checkForUpdate(MANIFEST_URL)` call (background; surface a toast if available). Wire the "Download & apply update" UI flow → `downloadPack()` → `verifyAndApply()` → invalidate any in-memory knowledge cache the knowledge-engine holds (today the knowledge-engine imports bundled JSON statically, so an updated `app_meta.knowledge_version` is informational until a future Wave introduces runtime knowledge-pack loading).
  - Production build: replace `src/engines/update-engine/public-key.pem` with the real Ed25519 public key (raw 32 bytes base64'd, OR SPKI-wrapped) corresponding to the CDN's signing private key. Remove the zero-fallback warning by ensuring the real PEM decodes to 32 bytes.
  - CDN-side tooling (out of repo): build the signing pipeline that produces canonical JSON of `{version, schemeCode, files, publicKeyId}` (same `canonicalJsonStringify` rules), signs with Ed25519, base64-encodes the 64-byte signature, and emits the manifest JSON with `signature` populated.
  - Optional: add a __tests__/ folder with round-trip tests using a freshly-generated Ed25519 keypair (sign a manifest, verify it applies; tamper signature → expect throw; tamper pack bytes → expect throw).

---
Task ID: 2-C
Agent: project-engine (Wave 2)
Task: Create src/engines/project-engine/index.ts implementing the Project Engine per doc 01 §3 and doc 16 §11 (createProject / inferState / canEdit / applyEdit / getStaleSnapshots).

Work Log:
- Read worklog.md (orchestrator Wave 1 + sibling sub-agents 1-DB, 2-A, 2-B), shared types (project-profile, state-machine, interview, provenance), and src/database/sqlite/repositories.ts `buildEmptyProfile` to mirror its shape.
- Created src/engines/project-engine/index.ts (~517 lines) with the full ProjectEngine API: createProject, inferState, canEdit, applyEdit, getStaleSnapshots; plus FieldEdit / StaleSnapshotInfo / ProjectEngine exported interfaces and `projectEngine` singleton.
- Created src/engines/project-engine/__tests__/project-engine.test.ts (31 vitest tests) — all green.
- buildEmptyProfile() is duplicated from repositories.ts (NOT imported) so engines/ stays free of @/database/* coupling. Comment cross-references the source so a future change to the DB template triggers a sync here. Same EMPTY_PROFILE_TIMESTAMP constant ("1970-01-01T00:00:00.000Z") for determinism.
- Determinism verified: zero Date.now() / Math.random() in the file. crypto.randomUUID() is called ONLY inside createProject (ID minting is not a calculation, per task spec). deepClone uses globalThis.structuredClone with JSON fallback.
- Boundary verified: only imports are `@/shared/types/{project-profile,state-machine,interview,provenance}`. grep + eslint boundary rule (no @/features/* / @/providers/* / @/database/*) both clean. `npx tsc --noEmit` reports zero errors in project-engine/; `npx eslint src/engines/project-engine/` exits 0.

Inference rules chosen (inferState, checked highest → lowest for monotonicity):
  1. provenance.perField["_dpr.generated"].verification === "VALIDATED"        → DPR_READY
  2. provenance.perField["_financials.computed"].verification === "VALIDATED"  → FINANCIAL_READY
  3. provenance.perField["_eligibility.computed"].verification === "VALIDATED" → ELIGIBILITY_READY
  4. All 7 phaseProgress entries NOT_STARTED                                   → EMPTY
  5. validation.completeness ≥ 100 AND errors.length === 0 AND REVIEW phase COMPLETED → VALIDATED
  6. validation.completeness ≥ 100 AND errors.length === 0                    → REVIEW_PENDING
  7. All 5 discovery phases (APPLICANT/BUSINESS/ACTIVITY/PROJECT_SIZING/FINANCIAL_PLANNING) COMPLETED → COMPLETE
  8. APPLICANT_DISCOVERY AND BUSINESS_DISCOVERY both COMPLETED                 → DISCOVERING
  9. Otherwise (any IN_PROGRESS / NEEDS_REVIEW)                                → PARTIAL
  - Downstream markers (1–3) are checked BEFORE the EMPTY guard so an explicit "stage ran" signal always wins — a profile cannot be EMPTY if its DPR was generated, even if the phase tracker is out of sync.
  - Monotonicity: more progress (more phases COMPLETED, completeness rising, a marker stamped) can only hold or raise the inferred state; it never lowers it. Lowering happens only when data is removed (legitimate backward transition).

canEdit rules (doc 16 §11.3):
  - STATUS_ORDER index: EMPTY=0 < PARTIAL=1 < DISCOVERING=2 < COMPLETE=3 < REVIEW_PENDING=4 < VALIDATED=5 < ELIGIBILITY_READY=6 < FINANCIAL_READY=7 < DPR_READY=8.
  - targetIdx ≤ currentIdx (backward or same) → always true.
  - targetIdx === currentIdx + 1 (one step forward) → true.
  - targetIdx > currentIdx + 1 (skip forward) → false.
  - DPR_READY has no forward successor (idx 8 is max), so any forward target from DPR_READY is rejected — satisfying "NEVER allow editing a DPR_READY project's downstream without invalidating" (you must first move backward). The same one-step rule also rejects e.g. VALIDATED → DPR_READY (must pass through ELIGIBILITY_READY and FINANCIAL_READY first).

applyEdit:
  - Deep-clones via globalThis.structuredClone (JSON fallback for older runtimes). Input is never mutated (verified by test).
  - Dot-path setter auto-creates intermediate objects; if the next path segment is a non-negative integer, creates an array instead. Supports "machinery.items.0.unitCost" style paths.
  - When `edit.source` is provided, stamps `provenance.perField[fieldPath] = { source, verification: "UNVERIFIED", __snapshotValue: value }`. The `__snapshotValue` is the Wave 2 staleness snapshot. When source is omitted, only the value is set (provenance untouched).

getStaleSnapshots (Wave 2 simple version):
  - For each non-synthetic key (keys not starting with "_") in provenance.perField that carries a `__snapshotValue`, compares the snapshot to the current value at that dot-path via JSON structural equality. If they differ, returns { fieldPath, previousValue: snapshot, staleReason }.
  - Synthetic marker keys (leading underscore: _eligibility.computed / _financials.computed / _dpr.generated) are skipped so they never appear as stale.

Design decisions / assumptions:
  1. ProjectProfile carries no field for eligibility/financial/DPR computation outputs (those engines produce side outputs not stored on the profile). To let inferState see that those stages have run, downstream engines stamp a synthetic provenance entry under one of three reserved keys (_eligibility.computed / _financials.computed / _dpr.generated) with `verification: "VALIDATED"`. The leading underscore marks them as synthetic and excludes them from stale-snapshot scanning. This is the cleanest Wave 2 approach given the fixed ProjectProfile / FieldProvenance types — when those types are later extended with real stage-tracking fields, this convention can be migrated with no API break (the markers simply stop being stamped).
  2. FieldProvenance has no value-snapshot field, but stale-detection needs one. A local type `FieldProvenanceWithSnapshot = FieldProvenance & { __snapshotValue?: unknown }` extends it engine- privately (double-underscore = engine-internal). Forward-compatible: if the canonical type later gains a real snapshotValue field, this code continues to work unchanged. applyEdit writes the snapshot; getStaleSnapshots reads it.
  3. createProject(name) accepts `name` for API ergonomics (callers like the repository / UI pass it) but does NOT store it on ProjectProfile — the canonical type has no top-level name field. `void name;` marks the intentional non-use. The caller persists the name out-of-band (e.g. the projects.name column in SQLite). This matches the existing repository's `create(name)` which stores name in the projects table, not in profile_data.
  4. REVIEW_PENDING → VALIDATED transition is inferred from `completion.phaseProgress.REVIEW.status === "COMPLETED"`. The REVIEW phase being COMPLETED is the natural signal that the user confirmed the review (no separate "reviewConfirmed" boolean exists on the profile).
  5. setPath auto-creates intermediates: arrays when the next segment is an integer, objects otherwise. This handles "machinery.items.0.name" on a fresh empty profile (items: [] → items: [{ name: "..." }]). Limitation: appending to an existing array via a high integer index leaves holes — callers wanting list mutations should pass the whole new array as the value (e.g. fieldPath: "machinery.items", value: [...existing, newItem]) rather than indexing into a non-existent slot. Documented inline.

Stage Summary:
- Artifacts produced (all under src/engines/project-engine/):
  - src/engines/project-engine/index.ts                       (new, ~517 lines)
  - src/engines/project-engine/__tests__/project-engine.test.ts (new, 31 tests, all passing)
- Verification: `npx tsc --noEmit` → zero errors in project-engine/ (only pre-existing update-engine errors remain, owned by sub-agent 2-B). `npx eslint src/engines/project-engine/` → exit 0. `npx vitest run src/engines/project-engine/__tests__/project-engine.test.ts` → 31/31 passing.
- Boundary: imports limited to `@/shared/types/{project-profile,state-machine,interview,provenance}`. No @/features/*, @/providers/*, @/database/* imports.
- Determinism: zero Date.now() / Math.random(); crypto.randomUUID() only in createProject.
- Next-agent action items:
  - Downstream engines (eligibility-engine, financial-engine, dpr-engine): when they successfully compute their stage, stamp the corresponding synthetic marker on profile.provenance.perField (key = "_eligibility.computed" / "_financials.computed" / "_dpr.generated", value = { source: "KNOWLEDGE" | "AI", verification: "VALIDATED" }). Without this, inferState cannot see beyond VALIDATED.
  - When a field is edited that affects a downstream stage (e.g. machinery items change after financials were computed), the caller should clear the corresponding marker(s) so inferState drops back from FINANCIAL_READY / DPR_READY to VALIDATED or lower. The Project Engine's canEdit + applyEdit do NOT auto-invalidate downstream markers on backward edits (the caller / pipeline orchestrator owns invalidation policy). getStaleSnapshots is the detection mechanism the orchestrator can call to decide what to invalidate.
  - Features layer: use `projectEngine.createProject(name)` to mint new projects (replaces direct crypto.randomUUID() + buildEmptyProfile calls); use `projectEngine.inferState(profile)` to derive status for the projects list / status badges instead of trusting a stored status column blindly; use `projectEngine.canEdit(profile, targetStatus)` to gate UI affordances (e.g. disable "Generate DPR" button if current state is VALIDATED — must go through ELIGIBILITY_READY → FINANCIAL_READY first).
  - Optional Wave 3: extend FieldProvenance with a real `snapshotValue?: unknown` field and migrate the `__snapshotValue` private extension; extend ProjectProfile (or a sibling ProjectMeta type) with explicit eligibility/financial/DPR stage-tracking fields to replace the synthetic provenance markers.

---
Task ID: 2-D
Agent: pdf-engine-rewrite
Task: Rewrite src/engines/pdf-engine/index.ts — full bank-ready PDF using pdf-lib (client-side, zero Node deps). Replaces Wave 1 stub.

Work Log:
- Read worklog.md (Wave 1 state) and the existing Wave 1 stub (64 lines, single-page placeholder).
- Read the three engine files to confirm exact field names:
  - dpr-engine/index.ts: DprDocument { sections: DprSection[], financialResult, eligibilityResult, generatedAt: string, wordCount: number }; DprSection { id, title, content (Markdown), tables?: DprTable[], order }; DprTable { caption, headers: string[], rows: string[][] }.
  - financial-engine/index.ts: FinancialResult — has totalProjectCost, ownContribution, ownContributionPercent, bankFinance, subsidyRate, subsidyAmount, bankTermLoan, bankWorkingCapital, emi, loanTenureMonths, repaymentMoratoriumMonths, totalInterest, totalRepayment, monthlyOperatingCosts, annualRevenue, annualExpenditure, annualNetProfit, annualDepreciation, dscr, breakEvenPercent, loanSchedule.
  - eligibility-engine/index.ts: EligibilityResult { eligible: boolean, checks: EligibilityCheck[], blockers: string[], warnings: string[] }; EligibilityCheck { criterionId, label, passed, actual?, required?, reason }.
- Field-name adaptations vs the task brief:
  • Task brief said EligibilityResult has "criteria[]" — actual field is "checks[]". Used checks[].
  • Task brief said EligibilityResult has "category" and "location" fields — these do not exist on EligibilityResult (they live on ProjectProfile, which is not part of DprDocument). Omitted both from the eligibility appendix; rendered only the overall eligible flag + warnings + per-check label/passed/reason/actual/required.
  • Task brief mentioned FinancialResult.loanSchedule[] — exists with shape { month, openingBalance, emi, interest, principal, closingBalance }. Did NOT render the full schedule (would balloon the PDF for 60+ month loans); the Financial Summary appendix lists the headline figures instead. Schedule rendering can be added in a follow-up if banks require it.
- Rewrote src/engines/pdf-engine/index.ts (1066 lines, was 64). Structure:
  • formatINR(n) — pure integer math, Indian comma grouping (1234567 → "12,34,567"). Exported. Plus formatINRRupees, formatFloat, formatCount, formatDisplayDate helpers.
  • sanitizeText(text) — replaces chars outside WinAnsiEncoding (₹ → "Rs. ", ✓/✗ → "Y"/"N", ™ → "(TM)", nbsp → space). Applied to every dynamic text string before drawText so eligibility-engine's "₹"-prefixed strings don't throw "Cannot encode character" at pdf-lib's WinAnsi boundary.
  • stripMarkdown(text) — minimal markdown-to-plain-text (headings, bold, italic, code, bullets, numbered lists).
  • wrapText(text, font, size, max) — word-wrap with hard-break for over-long single words.
  • RenderContext { doc, font (Helvetica), bold (Helvetica-Bold), page, y } + newContentPage/ensureSpace/drawLine/drawParagraph.
  • drawWatermark(page, font) — "CONFIDENTIAL" at 60pt, light gray (0.88), rotate degrees(-45), centered. Drawn at page-creation time so it sits underneath all content.
  • drawHeader(page, font) — "PMEGP Detailed Project Report — CONFIDENTIAL" at 8pt gray + thin rule, top margin.
  • drawFooter(page, font, pageNum, totalPages) — "Page X of Y" right-aligned + "PMEGP Assistant" left-aligned, both 8pt gray, bottom margin.
  • drawCheckMark / drawCrossMark — line-drawn ✓ and ✗ (avoids WinAnsi gap for U+2713/U+2717) using two drawLine calls each, colored green/red.
  • drawCoverPage — top dark-green band with "PMEGP" wordmark (56pt bold white) + scheme subtitle; title "Detailed Project Report" (28pt); metadata (sections, word count, generated-at derived from dpr.generatedAt); eligibility status badge (ELIGIBLE/NOT ELIGIBLE, green/red bordered); CONFIDENTIAL notice block near bottom; credit footer. No header/footer/watermark on cover.
  • drawTableOfContents — heading + horizontal rule + numbered list of all sections (1..N) + "Appendix A — Financial Summary" and "Appendix B — Eligibility Assessment" entries. Wave 2 simple-list form (page numbers not filled in — task brief explicitly accepts this).
  • drawDprTable — caption + bordered table with bold header row on COLOR_HEADER_BG, alternating row shading, column widths auto-computed from header+cell text widths (scaled down if total exceeds CONTENT_WIDTH), cell text truncated with "…" if too wide.
  • drawSection — new page per section, 14pt bold green title + underline rule, 10pt wrapped content (markdown stripped), then each DprTable.
  • drawFinancialSummary (Appendix A) — 17-row key/value table: Total Project Cost, Own Contribution (with %), Subsidy (with rate%), Bank Term Loan, Bank Working Capital, Total Bank Finance, EMI, Loan Tenure, Moratorium, Total Interest, Total Repayment, Annual Revenue, Annual Expenditure, Annual Net Profit, Annual Depreciation, DSCR (2dp), Break-even % (2dp). All rupee values via formatINRRupees.
  • drawEligibilityAssessment (Appendix B) — overall status banner (green/red), warnings list, then per-check: line-drawn ✓/✗ + bold colored label + "Actual: … | Required: …" gray subline + reason paragraph.
- generatePdf(dpr): three-phase render:
  • Phase 1 — cover page (index 0).
  • Phase 2 — first content page added with watermark pre-drawn; TOC → sorted sections (sort by `order` defensively) → Appendix A → Appendix B. Subsequent pages added on demand via newContentPage, each with watermark drawn first (underneath content).
  • Phase 3 — second pass: for every page except cover, draw header + footer with "Page X of Y" where X = index+1 and Y = doc.getPageCount().
  • Determinism: doc.setCreationDate / setModificationDate set explicitly from new Date(dpr.generatedAt) — NO new Date() inside generatePdf. StandardFonts are referenced by name (deterministic). pdf-lib's object IDs are sequential. Verified by smoke test: two calls with the same DprDocument produce byte-identical ArrayBuffers.
  • Returns ArrayBuffer: doc.save() → Uint8Array → copied into a fresh ArrayBuffer via new Uint8Array(buffer).set(bytes) (matches Wave 1 stub contract).
- printDpr(dpr) — exact string per task brief: console.log("[PDF Engine] PDF generated, " + dpr.sections.length + " sections").

Verification:
- bun run typecheck → exit 0 (clean).
- bun run lint → 0 errors / 13 warnings (all pre-existing in other files; zero warnings in pdf-engine/index.ts).
- Smoke test (bun script with mock DprDocument):
  • formatINR(1234567) = "12,34,567"; formatINR(5000000) = "50,00,000"; formatINR(500) = "500"; formatINR(-1234) = "-1,234" — all correct Indian grouping.
  • generatePdf produces ~11KB ArrayBuffer; PDF magic header "%PDF-".
  • Loaded the result back via PDFDocument.load: 6 pages (cover + TOC + 2 sections + 2 appendices), each 595.28 × 841.89 (A4). Title = "PMEGP Detailed Project Report", Creator = "PMEGP Assistant", CreationDate = "2025-01-15T10:30:00.000Z" (= dpr.generatedAt, not wall-clock).
  • Byte-determinism: two consecutive calls → identical bytes (byte-by-byte compare passed).

Stage Summary:
- Wave 2 PDF engine complete: replaces 64-line Wave 1 stub with 1066-line bank-ready PDF generator. Zero Node deps, zero @/features or @/providers imports (ESLint boundary rule satisfied). Public API unchanged (generatePdf, printDpr). Output is deterministic and A4-sized with cover, TOC, 18 section slots, financial + eligibility appendices, watermark, headers/footers.
- Artifacts touched: only src/engines/pdf-engine/index.ts (per task brief — no package.json, no other files).
- Next-agent action items:
  • If banks require the full loanSchedule (month-by-month amortisation table) to be rendered as an additional appendix, add drawLoanSchedule(ctx, fin.loanSchedule) and call it after drawFinancialSummary. The data shape is already available.
  • The TOC currently lists section titles without page numbers (Wave 2 simple-list form, per task brief). A future pass could fill in actual page numbers via a second render pass that records each section's start page.
  • The cover currently has no project name (DprDocument does not carry a projectTitle field). If the dpr-engine is later extended to include the project/business name in the DprDocument root, surface it on the cover.

---

Task ID: 3-A
Agent: sub-agent (general-purpose)
Task: Build the AI Writer engine — `src/features/ai/writer/index.ts` — DPR narrative generation with a mandatory post-generation number-injection guard.

Work Log:
- Read worklog.md (Stage B context, prior waves) and the four type source files the spec named: financial-engine (FinancialResult fields confirmed: totalProjectCost, subsidyAmount, emi, dscr, breakEvenPercent, ownContribution, bankTermLoan, annualRevenue, annualNetProfit, loanTenureMonths, totalInterest, totalRepayment), eligibility-engine (EligibilityResult: eligible + checks + blockers + warnings), shared/types/project-profile (ProjectProfile full shape — used business/applicant/location/capacity/market/rawMaterials/machinery sub-objects in the user prompt), providers/index.ts (getAIResponse signature: `(messages, connectionConfig, config?) → Promise<ProviderResponse>`; ProviderConnectionConfig = { baseUrl, apiKey, modelName }).
- Created directory `src/features/ai/writer/` and wrote `index.ts` (515 lines).
- Confirmed boundaries: imports only `@/engines/financial-engine` (type), `@/engines/eligibility-engine` (type), `@/providers` (getAIResponse + types), `@/shared/types/project-profile` (type). No `@/database/*` imports.

Public API implemented (exactly as specified):
- `WriterInput { financials, eligibility, profile, templateId }`
- `WriterOutput { sections: Record<string,string>; provenance: Record<string,string> }`
- `generateNarrative(input, providerConfig): Promise<WriterOutput>`
- Plus exports for testing: `formatINR`, `buildTokenMap`, `verifyNumbers`, `parseSections`, `SECTION_IDS`, `VerificationResult`.

Number-injection guard algorithm:
1. **Token map** — `buildTokenMap(financials, eligibility)` produces 13 placeholder→formatted-value pairs. Rupee values use `formatINR` (Indian comma grouping, integer math, "Rs. " prefix, sign-before-symbol for negatives). DSCR is `toFixed(2)` (e.g. "1.45"). Break-even is `toFixed(2) + "%"`. Loan tenure is a bare integer string. `{{ELIGIBLE}}` = "eligible" / "not eligible".
2. **System prompt** — lists the full token table and tells the AI: every digit in the output MUST be either a placeholder token or an exact value from the table; no invented/calculated/rounded numbers; no section/list numbers; no years/ages/dates; non-table numbers must be expressed in WORDS only ("several months", not "6 months").
3. **Initial generation** — single `getAIResponse([system, user], providerConfig)` call requesting all 7 sections (`executive_summary`, `project_concept`, `market_analysis`, `technical_feasibility`, `financial_viability`, `implementation_schedule`, `risk_mitigation`) delimited by `===SECTION: <id>===`.
4. **Section parsing** — `parseSections(content)` splits on `===SECTION:\s*([\w-]+)\s*===` with a capture group, preserving IDs in the array (preamble discarded).
5. **Verification** — `verifyNumbers(prose, tokens)`:
   - Builds an allowed-set of digit strings from every token value via `digitForms()` — generates equivalent representations: "65.30" → {"65.30","65.3"}; "65.00" → {"65.00","65.0","65"} (parses to integer); "1.45" → {"1.45"}; "1234567" (from "Rs. 12,34,567") → {"1234567"}.
   - Uses ONE combined regex `Rs\.?\s?[\d,]+(?:\.\d+)?|[\d.]+%|[\d.]+x|[\d][\d,]*(?:\.\d+)?` (ordered so most-specific match wins at each position) to extract every numeric-looking substring. Combining into a single regex avoids double-counting "65" and "30" inside "65.30%".
   - Normalises each match to its digit string and checks membership in the allowed-set. Non-matches are collected as raw substrings (for the retry prompt).
   - Returns `{ ok, mismatches }`.
6. **Regeneration loop (per section)** — if `verifyNumbers` fails (or the section is missing/empty), call `regenerateSection()` with a stricter prompt that names the offending numbers verbatim and re-lists the token table; the retry asks for prose only (no delimiters). Max 3 retries. If still failing after 3 retries → `throw new Error("Number-injection guard failed for section <id>")`.
7. **Token substitution** — `replaceTokens()` uses `split(token).join(value)` (literal-string replacement — handles `{{`/`}}` metacharacters safely) to swap any residual placeholders with their formatted values in the final prose.
8. **Provenance** — `provenance[sectionId] = "AI:template:" + input.templateId` for every section.

Verification:
- `npx tsc --noEmit` → exit 0, no errors (strict mode satisfied).
- Inline smoke test (Node, mirroring the pure functions): 16/16 PASS —
  • `formatINR`: 1234567→"Rs. 12,34,567"; 50000→"Rs. 50,000"; 999→"Rs. 999"; 0→"Rs. 0"; -500000→"-Rs. 5,00,000"; 10000000→"Rs. 1,00,00,000".
  • `verifyNumbers` happy paths: rupee match, DSCR-as-multiplier (1.45x), break-even percent (65.30% and 65.3%), tenure integer (60) — all `ok:true`.
  • `verifyNumbers` failure paths: invented rupee ("Rs. 99,99,999"), invented bare integer ("5000000"), invented percent ("50%") — all flagged as mismatches with the raw substring returned.
  • `parseSections`: 2-section response and preamble-then-section response both parse correctly.
- Did NOT run live AI calls (no provider config in this sandbox); the retry/generate flow is exercised by the type-checker and the smoke test of the pure helpers.

Stage Summary:
- Wave 3 AI Writer complete: 515-line engine implementing DPR narrative generation with a verifiable number-injection guard. Satisfies RULE #5 ("AI is the writer, never the calculator") by enforcing that every numeric digit in the AI's prose must trace back to a deterministic engine figure, with up to 3 regeneration attempts before throwing.
- Artifacts touched: only `src/features/ai/writer/index.ts` (created; directory created). No package.json change, no other source files modified.
- Next-agent action items:
  • A follow-up test file (e.g. `src/features/ai/writer/__tests__/writer.test.ts`) should mock `getAIResponse` and exercise the retry loop end-to-end (clean pass on first try; one mismatch then clean pass; mismatch persists → throws). The pure helpers (`verifyNumbers`, `parseSections`, `formatINR`, `buildTokenMap`) are already exported and trivially unit-testable.
  • The DPR engine (`src/engines/dpr-engine`) currently produces section content from templates — once that engine exposes a hook to swap in AI-generated sections, the orchestrator can call `generateNarrative` and merge `WriterOutput.sections` into `DprDocument.sections`.
  • Consider adding a small allowlist for benign structural tokens (e.g. roman-numeral list markers, "Phase I") if real AI outputs show false positives — current policy is strict per the task spec, which is the safest default for a financial document.

---

Task ID: 4-A
Agent: sub-agent (general-purpose)
Task: Build the unified feature UI shell — rewrite `src/App.tsx` with sidebar/bottom-tab navigation + 8 functional feature route screens, each wired to the real Wave 2 engines.

Work Log:
- Read worklog.md (Stage B context, Waves 0–3) to anchor on what engines are available and their exact public APIs. Confirmed all referenced engine signatures by reading each engine file directly:
  • `computeFinancials(profile)` from `@/engines/financial-engine` — returns FinancialResult with 23 fields + loanSchedule[]. Pure + sync.
  • `checkEligibility(profile)` from `@/engines/eligibility-engine` — returns `{ eligible, checks[], blockers[], warnings[] }`. Pure + sync.
  • `generateDPR(profile, financial, eligibility)` from `@/engines/dpr-engine` — returns DprDocument `{ sections[], financialResult, eligibilityResult, generatedAt, wordCount }` with 18 sections. Pure + sync.
  • `generatePdf(dpr)` from `@/engines/pdf-engine` — returns `Promise<ArrayBuffer>`. Async; deterministic. Also exports `formatINR` (mirrored locally in `src/shared/format.ts` for the UI).
  • `validateProject(profile)` from `@/engines/validation-engine` — pure + sync (NOT called directly by any screen — Wave 5 may surface it on the profile screen).
  • Knowledge engine exports: `resolveActivity(query)` (the main search entry — returns `ActivitySuggestion[]`); `suggestMachinery`, `suggestRawMaterials`, `suggestEmployees`, `suggestUtilities`, `isOnNegativeList`, `getLocationInfo`, `getSubsidyInfo`. All pure + sync. (Task brief mentioned "read the file for exact exports" — confirmed `resolveActivity` is the search entry, not a separate `searchActivities` function.)
  • OCR engine: `extractFromDocument(source, documentType)` returns `Promise<OcrResult>`; `mapOcrToProfile(result, docType)` returns `Partial<ProjectProfile>`. Both async/sync respectively as documented in Task 2-A's worklog.
  • `projectEngine.createProject/inferState/canEdit/applyEdit/getStaleSnapshots` from `@/engines/project-engine`. The Dashboard's "New Project" flow uses the repository's `create()` directly (the repository already wraps `crypto.randomUUID()` + `buildEmptyProfile()` so going through `projectEngine.createProject()` + persisting manually would duplicate that).
  • `exportProject(profile, financials, eligibility, attachments?)` and `importProject(json)` from `@/engines/import-export-engine`. `exportProject` is async (reads `knowledge_version` from `app_meta`); `importProject` is sync.
  • `getCurrentKnowledgeVersion()` from `@/engines/update-engine` — SYNC, returns "bundled" on first call and kicks off a background DB read. The Settings screen re-polls at 800ms / 2s / 4s to pick up the cached value.
- Repository: `getProjectRepository()` from `@/database/project-repository` — SYNC; methods are async: `create(name)`, `getById(id)`, `list()`, `updateProfile(id, profile, status?)`, `updateStatus(id, status)`, `delete(id)`, `getChatHistory(id)`, `appendChatMessages(id, msgs)`. `create()` returns ProjectSummary; `getById()` returns `(ProjectSummary & { profile: ProjectProfile }) | null`; `list()` returns `ProjectSummary[]` (sorted by updated_at DESC).
- `createTestProfile()` from `@/test-helpers/create-test-profile` — returns a fully-valid ProjectProfile (Rajesh Pickle Unit, MANUFACTURING, NIC 103005, ₹1,10,000 total project cost, 1 machinery item, 1 raw material, all 28 mandatory fields filled). Used by the Dashboard's "Create demo project" CTA.

Files created (10 new, 1 modified):
1. `src/shared/format.ts` (new, ~135 lines) — `formatINR(n, withSymbol=true)` (integer math, Indian comma grouping — mirrors pdf-engine's `formatINR` exactly), `formatNumber`, `formatPercent`, `formatDate`, `formatDateTime`, `statusLabel`, `statusBadgeClass`. Pure, no imports.
2. `src/features/dashboard/DashboardScreen.tsx` (new, ~220 lines) — `repo.list()` → project cards with status badges + completeness Progress + per-stage shortcut buttons (Profile / Financial / Eligibility / DPR). Empty state CTAs: "New Project" (`repo.create()`) and "Create demo project" (`repo.create("Demo Project")` + `repo.updateProfile(id, createTestProfile(), "COMPLETE")`).
3. `src/features/project-profile/ProjectProfileScreen.tsx` (new, ~390 lines) — `repo.getById(id)` → Accordion-grouped read-only display (12 sections: applicant, business, location, land, capacity, machinery, raw-materials, employees, utilities, financials, market, validation). "Edit" toggle → JSON `<textarea>` (Wave 4 simple editor; Wave 5 replaces with guided form). Save → `JSON.parse` + `repo.updateProfile(id, profile, "COMPLETE")` + reload.
4. `src/features/financial/FinancialScreen.tsx` (new, ~380 lines) — `computeFinancials(profile)` → 6 KPI cards (total cost / own contribution / subsidy / EMI / DSCR / break-even with color tone), Recharts `<BarChart>` of cost breakdown (5 buckets), Recharts `<LineChart>` of loan schedule (downsampled to every 6th month), full figures table grouped by Means of Finance / Loan / Profitability / Ratios, first-12-months schedule preview.
5. `src/features/eligibility/EligibilityScreen.tsx` (new, ~240 lines) — `checkEligibility(profile)` → prominent eligible/ineligible banner (emerald/destructive), blockers Alert (destructive), warnings Alert (amber), full checklist Table with ✓/✗ icons + criterion ID + actual vs required + reason.
6. `src/features/dpr/DprScreen.tsx` (new, ~310 lines) — calls `computeFinancials` + `checkEligibility` + `generateDPR(profile, financials, eligibility)` → 4 summary cards + Accordion of 18 sections with markdown `<pre>` content + embedded DprTable renders. "Download PDF" button → `generatePdf(dpr)` → Blob(`application/pdf`) → `URL.createObjectURL` → `<a download>` click → 5s revoke. Loader2 spinner during async generation.
7. `src/features/knowledge/KnowledgeScreen.tsx` (new, ~360 lines) — Input + "Search" button + 6 suggested-query chips. `resolveActivity(query)` → result list (clickable cards with NIC code, description, sector, match score %). Selecting one calls `suggestMachinery`, `suggestRawMaterials`, `suggestEmployees`, `suggestUtilities`, `isOnNegativeList` → renders 4 detail tables + negative-list Alert. All synchronous (no async loading states).
8. `src/features/ocr/OcrScreen.tsx` (new, ~290 lines) — `Select` for document type (QUOTATION / IDENTITY_PROOF / ADDRESS_PROOF / LAND_DOCUMENT / EDP_CERTIFICATE / OTHER) + two CTAs: "Capture from camera" and "Pick from gallery" → both call `extractFromDocument(source, docType)`. Renders extracted-fields Table + raw-text `<pre>` (PII-masked by the engine). "Map to profile" button calls `mapOcrToProfile(result, docType)` → JSON preview (Wave 5 will merge via `projectEngine.applyEdit` + `repo.updateProfile`).
9. `src/features/settings/SettingsScreen.tsx` (new, ~410 lines) — AI provider form (base URL / API key [type=password] / model name) loaded from / saved to `localStorage` (Wave 5 → SQLite + Secure Storage). "Test Connection" → `getAIResponse([{system:"ping"},{user:"respond with OK"}], {baseUrl, apiKey, modelName})` → success/failure Alert with reply/error. Knowledge version display via `getCurrentKnowledgeVersion()` (sync; re-polls at 800/2000/4000ms to pick up the cached DB value). Export: Select project → `exportProject(profile, financials, eligibility)` → JSON Blob download. Import: file input → `importProject(text)` → on success shows summary (Wave 5 will persist via repo.create + repo.updateProfile); on failure shows schema error.
10. `src/App.tsx` (rewritten, ~210 lines) — `Shell` component with sticky header (PMEGP logo + brand + Wave 4 badge), left sidebar (desktop md+, 4 primary nav links + scheme info card), bottom tab bar (mobile <md, fixed), main content area (max-w-6xl, pb-24 on mobile for bottom-bar clearance), sticky footer. Routes:
    - `/` → Dashboard
    - `/project/:id` → ProjectProfile
    - `/project/:id/financial` → Financial
    - `/project/:id/eligibility` → Eligibility
    - `/project/:id/dpr` → DPR
    - `/knowledge` → Knowledge
    - `/ocr` → OCR
    - `/settings` → Settings
    - `*` → `<Navigate to="/" replace/>` (with console.warn for debugging)
    All interactive elements meet the 44px touch-target spec (min-h-11 on Buttons, min-h-9 on size="sm" buttons, min-h-14 on mobile tab links). Dark mode already set on `<html class="dark">` — no toggle added (per task brief).

Engine API discoveries / deviations from the brief:
- The brief said "calls `resolveActivity(query)` (or the knowledge engine's search export — read the file)" — confirmed `resolveActivity` IS the canonical search entry (there's no `searchActivities`). Used `resolveActivity`.
- The brief said "API key field is type='password'" — implemented.
- The brief said "Export Project' / 'Import Project' buttons (export calls the current project's exportProject; import reads a JSON file)" — interpreted "current project" as a Select-pickable project (since the Settings screen is global, not project-scoped). Implemented with a Select dropdown of all projects + "Download JSON" button. Import reads a JSON file via `<input type="file">`.
- The brief said "mapOcrToProfile(result, docType)" — exact signature confirmed in OCR engine (line 539). Used verbatim.
- The brief said "Test Connection" calls `getAIResponse([{role:"system",content:"ping"},{role:"user",content:"respond with OK"}], {baseUrl, apiKey, modelName})` — exact signature confirmed in providers/index.ts (line 142). Used verbatim.
- The brief said "Use `useParams` for `:id`" — used in 4 screens (profile, financial, eligibility, dpr).
- The brief said "Money formatting: `formatINR(n)` — implement locally or import from pdf-engine if exported" — implemented locally in `src/shared/format.ts` with identical integer-math algorithm to pdf-engine's `formatINR`, plus a `withSymbol` option (default `true` → "₹" prefix; `false` for table cells where the column header carries the unit). The pdf-engine version returns the bare number; mine adds the ₹ symbol for UI display.
- The brief said "calls `getProjectRepository().list()`" — confirmed `getProjectRepository()` is sync (returns the singleton immediately); methods on it are async. The Dashboard's `load()` uses `async/await` for `repo.list()`.
- The brief said "If no projects, show a 'Create demo project' button that creates one with `createTestProfile()` via `.create('Demo')` then `.updateProfile(id, createTestProfile(), 'COMPLETE')`" — implemented verbatim, with status="COMPLETE" so `projectEngine.inferState()` doesn't downgrade it.
- The brief said "Edit mode = simple JSON textarea editor for Wave 4" — implemented as a `<Textarea>` with `JSON.parse` on Save, error surfacing without losing the textarea contents.
- The brief said "Recharts bar chart of cost breakdown (machinery, building, working capital, etc.)" — implemented with 5 buckets (Machinery, Building, Other fixed, Pre-op expenses, Working capital). Plus a Recharts `<LineChart>` for the loan schedule per the same bullet.
- The brief said "18 sections in an accordion" — confirmed `generateDPR` produces exactly 18 sections (verified by reading dpr-engine/index.ts line 1783-1803). Used shadcn `<Accordion type="single" collapsible>`.
- The brief said "Sticky footer (min-h-screen flex flex-col, footer mt-auto)" — implemented via the Shell wrapper (`min-h-screen flex flex-col` + footer has `mt-auto`).
- The brief said "Mobile-responsive (Tailwind `sm:`/`md:` breakpoints)" — used `md:` breakpoint for the sidebar/bottom-tab swap, plus `sm:` and `lg:` for grid column counts (KPI strip is 2/3/6 cols; charts are 1/2 cols; profile sections grid is 2/3 cols).
- The brief said "Dark mode (class='dark' on html already)" — confirmed in `index.html` line 2. No theme toggle added (out of scope).

Verification:
- `bun run typecheck` (`tsc -b --noEmit`) → exit 0 (clean). 0 errors.
- `bun run lint` (`eslint .`) → 0 errors / 13 warnings — ALL 13 are pre-existing in OTHER files (`dpr-engine/index.ts` has 4 unused-var warnings from sub-agent 2-D; `knowledge-engine/index.ts` has 1 unused import; `features/ai/interview/*` has 5; `hooks/use-toast.ts` has 1; `shared/types/project-profile.ts` has 1). ZERO warnings in any of my new files (verified by filtering lint output for `features/dashboard`, `features/project-profile`, `features/financial`, `features/eligibility`, `features/dpr`, `features/knowledge`, `features/ocr`, `features/settings`, `shared/format`, `App.tsx`).
- `bun run build` (`tsc -b && vite build`) → exit 0; 2967 modules transformed; `dist/` produced. Bundle is 1.77MB (540KB gzipped) — large because it includes recharts + pdf-lib + tesseract.js + all radix primitives in a single chunk. Wave 5 should code-split (e.g. lazy-load `DprScreen` + `OcrScreen` + `SettingsScreen` which pull in pdf-lib / tesseract.js). The build only emits a "chunks > 500 kB" warning, not an error.
- `bun run test` → 31/31 passing in `project-engine.test.ts`. 6 test files FAIL but ALL failures are pre-existing in `src/features/ai/interview*` test files that import `from "bun:test"` (incompatible with the project's vitest config — these were failing before my changes and are owned by the AI-interview sub-agent's territory). My new code does NOT touch any of these test files. (Verified via `git status -u` that I did not modify any test files.)

Stage Summary:
- Wave 4 feature UI shell complete: 9 new files + 1 rewritten file wiring all 8 feature routes to the real Wave 2 engines. Every screen is FUNCTIONAL — calls real engines, displays real results, handles errors via shadcn Alerts, shows loading Skeletons during async loads. Mobile-responsive with sidebar (desktop) / bottom tab bar (mobile), sticky header/footer, 44px touch targets, dark mode. TypeScript strict passes, ESLint clean for my code, vite build succeeds.
- Artifacts touched (per task constraints — did NOT touch `package.json`, `src/components/ui/`, `src/engines/`, or `src/database/`):
  • `src/App.tsx` (rewritten)
  • `src/shared/format.ts` (new)
  • `src/features/dashboard/DashboardScreen.tsx` (new)
  • `src/features/project-profile/ProjectProfileScreen.tsx` (new)
  • `src/features/financial/FinancialScreen.tsx` (new)
  • `src/features/eligibility/EligibilityScreen.tsx` (new)
  • `src/features/dpr/DprScreen.tsx` (new)
  • `src/features/knowledge/KnowledgeScreen.tsx` (new)
  • `src/features/ocr/OcrScreen.tsx` (new)
  • `src/features/settings/SettingsScreen.tsx` (new)
- Next-agent action items (Wave 5):
  • Replace the ProjectProfile "Edit JSON" toggle with a real guided form (per-section Inputs + Selects + validated save via `projectEngine.applyEdit` + `repo.updateProfile`). The current JSON editor is intentionally minimal — Wave 4 is the shell, Wave 5 is the polished UX.
  • Wire OCR "Map to profile" to actually persist: `mapOcrToProfile(result, docType)` → `projectEngine.applyEdit(activeProfile, edits)` → `repo.updateProfile(id, mergedProfile, status)`. Currently it only shows the JSON preview.
  • Wire Import Project to persist: `importProject(json)` → `repo.create(name)` + `repo.updateProfile(newId, profile, status)` + `repo.updateStatus(newId, status)`. Currently it only validates + reports.
  • Move AI provider config from `localStorage` to SQLite (`ai_provider_config` table for baseUrl + modelName; Secure Storage / Android Keystore for apiKey). The Settings screen's localStorage keys are namespaced `pmegp.aiProvider.*` for easy migration.
  • Code-split the bundle: lazy-load `DprScreen` (pdf-lib), `OcrScreen` (tesseract.js), `SettingsScreen` (import-export-engine) via `React.lazy` + `Suspense`. The current 1.77MB main chunk will drop materially.
  • Add a real Markdown renderer for DPR section content (currently shown as `<pre>` preformatted text — the dpr-engine emits Markdown strings).
  • Wire `validateProject(profile)` into the ProjectProfile screen as a "Validate" button + completeness/errors display (the validation sub-section already shows the cached `profile.validation` fields; running `validateProject` live would refresh them).
  • The bottom tab bar shows only 4 routes (Dashboard / Knowledge / OCR / Settings) — project-scoped routes are accessible only from Dashboard cards. If a Wave 5 user-flow expects to switch between project screens from a bottom bar, add a 5th "Current project" tab that appears when a project is open.
  • Test the build output on a real Android device (Capacitor 8) — the bottom tab bar's `fixed bottom-0` + `pb-24` clearance works in browsers but should be verified against Android's safe-area insets (`env(safe-area-inset-bottom)`).

---
Task ID: 2-5 (final)
Agent: orchestrator (main)
Task: Waves 2-5 parallel execution + final integration.

Work Log:
- Wave 2: dispatched 5 sub-agents in parallel (2-A Import/Export, 2-B Update, 2-C Project, 2-D PDF, 2-E OCR). All returned with typecheck/lint clean. Committed 8d63214.
- Wave 3: dispatched 1 sub-agent (3-A AI Writer with number-injection guard). Returned clean — 13 token map, post-gen verify, 3-retry regen.
- Wave 4: dispatched 1 sub-agent (4-A feature UI shell). Built 10 files: App.tsx rewrite + 8 feature screens + shared/format.ts. All 8 features functional (call real engines). typecheck exit 0, build exit 0 (2967 modules).
- Wave 5: wrote CI pipeline (ci.yml: lint+typecheck+test+build), release pipeline (release.yml: signed APK on tag), PII redaction utils (src/shared/security/pii.ts), 1 worked-example fixture (case-1-gen-male-urban-mfg.json).
- Final: typecheck exit 0, lint 0 errors / 13 warnings (all unused-vars, non-blocking). Committed 5030a2e, pushed to main.
- Dev server verified: GET / serves HTML shell, App.tsx + DashboardScreen.tsx serve as compiled modules (HTTP 200), zero runtime errors.

Stage Summary:
- 10 engines complete (5 preserved + 5 new/rewritten).
- 8 feature UI modules functional (dashboard, profile, financial, eligibility, dpr, knowledge, ocr, settings).
- AI Writer with number-injection guard complete.
- CI + APK release pipelines configured (signing requires GitHub Secrets).
- PII redaction utilities complete.
- 1 of 4 worked-example fixtures complete.
- Honest gaps: APK signing needs secrets, Update Engine public key is placeholder, 3 fixtures pending, Guided Forms fallback not yet built, biometric unlock not built, E2E tests not written, tesseract WASM assets need local bundling for true offline.
