# PMEGP Assistant — Stage B Complete Implementation Prompt
## For GLM 5.2 + 100+ Sub-Agent Parallel Execution

---

## 🎯 MISSION

**Transform the Next.js web app into a production-ready, offline-first, AI-first Capacitor 7 Android application.**

**Repository:** `https://github.com/pavan53732/pmegp-assistant-app` (main branch — already cloned)  
**Working Branch:** `main` (direct commits — GLM 5.2 runs in own environment)  
**Audit Reference:** `AUDIT_REPORT.md` in repo (Stage A + A.1 forensic findings)  
**Target:** Signed APK, fully functional offline, zero backend dependency

---

## ⚡ EXECUTION MODEL

- **100+ sub-agents** — assign each atomic task to independent agents
- **Zero sequential dependencies** — maximize parallelism
- **Shared branch** — all agents commit directly to `main`
- **Direct push** — no PR bottleneck; main is the working branch
- **Definition of Done** — each agent group delivers tested, linted, documented code

> **Note:** If running inside Arena.ai Agent Mode, the session may be locked to a specific branch (e.g., `arena/019f8644-pmegp-assistant-app`). In that case, work on that branch and open PR to main. For standalone GLM 5.2 execution, direct main branch commits are fine.

---

## 🚫 NON-NEGOTIABLE ARCHITECTURAL INVARIANTS

| Invariant | Enforcement |
|-----------|-------------|
| **No backend of any kind** | `rg "fetch\|axios\|http" src/` → ONLY `providers/` + Capacitor plugins |
| **No Prisma** | `package.json` — zero `@prisma/client` |
| **No pdfkit** | `package.json` — zero `pdfkit` |
| **No Next.js** | `package.json` — zero `next`, `next-auth`, `next-intl` |
| **Money = integer (rupees)** | `rg "parseFloat\|toFixed\|Number\(" src/engines/` → zero results |
| **Import boundaries** | Custom ESLint rule: `engines/` imports NOT `features/`, `providers/` |
| **API key never logged** | `rg "console\.(log\|error\|warn).*apiKey"` → zero results |
| **PII never in logs** | `rg "console\.(log\|error\|warn).*(aadhaar\|pan\|phone\|email)"` → zero results |
| **Signed KP updates only** | Update Engine verifies Ed25519 before apply |
| **Deterministic engines** | No `Date.now()`, `Math.random()`, `crypto.randomUUID()` in `engines/` |
| **SQLite encrypted at rest** | SQLCipher via `@capacitor-community/sqlite` |
| **API key in Secure Storage** | `@capacitor/secure-storage` → Android Keystore |

---

## 📦 PHASE 0: ARCHITECTURAL CORRECTION (Parallel Agent Groups)

### Agent Group A — Capacitor + Vite Migration
**Deliverable:** Complete Vite + React 19 + Capacitor 7 project replacing Next.js

```
pmegp-assistant-app/
├── android/                          # Generated: npx cap add android
├── public/
├── src/
│   ├── app/                          # App shell, routing, providers, first-run notice
│   ├── features/                     # 8 feature modules (see Phase 3)
│   ├── engines/                      # 10 engines (see Phase 1)
│   ├── providers/                    # ONLY network code
│   ├── database/                     # SQLite only
│   ├── knowledge-package/            # Bundled JSON (unchanged)
│   └── shared/                       # Types, utils, UI, i18n
├── capacitor.config.ts               # All 6 plugins configured
├── vite.config.ts                    # React, TS strict, path aliases
├── tsconfig.json
├── package.json                      # Clean deps (see below)
└── .github/workflows/                # CI pipeline
```

**package.json — Exact Dependencies:**
```json
{
  "dependencies": {
    "@capacitor/android": "^7.0.0",
    "@capacitor/app": "^7.0.0",
    "@capacitor/camera": "^7.0.0",
    "@capacitor/community-sqlite": "^6.0.0",
    "@capacitor/filesystem": "^7.0.0",
    "@capacitor/preferences": "^7.0.0",
    "@capacitor/secure-storage": "^7.0.0",
    "@capacitor/share": "^7.0.0",
    "@capacitor/splash-screen": "^7.0.0",
    "@capacitor/status-bar": "^7.0.0",
    "@hookform/resolvers": "^5.0.0",
    "@radix-ui/react-*": "latest",
    "@tanstack/react-query": "^5.0.0",
    "pdf-lib": "^1.17.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-hook-form": "^7.52.0",
    "recharts": "^2.12.0",
    "tailwind-merge": "^2.0.0",
    "tailwindcss-animate": "^1.0.0",
    "zod": "^3.23.0",
    "zustand": "^4.5.0",
    "z-ai-web-dev-sdk": "^0.0.18"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "playwright": "^1.45.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0"
  }
}
```

**Capacitor Config — Exact:**
```typescript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pmegp.assistant',
  appName: 'PMEGP Assistant',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: {
    SQLite: { databaseName: 'pmegp.db', encrypted: true, mode: 'no-encryption' }, // encryption via SQLCipher at native layer
    Camera: { permissions: ['camera'] },
    Filesystem: { iosDocumentStorageDirectory: 'Documents' },
    SecureStorage: { iosKeychainAccessible: 'WhenUnlockedThisDeviceOnly' },
    Share: {},
    SplashScreen: { launchShowDuration: 2000, backgroundColor: '#064e3b' },
    StatusBar: { style: 'dark', backgroundColor: '#064e3b' }
  }
};
export default config;
```

**Actions:**
- Delete `src/app/api/` entirely (9 route files)
- Delete `src/lib/db.ts`, `src/lib/interview-api.ts`, `src/lib/pipeline-api.ts`, `src/services/`
- Delete `next.config.ts`, `components.json`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create Vite entry: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/routes.tsx`
- Configure Tailwind v4 + shadcn/ui for Vite
- All agents commit to `arena/019f8644-pmegp-assistant-app`

---

### Agent Group B — Database Migration (Prisma → Capacitor SQLite + SQLCipher)
**Deliverable:** `src/database/sqlite/` with encrypted DB, zero Prisma

**Files to Create:**
```
src/database/sqlite/
├── connection.ts          # openDB('pmegp.db', { encrypted: true, key: await SecureStorage.get('db_key') })
├── schema.ts              # CREATE TABLE statements (see below)
├── migrations.ts          # versioned upgrades (v1 → v2 → v3...)
├── repositories.ts        # implements IProjectRepository (from database/interfaces.ts)
├── index.ts               # exports: getDB(), getProjectRepository()
└── types.ts               # Row types matching ProjectProfile JSON structure
```

**Exact Schema (SQLite):**
```sql
-- Projects: single source of truth
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'EMPTY','PARTIAL','DISCOVERING','COMPLETE',
    'REVIEW_PENDING','VALIDATED','ELIGIBILITY_READY',
    'FINANCIAL_READY','DPR_READY'
  )),
  profile_data TEXT NOT NULL,       -- JSON: ProjectProfile
  provenance_data TEXT NOT NULL,    -- JSON: ProvenanceMetadata
  completion_data TEXT NOT NULL,    -- JSON: Completion
  chat_history TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,         -- ISO8601
  updated_at TEXT NOT NULL
);

-- AI Provider Config: API key stored in Secure Storage ONLY
CREATE TABLE ai_provider_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_url TEXT NOT NULL,
  model_name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- App Meta: key-value for versioning
CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Seeded keys: 'knowledge_version', 'first_run_ack', 'schema_version', 'last_update_check'
```

**Repository Implementation (ports `database/project-repository.ts`):**
- Remove import: `@/features/ai/interview/types` (violates boundary)
- `chatHistory` stored as JSON string in `projects.chat_history`
- All methods use parameterized queries, no ORM
- `getProjectRepository()` returns singleton

**Migration from Prisma (one-time):**
- Agent B1 writes migration script: read Prisma `project` table → insert into new SQLite schema
- Run once on first app launch if `schema_version` < current

---

### Agent Group C — PDF Engine Rewrite (pdfkit → pdf-lib)
**Deliverable:** `engines/pdf-engine/index.ts` — client-side, zero Node.js deps

**Requirements:**
- Input: `DprDocument` (from `engines/dpr-engine`)
- Output: `ArrayBuffer` (PDF bytes)
- Zero `fs`, `stream`, `buffer`, `path` imports
- Bundled fonts: Noto Sans (Latin), Noto Sans Devanagari (future i18n)
- Sections: Cover → TOC → 18 DPR sections → Financial Summary → Eligibility Assessment
- Tables: Auto-pagination for long schedules (repayment, P&L)
- Headers/footers/page numbers on all pages except cover
- "CONFIDENTIAL" watermark diagonal
- Deterministic: same `DprDocument` → byte-identical `ArrayBuffer`

**API (unchanged):**
```typescript
export async function generatePdf(dpr: DprDocument): Promise<ArrayBuffer>;
export function printDpr(dpr: DprDocument): void; // logs "PDF generated"
```

---

### Agent Group D — OCR Engine Rewrite (Mock → Camera + ML Kit)
**Deliverable:** `engines/ocr-engine/index.ts` — on-device, offline

**Capacitor Plugins:** `@capacitor/camera` + ML Kit (via `@capacitor-community/mlkit` or bundled Tesseract WASM)

**Flow:**
```
Camera.capturePhoto({ quality: 90, resultType: 'base64', source: 'camera' })
  → ML Kit text recognition (on-device)
  → Field extraction via regex (same patterns as mock)
  → PII masking BEFORE any return
  → Returns OcrResult with source="OCR", verification="UNVERIFIED"
```

**API (unchanged):**
```typescript
export async function extractFromDocument(
  source: 'camera' | 'gallery',
  documentType: AttachmentType
): Promise<OcrResult>;

export function mapOcrToProfile(ocrResult: OcrResult, documentType: AttachmentType): Partial<ProjectProfile>;
```

**Supported Document Types:** `QUOTATION`, `IDENTITY_PROOF`, `ADDRESS_PROOF`, `LAND_DOCUMENT`, `EDP_CERTIFICATE`, `OTHER`

---

### Agent Group E — Pipeline Service Removal + Direct Engine Calls
**Deliverable:** All feature code calls engines directly — zero HTTP

**Delete:** `src/services/pipeline-service.ts`, `src/lib/pipeline-api.ts`, `src/lib/interview-api.ts`

**Pattern (in features):**
```typescript
// BEFORE (HTTP):
const result = await fetch('/api/projects/123/pipeline');

// AFTER (direct):
import { computeFinancials } from '@/engines/financial-engine';
import { checkEligibility } from '@/engines/eligibility-engine';
import { generateDPR } from '@/engines/dpr-engine';
import { generatePdf } from '@/engines/pdf-engine';

const financials = computeFinancials(profile);
const eligibility = checkEligibility(profile);
const dpr = generateDPR(profile, financials, eligibility);
const pdf = await generatePdf(dpr);
```

**Files to Update:** All `features/ai/`, `features/*/` — replace HTTP calls with direct imports

---

### Agent Group I — Import/Export Engine (NEW)
**Path:** `engines/import-export-engine/index.ts`

```typescript
export interface ExportProjectResult {
  schemaVersion: '1.0';
  schemeCode: 'PMEGP';
  knowledgeVersion: string;
  exportedAt: string; // ISO8601
  project: ProjectProfile;
  financialsSnapshot: FinancialResult;
  eligibilitySnapshot: EligibilityResult;
  attachments: AttachmentRef[];
}

export interface ImportExportEngine {
  exportProject(profile: ProjectProfile, financials: FinancialResult, eligibility: EligibilityResult): ExportProjectResult;
  importProject(json: string): { profile: ProjectProfile; financials: FinancialResult; eligibility: EligibilityResult };
  backupDatabase(): Promise<ArrayBuffer>;           // Encrypted full SQLite
  restoreDatabase(encryptedBackup: ArrayBuffer): Promise<void>;
}
```

**Security (MANDATORY):**
- API key **NEVER** in export/backup
- Backup: AES-256-GCM, key from Secure Storage
- Import: Zod validate → reject if invalid (no partial apply)
- Restore: User confirmation required, atomic replace

---

### Agent Group J — Update Engine (NEW)
**Path:** `engines/update-engine/index.ts`

```typescript
export interface DataPackManifest {
  version: string;
  schemeCode: 'PMEGP';
  files: { path: string; sha256: string }[];
  signature: string;        // Ed25519 of manifest JSON
  publicKeyId: string;      // Key rotation
}

export interface UpdateEngine {
  checkForUpdate(): Promise<{ available: boolean; manifest?: DataPackManifest }>;
  downloadPack(manifest: DataPackManifest): Promise<ArrayBuffer>;
  verifyAndApply(pack: ArrayBuffer, manifest: DataPackManifest): Promise<void>;
  getCurrentKnowledgeVersion(): string;
}
```

**Verification Flow (ATOMIC):**
1. Fetch manifest from CDN (HTTPS)
2. Verify Ed25519 signature against bundled public key
3. Download pack → stream SHA256 each file vs manifest
4. Transaction: all tables updated or full rollback
5. Update `app_meta.knowledge_version` ONLY on success
6. **Never rewrite existing DPRs** — they retain generation `knowledgeVersion`

**Bundled Public Key:** Embedded in `src/engines/update-engine/public-key.pem`

---

### Agent Group K — Project Engine (NEW)
**Path:** `engines/project-engine/index.ts`

```typescript
export interface ProjectEngine {
  createProject(name: string): ProjectProfile;
  inferState(profile: ProjectProfile): ProjectStatus;
  canEdit(profile: ProjectProfile, targetStatus: ProjectStatus): boolean;
  applyEdit(profile: ProjectProfile, edits: FieldEdit[]): ProjectProfile;
  getStaleSnapshots(profile: ProjectProfile): StaleSnapshotInfo[];
}
```

**State Machine (doc 16§11):**
```
EMPTY → PARTIAL → DISCOVERING → COMPLETE → REVIEW_PENDING → VALIDATED
  → ELIGIBILITY_READY → FINANCIAL_READY → DPR_READY
```
- Edit transitions backward, invalidate downstream, preserve stale snapshots
- Forward: one step at a time, re-run each engine

---

## 📋 PHASE 1: CORE ENGINES — PRESERVE EXISTING (Copy As-Is)

**Agent Groups T1-T7 — Zero Changes, Add Tests Only**

| Engine | Path | Status |
|--------|------|--------|
| Validation | `engines/validation-engine/` | ✅ Production-ready |
| Financial | `engines/financial-engine/` | ✅ Production-ready |
| Eligibility | `engines/eligibility-engine/` | ✅ Production-ready |
| Knowledge | `engines/knowledge-engine/` | ✅ Production-ready |
| DPR | `engines/dpr-engine/` | ✅ Functional, needs unit tests |

**Action:** Copy to new `src/engines/` structure — fix import paths to `@/` aliases only

---

## 📋 PHASE 2: AI LAYER COMPLETION (Parallel)

### Agent Group W — AI Writer + Number-Injection Guard
**Path:** `features/ai/writer/index.ts`

```typescript
export async function generateNarrative(
  input: { financials: FinancialResult; eligibility: EligibilityResult; profile: ProjectProfile; templateId: string },
  providerConfig: ProviderConnectionConfig
): Promise<{ sections: Record<string, string>; provenance: Record<string, string> }> {
  // 1. Inject computed figures as NON-NEGOTIABLE tokens:
  //    {{TOTAL_PROJECT_COST}}, {{SUBSIDY_AMOUNT}}, {{EMI}}, {{DSCR}}, {{BREAK_EVEN}}, etc.
  // 2. Call provider with system prompt + tokens + section instructions
  // 3. POST-GENERATION VERIFICATION (MANDATORY):
  //    - Extract ALL numbers from prose (regex: ₹[\d,]+ | \d+\.?\d*% | \d+\.?\d*x)
  //    - Compare EVERY figure to input financials/eligibility
  //    - Mismatch → regenerate section (max 3 retries)
  // 4. Return verified prose + provenance
}
```

**Number-Injection Guard (CI Test):**
- Feed known `FinancialResult` → assert every figure in prose matches engine output
- Corrupt prose (₹7,00,000 → ₹70,000) → assert rejection

---

### Agent Group G — Guided Forms Fallback (Complete Wizard)
**Paths:** `features/project-profile/`, `features/financial/`, `features/eligibility/`, `features/dpr/`, `features/pdf/`, `features/knowledge/`, `features/ocr/`, `features/settings/`

**Architecture:**
- React Hook Form + Zod (`projectProfileSchema` from `shared/types/schemas`)
- Driven by **same** `PHASE_CONFIGS` as AI interview (`features/ai/interview/question-planner.ts`)
- Knowledge Engine suggestions pre-populate fields (source="KNOWLEDGE")
- Validation: Zod + `ValidationEngine` (identical to AI path)
- Review step: Same summary UI as AI Review phase
- Confirm: Calls `InterviewStore.confirmProject()` → same `VALIDATED` state

**Critical Invariant (Tested):**
```typescript
// CI Test: Identical outputs
const aiProfile = await runAIInterview(inputs);
const guidedProfile = await runGuidedWizard(inputs);
expect(aiProfile).toEqual(guidedProfile); // deep equal
expect(computeFinancials(aiProfile)).toEqual(computeFinancials(guidedProfile));
```

---

### Agent Group H — AI Settings UI
**Path:** `features/settings/AISettings.tsx`

- Gear icon → Settings page
- Fields: Base URL, API Key, Model Name
- "Test Connection" → calls `ProviderManager.getAIResponse()` with ping
- Save: API Key → Secure Storage, rest → SQLite (`ai_provider_config`)
- Toggle: Enable/Disable AI interview

---

## 📋 PHASE 3: FEATURE UI (8 Parallel Streams)

| Feature | Path | Key Dependencies |
|---------|------|------------------|
| Project Profile | `features/project-profile/` | Guided Forms, ValidationEngine, KnowledgeEngine |
| DPR Preview | `features/dpr/` | DPR Engine, PDF Engine |
| Financial Review | `features/financial/` | FinancialEngine, Recharts |
| Eligibility Display | `features/eligibility/` | EligibilityEngine |
| PDF View/Share | `features/pdf/` | PDF Engine, Capacitor Share+Filesystem |
| Knowledge Search | `features/knowledge/` | KnowledgeEngine |
| OCR Capture | `features/ocr/` | OCR Engine, Camera Plugin |
| Settings | `features/settings/` | All engines + Capacitor plugins |

**Stack:** React 19 + TS strict + Tailwind + shadcn/ui + TanStack Query + Zustand
**State:** Interview state in `InterviewStore` (Zustand), engine results in TanStack Query cache

---

## 📋 PHASE 4: SECURITY HARDENING (Parallel)

| Task | Implementation |
|------|----------------|
| SQLite Encryption | SQLCipher via `@capacitor-community/sqlite` — key from Secure Storage |
| API Key Secure Storage | `@capacitor/secure-storage` → Android Keystore |
| First-Run Notice | `Preferences` flag + modal on app start |
| PII Redaction | All logs: `maskAadhaar()`, `maskPan()`, name/phone/email masking |
| Biometric Unlock (Optional) | `@capacitor/biometric-auth` gate app entry |
| Import Boundary Lint | Custom ESLint rule: `engines/` no import `features/`, `providers/` |
| Accessibility (WCAG AA) | Semantic HTML, ARIA, contrast, keyboard nav — axe-core in CI |
| i18n Strings | All user strings → `src/shared/i18n/en.json` (seam for future) |

---

## 📋 PHASE 5: TESTING & RELEASE (Parallel Agent Groups)

### Test Matrix — All Automated in CI

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit — Engines | Vitest | 100% functions, **worked-example fixtures** for all 7 engines |
| Unit — AI Layer | Vitest (mocked provider) | Writer guard, planner, extractor, parser |
| Integration | Vitest | InterviewStore + SQLite + Engines full flow |
| Component/UI | Vitest + Testing Library | Forms, validation, wizards |
| E2E — Web Build | Playwright | Full journeys: AI + Guided, offline mode |
| E2E — Android Device | Playwright + real device | Camera, Share, Secure Storage, Biometrics |
| Security | Custom | API key never leaks, PII redacted, signature verify |
| Performance | Custom | Bundle < 5MB, startup < 2s, query < 100ms |

---

### Worked-Example Fixtures (MANDATORY)

**Location:** `tests/fixtures/worked-examples/`

Create **hand-verified PMEGP cases** (golden masters):

```json
// case-1-gen-male-urban-mfg.json
// case-2-sc-female-rural-service.json
// case-3-obc-male-rural-mfg-ceiling-edge.json
// case-4-st-male-hill-border-service.json
// Each: input profile → expected FinancialResult, EligibilityResult, DprDocument
```

**Each engine owns its fixtures + golden masters.**

---

### Android Release Pipeline

```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ['v*']
jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci && npm run build
      - run: npx cap sync android
      - uses: android-actions/setup-android@v3
      - run: ./gradlew assembleRelease
      - uses: actions/upload-artifact@v4
        with:
          name: app-release.apk
          path: android/app/build/outputs/apk/release/app-release.apk
```

**Signing:** Keystore via GitHub Secrets (never in repo)

---

## ✅ DEFINITION OF DONE (All Must Pass)

- [ ] `android/` builds signed APK via `./gradlew assembleRelease`
- [ ] All 10 engines implemented + tested (`engines/*/index.ts` + `__tests__/`)
- [ ] All 8 feature modules complete (`features/*/`)
- [ ] AI Writer + Number-injection guard working
- [ ] Guided Forms fallback produces **identical** profile to AI interview
- [ ] PDF generation client-side (pdf-lib), shares via Capacitor Share
- [ ] OCR works offline: Camera → ML Kit → Review → Profile
- [ ] Import/Export: JSON round-trip, encrypted backup/restore
- [ ] Update Engine: Signed pack download → verify → atomic apply
- [ ] SQLite encrypted (SQLCipher), API key in Secure Storage
- [ ] First-run notice, biometric unlock (optional)
- [ ] 100% engine unit tests + **worked-example fixtures**
- [ ] AI/Guided fallback matrix tests pass (identical outputs)
- [ ] Playwright E2E on **real Android device**
- [ ] Import boundary lint passes in CI
- [ ] Signed APK uploaded as release artifact

---

## 🔐 FINAL REMINDER FOR SUB-AGENTS

> **Every line of code must trace to a requirement in `AUDIT_REPORT.md` or the 25 architecture docs.**  
> **No backend. No Prisma. No pdfkit. No Next.js. No floating-point money. No hardcoded secrets.**  
> **Branch: `main` (direct commits). No PR required.**  
> **When complete: Tag `v1.0.0` → GitHub Action builds signed APK → Release.**  

---

**EXECUTE WITH FULL PARALLELISM. NO SEQUENTIAL BOTTLENECKS.**

---

**End of Prompt — Paste into GLM 5.2**