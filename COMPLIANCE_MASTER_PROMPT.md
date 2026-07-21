# PMEGP Assistant — Full Compliance Remediation Master Prompt

> **Copy this entire file and paste it into Kilo Code as your task prompt.**
> It orchestrates ~35 sub-agents across 7 phases to bring the codebase into 100% compliance with all documentation files.

---

## CONTEXT

You are working on the PMEGP Assistant App at `/home/z/my-project` (or the Kilo Code workspace). The app helps Indian entrepreneurs apply for PMEGP (Prime Minister's Employment Generation Programme) subsidies by guiding them through project profiling, eligibility checking, financial computation, DPR (Detailed Project Report) generation, and PDF output.

### Current State
- **Platform**: Next.js 16 with App Router (web server) — MUST migrate to React 19 + Vite + Capacitor 7 → Android APK
- **Engines**: 7 exist (financial, eligibility, validation, DPR, PDF, knowledge, OCR-mock) — 3 more needed
- **Tests**: 6 unit test files only — need comprehensive coverage
- **State**: Custom stores — must use Zustand
- **Server State**: Direct fetch() calls — must use TanStack Query
- **Validation**: Zod schemas defined but never called — must enforce at every boundary
- **Money**: JavaScript floats — must be integer paise
- **Data Model**: 3 Prisma models — need 20+
- **Knowledge Package**: ~45% complete — need banks, templates, FAQ, circulars, etc.

### Governing Documents (read ALL before starting)
These files define what the app MUST be. Every sub-agent must read the relevant docs before coding:
- `AGENTS.md` — Core rules, stack, folder structure, forbidden actions
- `DESIGN_PRINCIPLES.md` — 15 architectural principles (P1-P15)
- `CLAUDE.md` — Code quality rules, behavioral guidelines
- `GEMINI.md` — Provider independence
- `docs/01-system-architecture.md` through `docs/16-ai-interview-and-project-discovery.md` — Full architecture
- `docs/README.md` — Document index
- `docs/reference/pmegp-scheme-values-reference.md` — PMEGP scheme values
- `docs/traceability-matrix.md` — Requirement traceability

### Non-Negotiable Rules (from AGENTS.md & DESIGN_PRINCIPLES.md)
1. **Offline-first** — App MUST work without internet (except AI calls to user's endpoint)
2. **No backend** — Zero server-side code. Everything runs on-device.
3. **No login/authentication** — No user accounts
4. **SQLite source of truth** — Encrypted at rest (SQLCipher)
5. **Deterministic engines** — Pure functions, no AI in calculations, no I/O
6. **AI assists but never invents financial figures** — AI = interviewer + writer only
7. **AI-first with guided fallback** — Full form wizard must exist as alternative
8. **Only external call is app→user's AI** — No telemetry, no analytics
9. **Engines independently testable** — No framework dependencies
10. **Privacy-first** — Encrypted DB, API key in Keystore, PII redacted in logs
11. **Scheme-parameterized** — All PMEGP constants from Knowledge Package, never hardcoded
12. **Knowledge ships in the box** — With signed update mechanism
13. **Validation gates engines** — Engines only run on validated profiles
14. **AI questions from schema** — All questions map to Project Profile fields
15. **Money stored as integer paise** — Never floating point

### Tech Stack (MANDATORY per AGENTS.md)
- React 19, TypeScript 5 (strict), Vite
- Capacitor 7 → Android APK
- Zustand (client state), TanStack Query (server/async state)
- SQLite via Capacitor SQLite Plugin (encrypted with SQLCipher)
- Zod (validation at every boundary)
- React Hook Form + Zod resolver
- Recharts (charts)
- On-device OCR (ML Kit via Capacitor)
- Vitest (unit/integration), Playwright (E2E + Android device tests)
- No Redux, no Firebase, no backend, no telemetry

---

## EXECUTION INSTRUCTIONS

Execute phases **IN ORDER** (each phase depends on the previous). Within each phase, sub-agents can run **IN PARALLEL** unless noted otherwise.

Before each phase, the orchestrating agent MUST:
1. Read all relevant documentation files listed above
2. Read the current codebase to understand what exists
3. Check `/worklog.md` for what previous agents have done
4. Execute the task
5. Run `bun run lint` (or `npm run lint`) to verify no errors
6. Run relevant tests
7. Append work record to `/worklog.md`

---

## PHASE 0: Platform Migration — Next.js → Vite + Capacitor 7
**Agents: 3 (sequential — 0-A → 0-B → 0-C)**

### Agent 0-A: Scaffold Vite + React 19 Project
**Task**: Create a new Vite project alongside the existing Next.js app. DO NOT delete the Next.js app yet.

1. Run `npm create vite@latest pmegp-app -- --template react-ts` in the repo root (or a temp location)
2. Install dependencies: `react@19`, `react-dom@19`, `react-router-dom@7`, `zustand@5`, `@tanstack/react-query@5`, `zod@4`, `react-hook-form@7`, `@hookform/resolvers`, `recharts`, `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tailwindcss@4`, `@radix-ui/*` (all shadcn/ui primitives)
3. Set up Tailwind CSS 4 with the same theme configuration
4. Set up path aliases (`@/` → `src/`)
5. Configure Vitest
6. Copy ALL `src/engines/` files as-is (they're pure functions, no framework dependency)
7. Copy ALL `src/shared/` files as-is
8. Copy ALL `src/knowledge-package/` files as-is
9. Copy ALL `src/features/ai/interview/` files (will need minor refactoring later)
10. Create `capacitor.config.ts`:
    ```
    import type { CapacitorConfig } from '@capacitor/cli';
    const config: CapacitorConfig = {
      appId: 'com.pmegp.assistant',
      appName: 'PMEGP Assistant',
      webDir: 'dist',
      server: { androidScheme: 'https' },
      plugins: {
        SplashScreen: { launchShowDuration: 2000 },
        SQLite: { iosDatabaseLocation: 'Library/CapacitorDatabase' }
      }
    };
    export default config;
    ```
11. Install Capacitor: `@capacitor/core@7`, `@capacitor/cli@7`, `@capacitor/android@7`
12. Initialize Android: `npx cap init` then `npx cap add android`
13. Set up ESLint with strict rules, import-boundary custom rule

**Deliverable**: Working Vite + React 19 app that compiles, with Capacitor Android platform added.

### Agent 0-B: Migrate UI Components & Pages
**Task**: Port all UI from Next.js to Vite/React.

1. Install and configure `shadcn/ui` for Vite (not the Next.js version)
2. Copy all `src/components/ui/*.tsx` files (shadcn primitives) — these are framework-agnostic
3. Port all `src/components/dashboard/*.tsx` components:
   - Replace `"use client"` directives (not needed in Vite)
   - Replace `next/image` with regular `<img>` or keep as-is if using unoptimized
   - Replace Next.js navigation with `react-router-dom`
   - Replace any `next/font` with system fonts or Google Fonts via CSS
4. Port all `src/components/interview/*.tsx` components
5. Port `src/app/page.tsx` → `src/App.tsx` with React Router routes
6. Set up routing:
   - `/` → Dashboard (project list, stats)
   - `/project/new` → New project (choice: AI interview or guided form)
   - `/project/:id/interview` → AI Interview chat
   - `/project/:id/guided` → Guided Form wizard
   - `/project/:id/review` → Review & pipeline execution
   - `/project/:id/dpr` → DPR view
   - `/project/:id/pdf` → PDF generation & download
   - `/settings` → AI Provider settings
7. Port theme toggle (dark/light mode) using `next-themes` alternative or CSS media query

**Deliverable**: All existing UI working in Vite with React Router navigation.

### Agent 0-C: Migrate Data Layer — Prisma → Capacitor SQLite
**Task**: Replace server-side Prisma with on-device Capacitor SQLite.

1. Install: `@capacitor-community/sqlite@7`
2. Create `src/database/sqlite/connection.ts` — Capacitor SQLite wrapper with:
   - Connection singleton
   - Encryption enabled (SQLCipher via plugin config)
   - Migration runner
3. Create `src/database/sqlite/migrations/` — Versioned migration files:
   - `001_initial.sql` — All tables from docs/03-data-model.md
   - `002_add_indexes.sql` — Performance indexes
4. Implement ALL tables from docs/03-data-model.md:
   - `applicant` — Personal details
   - `project` — Project metadata, status (9-state machine), created/updated
   - `project_financials` — Engine output snapshot (ALL money as INTEGER/paise)
   - `dpr_document` — Serialized DPR with metadata
   - `attachment` — Document attachments (OCR source files)
   - `ai_provider_config` — Provider settings (API key encrypted via Secure Storage, NOT in DB)
   - `scheme` — Scheme parameters, version
   - `rule_set` — Eligibility rules, version
   - `activity` — Permitted activities catalog
   - `nic_code` — NIC code reference
   - `machinery` — Machinery catalog reference
   - `raw_material` — Raw materials catalog reference
   - `bank` — Bank list
   - `template` — DPR/PDF templates
   - `circular` — KVIC circulars
   - `faq` — Frequently asked questions
   - `prompt_template` — AI prompt templates
   - `app_meta` — First-run flags, knowledge_version, schema_version
5. Create `src/database/sqlite/repositories/`:
   - `project-repository.ts` — CRUD with Zod validation on read/write
   - `financials-repository.ts` — Engine output snapshots
   - `provider-repository.ts` — AI provider config (API key in Secure Storage)
   - `knowledge-repository.ts` — Knowledge version tracking
   - `attachment-repository.ts` — Document storage
   - `app-meta-repository.ts` — App state flags
6. Create `src/database/interfaces.ts` — Repository interfaces for testability
7. Remove ALL Prisma dependencies, `prisma/` folder, `src/lib/db.ts`
8. API key storage: Use `@capacitor/preferences` or `@capacitor/secure-storage` plugin — NEVER store API key in SQLite

**Deliverable**: Full on-device encrypted SQLite with all 18+ tables, repository pattern, API key in Secure Storage.

---

## PHASE 1: Code Quality & State Management (5 agents, parallel)
**Depends on: Phase 0**

### Agent 1-A: Zod Enforcement at Every Boundary
**Task**: Add `.safeParse()` calls at every data entry/exit point.

1. Read `src/shared/types/schemas/project-profile.ts` — understand all schemas
2. Create `src/shared/validation/boundary-guards.ts`:
   - `validateProjectProfile(data: unknown): ProjectProfile` — wraps Zod safeParse with detailed error messages
   - `validateFinancialInput(data: unknown): FinancialInput` — for financial engine
   - `validateProviderConfig(data: unknown): ProviderConfig` — for AI provider settings
   - `validateExportData(data: unknown): ExportData` — for import/export
3. Add Zod validation to EVERY engine entry point:
   - `engines/financial-engine/index.ts` — validate input profile before computing
   - `engines/eligibility-engine/index.ts` — validate input profile
   - `engines/validation-engine/index.ts` — validate input profile
   - `engines/dpr-engine/index.ts` — validate all inputs
   - `engines/pdf-engine/index.ts` — validate DPR document
   - `engines/knowledge-engine/index.ts` — validate query inputs
4. Add Zod validation to EVERY repository write:
   - Project create/update must validate profile data against schema
   - Financial output must validate against financial output schema
   - Provider config save must validate
5. Add Zod validation to UI forms (React Hook Form + zodResolver):
   - Settings dialog (provider config)
   - Guided form steps (profile sections)
   - Project create (name validation)
6. Create error display component that shows Zod validation errors in user-friendly format
7. Rule: **Never bypass Zod validation at any boundary** (CLAUDE.md requirement)

**Deliverable**: Every data flow through the app validated by Zod. Zero `any` types at boundaries.

### Agent 1-B: Money → Integer Paise Throughout
**Task**: Convert all financial values to integer paise (₹100 = 10000 paise).

1. Read docs/05-financial-engine.md and docs/03-data-model.md for money rules
2. Create `src/shared/utils/money.ts`:
   - `toPaise(rupees: number): number` — convert with Math.round
   - `toRupees(paise: number): number` — convert for display
   - `formatRupees(paise: number): string` — format as "₹1,23,456.78"
   - `formatRupeesInt(paise: number): string` — format as "₹1,23,456"
3. Update `engines/financial-engine/index.ts`:
   - All input values expected as paise integers
   - All output values returned as paise integers
   - EMI formula works in paise internally
   - `subsidyRate` stored as basis points (25% = 2500)
   - DSCR stored as basis points (1.5 = 150)
   - `breakEvenPercent` stored as basis points (65% = 6500)
4. Update `engines/eligibility-engine/index.ts`:
   - Cost ceiling comparison in paise
5. Update `engines/dpr-engine/index.ts`:
   - All financial figures in output as paise
   - Display conversion happens only at render time
6. Update `engines/pdf-engine/index.ts`:
   - Convert paise → rupees only when rendering text
7. Update all database schemas (SQLite):
   - ALL money columns: `INTEGER NOT NULL` (paise)
   - `subsidy_rate`: `INTEGER NOT NULL` (basis points)
   - `dscr`: `INTEGER` (basis points, nullable)
   - `break_even_percent`: `INTEGER` (basis points, nullable)
8. Update all UI components that display money:
   - Use `formatRupees()` for display
   - Use `toPaise()` for input
9. Update Knowledge Package:
   - `pmegp_subsidy_matrix.json` — subsidy rates as basis points
   - Cost ceilings as paise integers
   - Machinery costs as paise integers
   - Raw material costs as paise integers
10. Update ALL tests with paise values

**Deliverable**: Zero floating-point money anywhere in the codebase. All financial calculations in integer paise.

### Agent 1-C: Zustand State Management
**Task**: Replace all custom state management with Zustand stores.

1. Read AGENTS.md and docs/02 for state management requirements
2. Create `src/stores/` folder with:
3. `src/stores/project-store.ts`:
   - State: `projects: ProjectSummary[]`, `selectedProjectId: string | null`, `isLoading: boolean`, `error: string | null`
   - Actions: `fetchProjects()`, `selectProject(id)`, `createProject(name)`, `deleteProject(id)`, `updateProjectStatus(id, status)`
   - Persist to localStorage (offline-first)
4. `src/stores/interview-store.ts` (REPLACE existing `features/ai/interview-store/interview-store.ts`):
   - State: `messages: ChatMessage[]`, `currentPhase: InterviewPhase`, `profile: ProjectProfile`, `isStreaming: boolean`, `isComplete: boolean`
   - Actions: `addMessage(msg)`, `updateProfile(partial)`, `setPhase(phase)`, `setStreaming(bool)`, `reset()`, `loadFromHistory(projectId)`
   - Persist chat history to SQLite via repository (not localStorage for large data)
5. `src/stores/settings-store.ts`:
   - State: `theme: 'light' | 'dark' | 'system'`, `activeProviderId: string | null`, `hasAcceptedNotice: boolean`
   - Actions: `setTheme(t)`, `setActiveProvider(id)`, `acceptNotice()`
   - Persist to Capacitor Preferences
6. `src/stores/ui-store.ts`:
   - State: `sidebarOpen: boolean`, `activeTab: string`, `notifications: Notification[]`
   - Actions: `toggleSidebar()`, `setActiveTab(t)`, `addNotification(n)`, `dismissNotification(id)`
7. Wire all stores into components:
   - Dashboard components → `useProjectStore`
   - Interview components → `useInterviewStore`
   - Settings → `useSettingsStore`
   - Layout → `useUIStore`
8. Remove old `features/ai/interview-store/interview-store.ts`

**Deliverable**: 4 Zustand stores replacing all custom state. Persisted appropriately.

### Agent 1-D: TanStack Query for Async State
**Task**: Wrap all data-fetching with TanStack Query.

1. Create `src/hooks/` folder
2. Create `src/hooks/use-projects.ts`:
   - `useProjects()` — `useQuery` wrapping project list fetch from SQLite
   - `useProject(id)` — `useQuery` for single project
   - `useCreateProject()` — `useMutation` for project creation
   - `useDeleteProject(id)` — `useMutation` for deletion
   - `useUpdateProjectStatus()` — `useMutation` for status updates
3. Create `src/hooks/use-providers.ts`:
   - `useProviders()` — `useQuery` for provider list
   - `useCreateProvider()` — `useMutation`
   - `useUpdateProvider()` — `useMutation`
   - `useDeleteProvider()` — `useMutation`
   - `useTestConnection()` — `useMutation` for test connection
4. Create `src/hooks/use-pipeline.ts`:
   - `usePipelineStatus(projectId)` — `useQuery` polling pipeline status
   - `useRunPipeline(projectId)` — `useMutation` to trigger pipeline
   - `usePipelineResult(projectId, step)` — `useQuery` for step output
5. Create `src/hooks/use-financials.ts`:
   - `useFinancials(projectId)` — `useQuery` for financial engine output
6. Create `src/hooks/use-interview.ts`:
   - `useSendChat()` — `useMutation` for sending chat messages (with streaming via `useQuery` + SSE or similar pattern)
7. Set up `QueryClientProvider` in `src/App.tsx`
8. Configure stale times, cache times, retry logic
9. Replace ALL direct data fetches in components with these hooks
10. Remove all `fetch()` calls from components

**Deliverable**: All async data through TanStack Query. Zero `fetch()` in components.

### Agent 1-E: Provider Manager Refactor
**Task**: Build proper provider abstraction with manager pattern.

1. Read docs/04-ai-architecture.md for provider requirements
2. Create provider structure:
   ```
   src/providers/
   ├── provider-manager.ts          # Main interface + factory
   ├── types.ts                     # Provider types, messages, config
   ├── adapters/
   │   ├── openai-compatible.ts     # Any OpenAI-compatible API
   │   └── builtin-sdk.ts           # Optional local/on-device SDK
   └── __tests__/
       └── provider-manager.test.ts
   ```
3. `src/providers/types.ts`:
   - `AiMessage { role: 'system' | 'user' | 'assistant', content: string }`
   - `ProviderConfig { id, name, baseUrl, apiKey, modelName, maxTokens, temperature }`
   - `ProviderResponse { content: string, usage?: { promptTokens, completionTokens }, finishReason }`
   - `ProviderAdapter { chat(messages, config): Promise<ProviderResponse>, testConnection(config): Promise<boolean> }`
4. `src/providers/adapters/openai-compatible.ts`:
   - Implements `ProviderAdapter`
   - Uses `fetch()` to call `/v1/chat/completions`
   - Streams responses (SSE parsing)
   - Handles errors gracefully
   - PII minimization: strip Aadhaar/PAN before sending
5. `src/providers/provider-manager.ts`:
   - `getActiveProvider(): ProviderAdapter`
   - `sendMessage(messages, systemPrompt?): Promise<ProviderResponse>`
   - `sendMessageStream(messages, onChunk): Promise<ProviderResponse>`
   - `testConnection(providerId): Promise<{ success, latency, modelInfo }>`
   - No baked-in default — user MUST configure a provider
6. Wire into interview orchestrator — replace current provider usage
7. Add "Test Connection" button in Settings with real API call and latency display
8. Provider config: API key stored in `@capacitor/preferences` (encrypted), NEVER in SQLite, NEVER in logs, NEVER in exports

**Deliverable**: Clean provider abstraction. Test Connection works. No baked-in SDK required.

---

## PHASE 2: Missing Engines (4 agents, parallel)
**Depends on: Phase 0, Phase 1**

### Agent 2-A: Import/Export Engine
**Task**: Build the ONLY durability story for the app.

1. Read docs/12-import-export-and-update.md thoroughly
2. Create `src/engines/import-export-engine/`:
   - `index.ts` — Main engine with pure functions
   - `types.ts` — Export format types
   - `__tests__/import-export.test.ts`
3. Export format (JSON):
   ```json
   {
     "schema_version": "1.0.0",
     "knowledge_version": "2024.1.0",
     "exported_at": "2024-07-18T10:00:00Z",
     "projects": [
       {
         "project": { ... },
         "financials": { ... },
         "dpr": { ... },
         "chat_history": [ ... ]
       }
     ]
   }
   ```
4. Functions:
   - `exportProject(projectId): ExportData` — Full project export
   - `exportAllProjects(): ExportData` — All projects export
   - `exportBackup(): BackupData` — Full DB backup (all tables)
   - `importProject(data: unknown): ImportResult` — Zod-validate, check version compatibility, import
   - `importBackup(data: unknown): ImportResult` — Full DB restore
   - `validateExportData(data: unknown): ValidationResult` — Schema check
5. **CRITICAL RULES**:
   - API key is NEVER included in export
   - `app_meta` (first-run flags) NOT included in export
   - Version compatibility check: warn if `schema_version` mismatches
   - Knowledge version check: warn if `knowledge_version` older than current
   - On import conflict: offer merge/skip/overwrite options
6. Round-trip test: export → import → verify identical
7. Share functionality: Use Capacitor Share plugin to share exported JSON
8. Android backup: Offer periodic backup to device storage

**Deliverable**: Full import/export/backup/restore engine with Zod validation, version checks, API key exclusion.

### Agent 2-B: AI Writer Engine
**Task**: Build the AI-powered narrative writer for bank-ready DPR prose.

1. Read docs/04-ai-architecture.md §6 (AI Writing) and docs/07-dpr-engine.md
2. Create `src/engines/ai-writer-engine/`:
   - `index.ts` — Main engine
   - `types.ts` — Writer types
   - `number-guard.ts` — Post-generation number verification
   - `__tests__/ai-writer.test.ts`
3. Writer interface:
   - `writeNarrative(section: DprSection, engineOutputs: EngineOutputs, knowledge: KnowledgeContext): Promise<DprNarrativeSection>`
   - `writeAllNarratives(dprStructure: DprDocument, engineOutputs: EngineOutputs, knowledge: KnowledgeContext): Promise<DprDocument>`
4. Number-injection guard (MANDATORY):
   - After AI generates narrative text, extract ALL monetary figures (regex for ₹ patterns, comma-separated numbers)
   - Compare each extracted figure against the corresponding engine output
   - If mismatch: flag the section, inject correct figures, log warning
   - `verifyNumbers(narrative: string, expectedValues: Map<string, number>): NumberVerificationResult`
5. AI prompt templates (from Knowledge Package):
   - System prompt: "You are writing a bank-ready DPR section for PMEGP subsidy application. Use EXACTLY these financial figures: ..."
   - Section-specific prompts for: Project Description, Market Analysis, Technical Details, Financial Justification
6. Provider: Uses Provider Manager (from 1-E) — no direct SDK calls
7. Fallback: If AI unavailable, use template-based prose from Knowledge Package
8. PII minimization: Strip Aadhaar, PAN, full name from prompts

**Deliverable**: AI Writer that generates bank-ready prose with mandatory number verification.

### Agent 2-C: Project Engine (Orchestrator)
**Task**: Build the full project lifecycle orchestrator.

1. Read docs/15-application-workflows.md for the orchestration table
2. Create `src/engines/project-engine/`:
   - `index.ts` — Main orchestrator
   - `state-machine.ts` — 9-state transition logic (may already exist in shared/)
   - `types.ts`
   - `__tests__/project-engine.test.ts`
3. Functions:
   - `initializeProject(name: string): Project` — Create project in EMPTY state
   - `startInterview(projectId): void` — Transition EMPTY → DISCOVERING
   - `completeInterview(projectId): ValidationResult` — Transition DISCOVERING → COMPLETE → REVIEW_PENDING
   - `runValidation(projectId): ValidationGateResult` — Run validation engine, gate check
   - `runEligibility(projectId): EligibilityResult` — Run eligibility engine
   - `runFinancial(projectId): FinancialOutput` — Run financial engine
   - `assembleDpr(projectId, useAi: boolean): DprDocument` — Run DPR engine (+ AI Writer if useAi)
   - `generatePdf(projectId): Buffer` — Run PDF engine
   - `getProjectStatus(projectId): PipelineStatus` — Get current state + available actions
4. State machine enforcement:
   - Each function checks current state before executing
   - Invalid transitions throw descriptive errors
   - State transitions are atomic (all-or-nothing)
5. Pipeline execution:
   - `runFullPipeline(projectId, options: { skipTo?: PipelineStep, useAi?: boolean })`
   - Executes: validation → eligibility → financial → DPR → PDF
   - Each step's output is snapshotted to database
   - Failed steps are logged with error details
   - User can retry from failed step
6. Determinism:
   - Same profile + same knowledge version = identical output
   - Knowledge version recorded with each engine output snapshot

**Deliverable**: Full project lifecycle orchestrator with state machine, pipeline, and determinism.

### Agent 2-D: Update Engine
**Task**: Build knowledge package update mechanism with signature verification.

1. Read docs/12-import-export-and-update.md Part B
2. Create `src/engines/update-engine/`:
   - `index.ts` — Main engine
   - `types.ts`
   - `__tests__/update.test.ts`
3. Functions:
   - `checkForUpdate(currentVersion: string, updateUrl?: string): Promise<UpdateCheckResult>`
   - `downloadUpdate(url: string): Promise<UpdatePackage>`
   - `verifySignature(package: UpdatePackage): SignatureVerificationResult`
   - `validateSchema(package: UpdatePackage): SchemaValidationResult`
   - `applyUpdate(package: UpdatePackage): ApplyResult` — Atomic apply
4. Update package format:
   ```json
   {
     "knowledge_version": "2024.2.0",
     "schema_version": "1.0.0",
     "signature": "base64-ecdsa-sha256",
     "files": { "pmegp_subsidy_matrix.json": "...", ... },
     "changelog": "Updated subsidy rates per KVIC circular dated..."
   }
   ```
5. Signature verification: ECDSA-SHA256 (public key bundled in app)
6. Atomic apply: Write to temp, validate, then swap. Rollback on failure.
7. Non-disruption: Existing projects and DPRs remain valid even after knowledge update
8. Metadata update: Update `app_meta.knowledge_version` after successful apply

**Deliverable**: Update engine with signature verification, atomic apply, and rollback.

---

## PHASE 3: Missing Features (6 agents, parallel)
**Depends on: Phase 1, Phase 2**

### Agent 3-A: Guided Form Wizard
**Task**: Build the complete form-based alternative to AI interview.

1. Read docs/04-ai-architecture.md §3 (Guided Fallback), docs/16-ai-interview-and-project-discovery.md §2 (Full Project Profile schema)
2. Create `src/features/guided-form/`:
   - `guided-form-wizard.tsx` — Main wizard container with step navigation
   - `steps/applicant-info.tsx` — Name, age, gender, category, phone, email, education, Aadhaar, PAN
   - `steps/business-details.tsx` — Business name, description, constitution, NIC code (with search), sector, activity type
   - `steps/location-details.tsx` — State, district, pincode, urban/rural
   - `steps/land-details.tsx` — Land status, owned value, rented monthly rent
   - `steps/capacity-details.tsx` — Production capacity, units per year/month
   - `steps/machinery-details.tsx` — Machinery list (add/remove items from catalog or custom), costs
   - `steps/raw-materials-details.tsx` — Raw materials list (add/remove items), costs
   - `steps/employee-details.tsx` — Employee count, skilled/unskilled, monthly wages
   - `steps/utilities-details.tsx` — Power, water, fuel, rent
   - `steps/financial-details.tsx` — Project cost summary, own contribution, bank loan preference
   - `steps/review-submit.tsx` — Review all sections, submit to pipeline
   - `components/step-indicator.tsx` — Visual step progress
   - `components/nic-code-search-form.tsx` — NIC code search within form
   - `components/catalog-item-picker.tsx` — Reusable picker for machinery/raw materials from catalog
3. Each step:
   - Uses React Hook Form + Zod resolver for validation
   - Auto-advances on valid submission
   - Shows validation errors inline
   - Pre-fills from Knowledge Package defaults where applicable (NIC code → sector, subCategory)
   - Saves progress to Zustand store on each step (offline-first)
   - Can navigate back to edit previous steps
4. On completion:
   - Assembles full ProjectProfile from all step data
   - Sets provenance for each field to `Source.USER_INPUT` with `Verification.CONFIRMED`
   - Transitions project to COMPLETE → REVIEW_PENDING state
   - Navigates to review page
5. Must produce IDENTICAL output format as AI interview (same ProjectProfile shape)
6. Knowledge-assisted: When user selects NIC code, auto-populate sector, subCategory, activity defaults

**Deliverable**: Complete 11-step form wizard as full alternative to AI interview.

### Agent 3-B: First-Run Transparency Notice
**Task**: Build the mandatory first-run transparency modal.

1. Read DESIGN_PRINCIPLES.md §11, AGENTS.md §8
2. Create `src/features/onboarding/`:
   - `transparency-notice.tsx` — Full-screen modal with:
     - Title: "PMEGP Assistant — Transparency Notice"
     - Sections:
       a. "Your data stays on this device" — explain offline-first, no cloud
       b. "AI calls go to YOUR endpoint" — explain provider config, no data sent to us
       c. "No telemetry or tracking" — explain no analytics
       d. "You are responsible for data backup" — explain import/export
     - "I Understand and Accept" button (disabled for 3 seconds to force reading)
     - Cannot be dismissed without clicking
   - `first-run-guard.tsx` — HOC/wrapper that checks `hasAcceptedNotice` from settings store
3. On first app launch:
   - Check `app_meta.has_accepted_notice` (or Capacitor Preferences)
   - If false: Show transparency notice, block all other navigation
   - On accept: Set flag, persist, navigate to dashboard
4. Re-accessible from Settings → "View Transparency Notice"

**Deliverable**: Mandatory first-run notice that blocks app usage until accepted.

### Agent 3-C: AI Settings Enhancement
**Task**: Build complete AI provider settings with Test Connection.

1. Read docs/04-ai-architecture.md §2
2. Create `src/features/settings/`:
   - `settings-page.tsx` — Full settings page (not just a dialog)
   - `provider-form.tsx` — Add/edit provider form
   - `provider-list.tsx` — List configured providers with active indicator
   - `connection-tester.tsx` — Test connection component with progress, result, latency
3. Provider form fields:
   - Name (label for the provider, e.g., "My GPT-4")
   - Base URL (e.g., `https://api.openai.com/v1`)
   - API Key (password input, stored in Secure Storage)
   - Model Name (e.g., `gpt-4o`, `claude-3.5-sonnet`)
   - Max Tokens (slider, default 4096)
   - Temperature (slider, default 0.7)
   - "Test Connection" button
4. Test Connection flow:
   - Send a minimal test message ("Say 'OK'")
   - Measure round-trip latency
   - Display: ✅ Connected (234ms) / ❌ Failed: [error message]
   - On success: auto-detect model name from response
   - On failure: show helpful error (invalid URL, auth failed, model not found, etc.)
5. Provider management:
   - Add/Edit/Delete providers
   - Set active provider (radio button)
   - At least one provider must be configured before AI features are available
   - If no provider configured: show banner "Configure an AI provider to use interview features"

**Deliverable**: Full settings page with provider CRUD and Test Connection.

### Agent 3-D: PII Redaction System
**Task**: Build runtime PII protection for logs, prompts, and exports.

1. Read docs/13-security-and-privacy.md
2. Create `src/shared/security/`:
   - `pii-patterns.ts` — Regex patterns for Indian PII:
     - Aadhaar: `\d{4}\s?\d{4}\s?\d{4}` → `[AADHAAR_REDACTED]`
     - PAN: `[A-Z]{5}\d{4}[A-Z]` → `[PAN_REDACTED]`
     - Phone: `\d{10}` (in context) → `[PHONE_REDACTED]`
     - Email: standard email regex → `[EMAIL_REDACTED]`
     - Bank account: `\d{9,18}` (in context) → `[ACCOUNT_REDACTED]`
   - `pii-redactor.ts`:
     - `redactPii(text: string): string` — Replace all PII patterns
     - `redactObject(obj: unknown): unknown` — Deep redact all string values in object
     - `isRedacted(text: string): boolean` — Check if text contains redacted markers
   - `log-shield.ts`:
     - Override `console.log`, `console.warn`, `console.error` at app init
     - All log output passes through `redactPii()`
     - Structured logging with redaction
   - `prompt-sanitizer.ts`:
     - `sanitizeForPrompt(profile: ProjectProfile): string` — Minimize PII before sending to AI
     - Strip Aadhaar, PAN, bank details from prompts
     - Keep name and phone only if needed for context
3. Apply redaction:
   - All `console.log()` calls in engines auto-redacted
   - All AI prompts sanitized before sending
   - All export JSON sanitized (double-check API key not included)
   - Error messages redacted before display to user (show generic error, log details with redaction)
4. Add to import/export engine: scan exported JSON for accidental PII leaks

**Deliverable**: Runtime PII redaction in logs, prompts, exports. Zero PII in AI prompts except name/phone.

### Agent 3-E: DPR Number-Integrity Check
**Task**: Build mandatory post-generation financial figure verification.

1. Read docs/07-dpr-engine.md (number-integrity check requirement)
2. Create `src/engines/dpr-engine/number-integrity.ts`:
   - `extractMonetaryValues(text: string): Map<string, number>` — Extract all ₹ figures with context
   - `buildExpectedValues(engineOutputs: EngineOutputs): Map<string, number>` — Map from engine outputs
   - `verifyIntegrity(narrative: string, expected: Map<string, number>): IntegrityResult`
   - `autoCorrect(narrative: string, expected: Map<string, number>): string` — Replace wrong figures
3. `IntegrityResult`:
   - `isClean: boolean` — All figures match
   - `mismatches: Array<{ field, expected, found, context }>` — Diffs
   - `correctedNarrative?: string` — If auto-corrected
4. Integration:
   - Called after AI Writer generates each narrative section
   - If mismatch: auto-correct AND log warning
   - If too many mismatches (>3 in one section): reject AI output, fall back to template
5. Test with known financial outputs → verify every ₹ figure matches

**Deliverable**: Automatic verification that AI-generated prose has correct financial figures.

### Agent 3-F: i18n Foundation
**Task**: Internationalize all user-facing strings.

1. Read CLAUDE.md (strings externalized requirement)
2. Create `src/shared/i18n/`:
   - `en.json` — English translations (extract ALL hardcoded strings)
   - `hi.json` — Hindi translations (PMEGP is an Indian govt scheme)
   - `i18n-config.ts` — Supported locales, default locale
   - `use-translation.ts` — React hook: `const { t } = useTranslation()`
3. Translation structure:
   ```json
   {
     "common": { "save": "Save", "cancel": "Cancel", "next": "Next", "back": "Back", ... },
     "dashboard": { "title": "PMEGP Assistant", "newProject": "New Project", ... },
     "interview": { "phases": { "greeting": "Greeting", "discovery": "Discovery", ... }, ... },
     "guided": { "steps": { "applicant": "Applicant Information", ... }, ... },
     "engines": { "validation": "Validation", "eligibility": "Eligibility Check", ... },
     "settings": { "title": "Settings", "provider": "AI Provider", ... },
     "errors": { "generic": "Something went wrong", "network": "Network error", ... }
   }
   ```
4. Language detection: Use device locale (Capacitor `Device.getLanguageCode()`)
5. Language switching: Settings → Language selector
6. Replace ALL hardcoded strings in components with `t('key')`
7. Number formatting: Use locale-aware formatters (₹ in India, date formats)

**Deliverable**: All strings externalized. English + Hindi. Locale detection and switching.

---

## PHASE 4: Data Model & Knowledge Package (4 agents, parallel)
**Depends on: Phase 0-C (database layer)**

### Agent 4-A: Complete Knowledge Package
**Task**: Add ALL missing reference data specified in docs/09-knowledge-package.md.

1. Read docs/09-knowledge-package.md and docs/reference/pmegp-scheme-values-reference.md
2. Create missing data files in `src/knowledge-package/data/`:
3. `rules/pmegp_rules.json`:
   ```json
   {
     "version": "2024.1.0",
     "source": "KVIC Guidelines 2024",
     "costCeilings": { "manufacturing": 50000000, "service": 25000000 },
     "subsidyRates": { "general": { "manufacturing": 0.25, "service": 0.25 }, "special": { "manufacturing": 0.35, "service": 0.35 } },
     "ownContribution": { "general": 0.10, "special": 0.05 },
     "ageLimits": { "min": 18, "max": 65 },
     "education": { "highCostThreshold": 1000000, "minEducation": "8th pass" },
     "loanTerms": { "termLoanMonths": { "default": 84, "max": 120 }, "workingCapitalMonths": 60, "moratoriumMonths": 6 },
     "dscr": { "minimum": 1.5 },
     "edp": { "required": true, "warningOnly": true }
   }
   ```
4. `banks.json` — List of major Indian banks with branch types relevant to PMEGP:
   - SBI, PNB, Bank of Baroda, Canara Bank, Union Bank, Indian Bank, etc.
   - Fields: name, type (public/private), pmegp_eligible, typical_max_loan
5. `templates/dpr_sections.json` — Template structure for each DPR section with placeholders
6. `templates/narrative_templates/`:
   - `project_description.md` — Template prose for project description
   - `market_analysis.md` — Template for market analysis
   - `technical_details.md` — Template for technical details
   - `financial_justification.md` — Template with financial figure placeholders
7. `knowledge/faq.json` — 20+ PMEGP FAQs with answers
8. `knowledge/circulars.json` — Recent KVIC circulars (dates, summaries, implications)
9. `knowledge/glossary.json` — PMEGP terminology (EMI, DSCR, TPC, margin money, etc.)
10. `financial_ratios.json` — Industry benchmark ratios by sector for comparison
11. `validation_rules.json` — Field-level validation rules (min/max, required when, format)
12. `prompt_templates/system_prompts.json` — System prompts for interview, writer, reviewer
13. `metadata.json`:
    ```json
    { "knowledge_version": "2024.1.0", "source": "KVIC/NSIC 2024", "last_updated": "2024-07-01", "schema_version": "1.0.0" }
    ```
14. Update `src/knowledge-package/loader.ts` to load all new files
15. Update `src/knowledge-package/types.ts` with types for all new data
16. Organize into subfolders: `data/rules/`, `data/banks/`, `data/templates/`, `data/knowledge/`

**Deliverable**: Complete knowledge package with all reference data from docs/09.

### Agent 4-B: Scheme-Parameterize Engines
**Task**: Remove ALL hardcoded PMEGP constants from engines, read from Knowledge Package.

1. Read `pmegp_rules.json` (from 4-A) and current engine code
2. Financial Engine (`src/engines/financial-engine/index.ts`):
   - Remove hardcoded subsidy rates (lines ~56-65, ~96-101)
   - Remove hardcoded cost ceilings
   - Remove hardcoded own-contribution percentages
   - Remove hardcoded loan term defaults
   - Accept `SchemeFinancialParams` from Knowledge Package as input parameter
   - Add `asOfDate: string` parameter for provenance
   - Every constant traced to `pmegp_rules.json` source + version
3. Eligibility Engine (`src/engines/eligibility-engine/index.ts`):
   - Remove hardcoded age limits
   - Remove hardcoded cost ceilings
   - Remove hardcoded education threshold
   - Accept `SchemeEligibilityParams` from Knowledge Package
   - Add `asOfDate` parameter
   - Add `source` field to each check: `{ clause: "PMEGP Guidelines §4.2", version: "2024.1.0" }`
4. Validation Engine: Read validation rules from `validation_rules.json`
5. Update all engine tests to inject scheme params instead of relying on hardcoded defaults
6. Add provenance: Each engine output includes `computedUsing: { knowledgeVersion, asOfDate }`

**Deliverable**: Zero hardcoded PMEGP constants in engines. All from Knowledge Package with version provenance.

### Agent 4-C: Negative List Real Implementation
**Task**: Replace stubbed negative list check with real implementation.

1. Read docs/06-eligibility-engine.md and `pmegp_negative_list.json`
2. Current state: Eligibility engine negative list check always passes (stubbed)
3. Implement real check:
   - Load negative list from Knowledge Package
   - Fuzzy keyword matching: Extract keywords from business description
   - Match against negative list categories and items
   - Handle partial matches (e.g., "beedi" matches "Beedi manufacturing")
   - Ambiguity handling: If match confidence < 80%, add as WARNING not BLOCKER
   - Source citation: Include which negative list item triggered the match
4. Update eligibility result:
   - `checks[]` includes negative list check with `source: { clause: "Negative List Item #23", category: "Manufacturing" }`
   - `blockers[]` includes high-confidence matches
   - `warnings[]` includes ambiguous matches with "Please verify manually" message
5. Write comprehensive tests:
   - Clear negative list hit → BLOCKER
   - Partial match → WARNING
   - No match → PASS with source citation
   - Empty description → SKIP with warning
6. Add negative list items from KVIC guidelines if missing from JSON

**Deliverable**: Working negative list check with fuzzy matching, ambiguity warnings, source citations.

### Agent 4-D: Complete Data Model & Repositories
**Task**: Ensure all 18+ database tables from docs/03 are implemented with full CRUD.

1. Read docs/03-data-model.md completely
2. Verify all tables from Phase 0-C are implemented correctly
3. Add any missing tables/columns:
   - `project` — Ensure ALL fields from doc spec
   - `project_financials` — ALL money as INTEGER (paise), ALL engine outputs stored
   - `dpr_document` — Serialized DPR with metadata (knowledge_version, template_id, ai_used, financials_snapshot_id)
   - `attachment` — File metadata for OCR source documents
   - `scheme` — Scheme parameters with version
   - `rule_set` — Rules with effective dates
   - `activity` — Permitted activities catalog
   - `prompt_template` — AI prompt templates
4. Create/update repositories:
   - `project-repository.ts` — Full CRUD with Zod, search, filter
   - `financials-repository.ts` — Snapshot storage, retrieval by project
   - `dpr-repository.ts` — DPR storage, version history
   - `attachment-repository.ts` — File storage (device filesystem via Capacitor Filesystem)
   - `scheme-repository.ts` — Current scheme parameters
   - `rule-repository.ts` — Current rule set with version
   - `app-meta-repository.ts` — Key-value app state
5. Knowledge version tracking:
   - On engine execution: record `knowledge_version` used
   - On knowledge update: record new version, don't invalidate old project snapshots
6. Reproducibility invariant: Each engine output snapshot includes `knowledge_version + template_id + input_hash`

**Deliverable**: All 18+ tables with repositories. Knowledge version tracking on every engine output.

---

## PHASE 5: Testing (4 agents, parallel)
**Depends on: Phases 1-4**

### Agent 5-A: Worked-Example Fixtures
**Task**: Create hand-verified test fixtures for every engine.

1. Read docs/14-testing-strategy.md
2. Create `src/engines/__test-fixtures__/`:
   - `manufacturing-project.json` — Complete ProjectProfile for a manufacturing unit (e.g., "Raju Paper Cups Manufacturing")
     - Applicant: 35-year-old general category male, 8th pass
     - Business: Paper cups manufacturing, NIC Code 22209, urban area
     - Land: Owned, ₹5,00,000
     - Machinery: Paper cup making machine (₹3,00,000), printing machine (₹1,50,000)
     - Raw materials: Paper rolls, ink, packing material
     - Employees: 4 skilled (₹12,000/month), 2 unskilled (₹8,000/month)
     - Capacity: 50,000 cups/month
   - `service-project.json` — Complete ProjectProfile for a service business
   - `edge-case-max-subsidy.json` — Special category, max cost ceiling, max subsidy
   - `edge-case-min-age.json` — 18-year-old applicant
   - `edge-case-negative-list.json` — Business on negative list
   - `edge-case-ineligible-entity.json` — LLP or other restricted entity type
3. Create `expected-outputs/`:
   - For each fixture: hand-calculate expected financial outputs
   - `manufacturing-project-expected.json`:
     ```json
     {
       "totalProjectCost": 2500000,  // in paise
       "subsidyRate": 2500,  // 25% in basis points
       "subsidyAmount": 625000,
       "ownContribution": 250000,
       "bankTermLoan": 1625000,
       "emi": ...,  // hand-calculated
       "dscr": ...,
       "breakEvenPercent": ...
     }
     ```
4. Create helper: `src/engines/__test-fixtures__/load-fixture.ts`:
   - `loadFixture(name): { profile: ProjectProfile, expected: ExpectedOutputs }`

**Deliverable**: 6+ hand-verified fixtures with calculated expected outputs.

### Agent 5-B: Engine Integration & Determinism Tests
**Task**: Test full pipeline and engine determinism.

1. Create `src/engines/integration/__tests__/pipeline.test.ts`:
   - Test: Profile → Validation → Eligibility → Financial → DPR → PDF
   - Use manufacturing-project fixture
   - Verify each step's output is valid
   - Verify pipeline status transitions correctly
2. Create `src/engines/integration/__tests__/determinism.test.ts`:
   - Run financial engine 10 times with same input
   - Assert identical outputs every time
   - Run DPR engine 10 times with same input
   - Assert identical outputs
3. Create `src/engines/integration/__tests__/reconciliation.test.ts`:
   - Verify: TPC = own_contribution + bank_finance + subsidy
   - Verify: DSCR ≥ 1.5 for eligible projects
   - Verify: Break-even < 100% for viable projects
4. Create `src/engines/integration/__tests__/boundary-enforcement.test.ts`:
   - Validation gate: Run financial engine on invalid profile → should fail
   - Validation gate: Run eligibility on incomplete profile → should fail
   - Zod boundary: Send malformed data to each engine → should return error
5. Create `src/engines/integration/__tests__/knowledge-version.test.ts`:
   - Run engine with knowledge v1, record output
   - Simulate knowledge v2 (different subsidy rate)
   - Run engine again, verify output differs
   - Verify old snapshot still valid

**Deliverable**: Integration tests covering pipeline, determinism, reconciliation, boundaries, knowledge versioning.

### Agent 5-C: Security Tests
**Task**: Test all security requirements from docs/13.

1. Create `src/__tests__/security/api-key-leak.test.ts`:
   - Export project → scan for API key → must NOT be present
   - Log output during interview → scan for API key → must be redacted
   - Error response from API → must not contain API key
   - Backup file → scan for API key → must NOT be present
2. Create `src/__tests__/security/pii-redaction.test.ts`:
   - Log Aadhaar number → verify redacted in console output
   - Log PAN → verify redacted
   - AI prompt content → verify Aadhaar/PAN stripped
   - Export JSON → verify Aadhaar/PAN present (user's own data), but API key absent
3. Create `src/__tests__/security/input-sanitization.test.ts`:
   - Prompt injection in user chat → AI should not execute injected instructions
   - XSS in project name → rendered as text, not HTML
   - SQL injection in search fields → parameterized queries prevent it
   - Malformed JSON in import → Zod rejects with clear error
4. Create `src/__tests__/security/untrusted-ocr.test.ts`:
   - OCR extracts fake Aadhaar → should be flagged for human review
   - OCR extracts monetary values → should not auto-accept without confirmation

**Deliverable**: Security test suite covering API key leaks, PII redaction, input sanitization, OCR trust.

### Agent 5-D: UI Component Tests & E2E
**Task**: Test UI components and end-to-end flows.

1. Create `src/components/__tests__/guided-form.test.tsx`:
   - Render each step, fill form, verify validation
   - Test step navigation (next/back)
   - Test Zod error display
   - Test auto-advance on valid input
2. Create `src/components/__tests__/settings.test.tsx`:
   - Add provider form
   - Test Connection flow (mock API)
   - Provider list CRUD
3. Create `src/components/__tests__/dashboard.test.tsx`:
   - Project list rendering
   - Project card actions
   - Stat cards display
4. Create `e2e/` folder with Playwright tests:
   - `e2e/full-workflow.spec.ts`:
     - Create project → Guided form → Fill all steps → Submit → Pipeline runs → PDF generated
   - `e2e/ai-interview.spec.ts`:
     - Create project → Start interview → Chat through phases → Complete → Pipeline
   - `e2e/import-export.spec.ts`:
     - Create project → Export → Delete → Import → Verify restored
   - `e2e/android-device.spec.ts` (if Android emulator available):
     - Test on Android device/emulator
     - Test back button behavior
     - Test orientation change
     - Test offline behavior (airplane mode)

**Deliverable**: Component tests + Playwright E2E tests covering all major flows.

---

## PHASE 6: Folder Structure & Lint Rules (2 agents, parallel)
**Depends on: All previous phases**

### Agent 6-A: Folder Restructure
**Task**: Reorganize codebase to match docs/02-modules-and-folder-structure.md exactly.

1. Read docs/02-modules-and-folder-structure.md
2. Target structure:
   ```
   src/
   ├── app/                          # (Vite: this is just App.tsx + routes/)
   ├── features/
   │   ├── ai/                       # ✅ Exists — interview orchestrator, store
   │   ├── project-profile/          # NEW — profile viewing/editing components
   │   ├── guided-form/              # NEW from Phase 3-A
   │   ├── dpr/                      # NEW — DPR viewing, section navigation
   │   ├── financial/                # NEW — financial summaries, charts
   │   ├── eligibility/              # NEW — eligibility results display
   │   ├── pdf/                      # NEW — PDF preview, generation, sharing
   │   ├── knowledge/                # NEW — knowledge browser, NIC code search
   │   ├── ocr/                      # NEW — OCR capture, review, mapping
   │   ├── settings/                 # NEW from Phase 3-C
   │   ├── import-export/            # NEW — backup/restore UI
   │   └── onboarding/               # NEW from Phase 3-B
   ├── engines/
   │   ├── validation-engine/        # ✅
   │   ├── financial-engine/         # ✅
   │   ├── eligibility-engine/       # ✅
   │   ├── knowledge-engine/         # ✅
   │   ├── dpr-engine/               # ✅
   │   ├── pdf-engine/               # ✅
   │   ├── ocr-engine/               # ✅ (needs real implementation)
   │   ├── ai-writer-engine/         # NEW from Phase 2-B
   │   ├── import-export-engine/     # NEW from Phase 2-A
   │   ├── project-engine/           # NEW from Phase 2-C
   │   └── update-engine/            # NEW from Phase 2-D
   ├── providers/
   │   ├── provider-manager.ts       # NEW from Phase 1-E
   │   ├── types.ts                  # NEW from Phase 1-E
   │   └── adapters/
   │       ├── openai-compatible.ts  # NEW from Phase 1-E
   │       └── builtin-sdk.ts        # NEW from Phase 1-E
   ├── database/
   │   └── sqlite/
   │       ├── connection.ts         # NEW from Phase 0-C
   │       ├── migrations/           # NEW from Phase 0-C
   │       └── repositories/         # NEW from Phase 0-C
   ├── knowledge-package/
   │   ├── data/                     # ✅ (expanded in Phase 4-A)
   │   ├── metadata.json             # NEW from Phase 4-A
   │   ├── loader.ts                 # ✅ (updated)
   │   └── types.ts                  # ✅ (updated)
   ├── shared/
   │   ├── types/                    # ✅
   │   ├── schemas/                  # ✅
   │   ├── events/                   # ✅
   │   ├── utils/                    # NEW — money.ts, formatters.ts
   │   ├── security/                 # NEW — pii-redactor.ts, log-shield.ts
   │   ├── validation/               # NEW — boundary-guards.ts
   │   └── i18n/                     # NEW from Phase 3-F
   ├── stores/                       # NEW from Phase 1-C (Zustand)
   ├── hooks/                        # NEW from Phase 1-D (TanStack Query)
   ├── components/
   │   └── ui/                       # ✅ (shadcn)
   └── __tests__/                    # NEW — security tests
   ```
3. Move existing components into proper feature folders:
   - `components/dashboard/*.tsx` → split into `features/*/` based on responsibility
   - `components/interview/*.tsx` → `features/ai/`
   - `components/dashboard/nic-code-search.tsx` → `features/knowledge/`
   - `components/dashboard/settings-dialog.tsx` → `features/settings/`
4. Update ALL import paths after moves
5. Verify: `bun run lint` passes with zero errors

**Deliverable**: Folder structure matches docs/02 exactly. All imports updated.

### Agent 6-B: Import Boundary Lint Rule
**Task**: Enforce dependency direction with ESLint.

1. Read AGENTS.md dependency rule:
   - `engines/` → may ONLY import from `shared/`, `knowledge-package/`
   - `providers/` → may ONLY import from `shared/`
   - `features/` → may import from `engines/`, `providers/`, `shared/`, `stores/`, `hooks/`, `components/ui/`
   - `features/` → MUST NOT import from other `features/`
   - `components/` → may ONLY import from `shared/`, `components/ui/`, `stores/`, `hooks/`
2. Create `eslint-rules/no-cross-feature-import.ts`:
   - Custom ESLint rule that checks import sources
   - Error if engine imports from features/ or providers/
   - Error if provider imports from engines/
   - Error if feature imports from another feature
   - Error if component imports from engines/ or features/ (except via hooks)
3. Add to ESLint config
4. Fix any existing violations
5. Add CI check: lint must pass before merge

**Deliverable**: Custom ESLint rule enforcing dependency direction. Zero violations.

---

## PHASE 7: Real OCR (2 agents, sequential)
**Depends on: Phase 0 (Capacitor)**

### Agent 7-A: ML Kit OCR Integration
**Task**: Replace mock OCR with real on-device OCR via ML Kit.

1. Read docs/11-ocr-architecture.md
2. Install: `@capacitor-mlkit/text-recognition` or equivalent Capacitor ML Kit plugin
3. Replace `src/engines/ocr-engine/index.ts`:
   - `captureImage(): Promise<CaptureResult>` — Open camera via `@capacitor/camera`, capture image
   - `extractText(imagePath: string): Promise<OcrResult>` — ML Kit text recognition
   - `extractFields(text: string, docType: DocumentType): FieldExtractionResult` — Keep existing extraction logic
   - `mapToProfile(fields: ExtractedFields, docType: DocumentType): ProfilePartial` — Keep existing mapping
4. Document types supported:
   - Quotation/Invoice → machinery items, costs, vendor details
   - Identity proof → name, DOB, Aadhaar/PAN
   - Land document → land status, area, ownership
   - EDP certificate → training completion
   - Address proof → address details
5. Human review screen: After OCR extraction, show extracted fields with confidence scores
   - User confirms/corrects each field
   - Low-confidence fields highlighted in yellow
   - "Accept All" or "Edit" per field
6. Privacy: OCR images processed on-device only, never uploaded
7. Storage: Captured images stored via `@capacitor/filesystem`, referenced by path in attachments table

**Deliverable**: Real on-device OCR with camera capture, field extraction, human review.

### Agent 7-B: OCR UI Components
**Task**: Build OCR capture and review UI.

1. Create `src/features/ocr/`:
   - `capture-screen.tsx` — Camera viewfinder with document type selector
   - `review-screen.tsx` — Extracted fields review with edit/confirm
   - `attachment-list.tsx` — List of captured documents for a project
2. Camera UI:
   - Document type selector (dropdown): Quotation, Identity, Land, EDP, Address
   - Camera viewfinder with document frame overlay
   - Capture button, flash toggle
   - Auto-capture when document detected in frame (optional)
3. Review UI:
   - Card per extracted field: label, value (editable), confidence indicator
   - Confidence: Green (≥90%), Yellow (70-89%), Red (<70%)
   - "Auto-fill Profile" button to apply confirmed fields
4. Integration: Accessible from interview chat ("Attach document" button) and guided form (per-step attachment)

**Deliverable**: Complete OCR UI with camera capture and human review workflow.

---

## EXECUTION SUMMARY

| Phase | Agents | Dependencies | Est. Time |
|-------|--------|-------------|-----------|
| 0: Platform Migration | 3 (sequential) | None | Longest |
| 1: Code Quality | 5 (parallel) | Phase 0 | Medium |
| 2: Missing Engines | 4 (parallel) | Phase 0, 1 | Medium |
| 3: Missing Features | 6 (parallel) | Phase 1, 2 | Medium |
| 4: Data & Knowledge | 4 (parallel) | Phase 0-C | Medium |
| 5: Testing | 4 (parallel) | Phases 1-4 | Medium |
| 6: Structure & Lint | 2 (parallel) | All | Short |
| 7: Real OCR | 2 (sequential) | Phase 0 | Medium |
| **TOTAL** | **30 agents** | | |

### Post-Completion Verification
After ALL phases, run this checklist:
- [ ] `bun run lint` — Zero errors
- [ ] `bun test` — All tests pass
- [ ] `npx cap sync android` — Android project builds
- [ ] Every doc requirement mapped to code (check traceability-matrix.md)
- [ ] Zero hardcoded PMEGP constants in engines
- [ ] Zero floating-point money values
- [ ] Zero `any` types at boundaries
- [ ] Zod `.safeParse()` at every engine entry and repository write
- [ ] Guided form produces identical ProjectProfile as AI interview
- [ ] Import/export round-trip test passes
- [ ] PII redaction test passes
- [ ] API key never in logs, exports, or SQLite
- [ ] Knowledge version tracked on every engine output
- [ ] First-run notice shows on fresh install
- [ ] Test Connection works in Settings