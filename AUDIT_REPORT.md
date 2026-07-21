# PMEGP Assistant — Architecture & Implementation Compliance Audit (Stage A)

**Audit Date:** 2026-07-21
**Branch:** arena/019f8644-pmegp-assistant-app
**Commit:** 6368e66b1560ddbcbbd7f22c855da1d6356612fc
**Mode:** AUDIT ONLY — No modifications made

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Architecture Compliance](#2-architecture-compliance)
3. [Requirements Traceability Matrix](#3-requirements-traceability-matrix)
4. [Module Compliance Matrix](#4-module-compliance-matrix)
5. [Engine Compliance Matrix](#5-engine-compliance-matrix)
6. [Database Compliance](#6-database-compliance)
7. [Knowledge Package Compliance](#7-knowledge-package-compliance)
8. [AI Compliance](#8-ai-compliance)
9. [Android Compliance](#9-android-compliance)
10. [Security Compliance](#10-security-compliance)
11. [Testing Compliance](#11-testing-compliance)
12. [Performance Findings](#12-performance-findings)
13. [Technical Debt](#13-technical-debt)
14. [Architecture Drift](#14-architecture-drift)
15. [Top 100 Missing Requirements](#15-top-100-missing-requirements)
16. [Prioritized Fix Plan](#16-prioritized-fix-plan)

---

## 1. EXECUTIVE SUMMARY

### 1.1 Overall Assessment

**Status:** **PARTIALLY COMPLIANT** — The repository contains a **substantial implementation** of the PMEGP Assistant architecture with most core engines implemented and tested, but significant gaps remain in critical areas including: Import/Export Engine, Update Engine, OCR Engine (mock only), PDF Engine (uses Next.js server-side PDFKit, not Capacitor/Android), AI Interview orchestration (partial), and Android-specific integrations.

### 1.2 Implementation Completeness by Layer

| Layer | Status | Coverage |
|-------|--------|----------|
| **Documentation** | ✅ Complete | All 16 architecture docs + traceability matrix |
| **Shared Types** | ✅ Complete | ProjectProfile, Provenance, State Machine, Zod schemas |
| **Event Bus** | ✅ Complete | 13 event types, typed emission/consumption |
| **Validation Engine** | ✅ Complete | Pure function, comprehensive tests, all business rules |
| **Financial Engine** | ✅ Complete | All formulas, subsidy matrix, EMI, DSCR, break-even |
| **Eligibility Engine** | ✅ Complete | 7 criteria, all special categories, negative list stub |
| **Knowledge Engine** | ✅ Complete | NIC search, machinery/raw material/employee suggestions |
| **DPR Engine** | ✅ Complete | 18 sections, financial tables, risk/implementation/annexures |
| **PDF Engine** | ⚠️ **Server-side only** | Uses pdfkit in Next.js API routes, not Capacitor/Android |
| **OCR Engine** | ⚠️ **Mock only** | Text-only extraction (txt/csv/json), no image OCR |
| **Database/Repository** | ✅ Complete | Prisma + SQLite, encryption not implemented |
| **AI Provider** | ✅ Complete | Built-in (z-ai) + OpenAI-compatible custom provider |
| **AI Interview** | 🟡 **Partial** | Orchestrator, planner, extractor, parser — missing writer |
| **Import/Export Engine** | ❌ **Missing** | No implementation |
| **Update Engine** | ❌ **Missing** | No implementation |
| **Project Engine** | ❌ **Missing** | Referenced in docs, not implemented |
| **Android/Capacitor** | ❌ **Not started** | Next.js web app only, no Capacitor config |
| **Security/Encryption** | 🟡 **Partial** | API key handling designed, DB encryption not implemented |

### 1.3 Critical Gaps

1. **No Android/Capacitor project** — The app is implemented as a Next.js web application, not a Capacitor Android app as required by architecture
2. **PDF generation is server-side** — Uses pdfkit in Next.js API routes, cannot work offline on Android
3. **OCR is mock-only** — Only processes text files, no ML Kit/Tesseract integration
4. **Import/Export & Update Engines missing** — Critical for offline durability (Design Principle 4, 13)
5. **Database encryption not implemented** — SQLite encryption at rest required (Design Principle 11)
6. **AI Writer missing** — Narrative generation not implemented
7. **Project Engine missing** — Referenced in system architecture but absent
8. **No worked-example test fixtures** — Tests use synthetic profiles, not hand-verified PMEGP cases

---

## 2. ARCHITECTURE COMPLIANCE

### 2.1 System Architecture Compliance (doc 01)

| Requirement | Source | Implementation | Status |
|-------------|--------|----------------|--------|
| Three-stage pipeline (Interview → Validation → Engines) | 01 §3 | Implemented in InterviewController + ValidationEngine | ✅ |
| AI layer and engines never merge | 01 §2 | Enforced by import boundaries | ✅ |
| Only outbound call is app → user's AI | 01 §4 | ProviderManager only network code | ✅ |
| Everything works offline except AI | 01 §5 | Engines pure, DB local, OCR mock | 🟡 (OCR mock) |
| No backend/server of ours | 01 §6 | Next.js API routes exist (violates) | ❌ |

**Finding:** The Next.js API routes (`/src/app/api/*`) constitute a backend server, violating Design Principle 2 and CLAUDE.md Rule 1. All API routes must be removed for Capacitor Android.

### 2.2 Module Boundaries (doc 02, AGENT_CONTRACTS.md)

| Boundary Rule | Enforcement | Status |
|---------------|-------------|--------|
| `engines/` never imports `features/`/`providers` | Verified by inspection | ✅ |
| `providers/` only outbound network code | Verified | ✅ |
| `engines/` no I/O (SQLite, FS, network) | Verified | ✅ |
| `shared/` depends on nothing internal | Verified | ✅ |
| `features/` orchestrates engines + providers | Verified | ✅ |

**Finding:** Import boundaries are correctly enforced in the TypeScript source. However, the Next.js API routes violate the architecture by placing server code in `src/app/api/`.

### 2.3 Dependency Rule Verification

```
features ──▶ engines ──▶ shared
   │            │
   │            └──▶ database (repositories)
   │
   ├──▶ providers ──▶ shared
   └──▶ database
```

**Verified:** All engine imports follow this pattern. No engine imports from features, providers, or AI code.

### 2.4 Circular Dependencies

**Status:** None detected in the TypeScript module graph.

### 2.5 Dead Code / Architecture Drift

| Item | Location | Drift Type |
|------|----------|------------|
| Next.js API routes | `src/app/api/*` | Architecture violation (backend) |
| `project-engine/` folder | Referenced in docs, missing in `src/engines/` | Missing implementation |
| `import-export-engine/` folder | Referenced in docs, missing | Missing implementation |
| `update-engine/` folder | Referenced in docs, missing | Missing implementation |

---

## 3. REQUIREMENTS TRACEABILITY MATRIX

*Full matrix with all 15 Design Principles + feature-level requirements. Only key entries shown here; complete matrix available in traceability analysis.*

### 3.1 Principle-Level Traceability

| Principle | Requirement | Defined In | Implemented | Evidence | Confidence | Gap |
|-----------|-------------|------------|-------------|----------|------------|-----|
| P1 | Offline-first | DESIGN_PRINCIPLES §1 | 🟡 Partial | Engines pure, DB local, but Next.js server exists | 0.7 | Remove Next.js API routes |
| P2 | No backend | DESIGN_PRINCIPLES §2 | ❌ No | `src/app/api/*` routes are a backend | 0.0 | Remove all API routes |
| P3 | No login | DESIGN_PRINCIPLES §3 | ✅ Yes | No auth in codebase | 1.0 | — |
| P4 | SQLite source of truth | DESIGN_PRINCIPLES §4 | ✅ Yes | Prisma + SQLite repository | 0.9 | Encryption missing |
| P5 | Deterministic calculations | DESIGN_PRINCIPLES §5 | ✅ Yes | All engines pure functions | 1.0 | — |
| P6 | AI never invents figures | DESIGN_PRINCIPLES §6 | ✅ Yes | Engines separate from AI | 1.0 | — |
| P7 | AI-first with fallback | DESIGN_PRINCIPLES §7 | 🟡 Partial | InterviewController exists, guided forms not implemented | 0.6 | Guided forms missing |
| P8 | Only app → user's AI | DESIGN_PRINCIPLES §8 | ✅ Yes | ProviderManager only network call | 1.0 | — |
| P9 | Engines independently testable | DESIGN_PRINCIPLES §9 | ✅ Yes | Vitest suites for all engines | 1.0 | — |
| P10 | Separation UI/engines/providers | DESIGN_PRINCIPLES §10 | ✅ Yes | Folder structure enforced | 1.0 | — |
| P11 | Privacy-first local storage | DESIGN_PRINCIPLES §11 | 🟡 Partial | PII masking in OCR, but DB not encrypted | 0.6 | Encryption missing |
| P12 | Scheme-parameterized | DESIGN_PRINCIPLES §12 | ✅ Yes | Knowledge Package params | 1.0 | — |
| P13 | Knowledge ships, updates signed | DESIGN_PRINCIPLES §13 | 🟡 Partial | Knowledge Package bundled, Update Engine missing | 0.5 | Update Engine missing |
| P14 | Validation gates engines | DESIGN_PRINCIPLES §14 | ✅ Yes | ValidationEngine gates downstream | 1.0 | — |
| P15 | AI questions from schema | DESIGN_PRINCIPLES §15 | ✅ Yes | QuestionPlanner uses PHASE_CONFIGS | 1.0 | — |

### 3.2 Feature-Level Traceability (Key Gaps)

| Feature | Architecture Doc | Engine(s) | Workflow Step | Implemented | Evidence | Gap |
|---------|-----------------|-----------|---------------|-------------|----------|-----|
| AI Interview | 04 §4, 16 | — | Step 1 | 🟡 Partial | InterviewController, planner, extractor | Writer, guided fallback missing |
| Guided Forms | 04 §2 | — | Step 1 fallback | ❌ No | No form wizard implementation | Complete missing |
| Validation Gate | 04 §5, 15 §2 | Validation | Step 2 | ✅ Yes | validateProject() + interview store | — |
| Eligibility | 06 | Eligibility | Step 3 | ✅ Yes | checkEligibility() | — |
| Financial | 05 | Financial | Step 4 | ✅ Yes | computeFinancials() | — |
| AI Writer | 04 §7 | — | Step 5a | ❌ No | Not implemented | Complete missing |
| DPR Assembly | 07 | DPR | Step 5b | ✅ Yes | generateDPR() | — |
| PDF Generation | 08 | PDF | Step 6 | ⚠️ Server-only | pdfkit in Next.js API | Must move to client |
| OCR Capture | 11 | OCR | Workflow 5 | ⚠️ Mock | Text extraction only | No image OCR |
| Export/Share | 12 Part A | Import/Export | Workflow 6 | ❌ No | Not implemented | Critical for durability |
| Backup/Restore | 12 Part A | Import/Export | Workflow 7 | ❌ No | Not implemented | Critical for durability |
| Knowledge Update | 12 Part B | Update | Workflow 8 | ❌ No | Not implemented | Required by P13 |

---

## 4. MODULE COMPLIANCE MATRIX

| Module | Path | Spec (doc 02) | Implemented | Tests | Compliance | Notes |
|--------|------|---------------|-------------|-------|------------|-------|
| **App Shell** | `src/app/` | Routing, providers, first-run | 🟡 Partial | No | 0.6 | Next.js pages, not Capacitor |
| **AI Features** | `src/features/ai/` | Interview + writer UI | 🟡 Partial | Partial | 0.6 | Writer missing |
| **Project Profile** | `src/features/project-profile/` | Profile forms | ❌ No | No | 0.0 | Not started |
| **DPR Features** | `src/features/dpr/` | DPR preview | ❌ No | No | 0.0 | Not started |
| **Financial Features** | `src/features/financial/` | Financial review | ❌ No | No | 0.0 | Not started |
| **Eligibility Features** | `src/features/eligibility/` | Eligibility display | ❌ No | No | 0.0 | Not started |
| **PDF Features** | `src/features/pdf/` | PDF view/share | ❌ No | No | 0.0 | Not started |
| **Knowledge Features** | `src/features/knowledge/` | NIC search UI | ❌ No | No | 0.0 | Not started |
| **OCR Features** | `src/features/ocr/` | Camera capture UI | ❌ No | No | 0.0 | Not started |
| **Settings** | `src/features/settings/` | AI settings | ❌ No | No | 0.0 | Not started |

**Finding:** The `features/` folder contains only `ai/` subfolder. All other feature modules from the architecture (doc 02) are completely missing.

---

## 5. ENGINE COMPLIANCE MATRIX

| Engine | Path | Public API | Purity | Determinism | Tests | Doc Compliance | Status |
|--------|------|------------|--------|-------------|-------|----------------|--------|
| **Validation** | `engines/validation-engine/` | validateProject() | ✅ Pure | ✅ Deterministic | 30 tests | 100% (doc 04 §5, 15 §2) | ✅ Complete |
| **Financial** | `engines/financial-engine/` | computeFinancials() | ✅ Pure | ✅ Deterministic | 21 tests | 100% (doc 05) | ✅ Complete |
| **Eligibility** | `engines/eligibility-engine/` | checkEligibility() | ✅ Pure | ✅ Deterministic | 17 tests | 100% (doc 06) | ✅ Complete |
| **Knowledge** | `engines/knowledge-engine/` | resolveActivity, suggest* | ✅ Pure | ✅ Deterministic | 25 tests | 100% (doc 09, AGENTS.md) | ✅ Complete |
| **DPR** | `engines/dpr-engine/` | generateDPR() | ✅ Pure | ✅ Deterministic | 0 tests | 100% (doc 07) | ✅ Complete* |
| **PDF** | `engines/pdf-engine/` | generatePdf() | ✅ Pure | ✅ Deterministic | 0 tests | ⚠️ Server-only (doc 08) | 🟡 Partial |
| **OCR** | `engines/ocr-engine/` | extractFromDocument() | ✅ Pure | ✅ Deterministic | 0 tests | ⚠️ Mock only (doc 11) | 🟡 Partial |
| **Import/Export** | `engines/import-export-engine/` | — | — | — | — | ❌ Missing (doc 12) | ❌ Missing |
| **Update** | `engines/update-engine/` | — | — | — | — | ❌ Missing (doc 12) | ❌ Missing |
| **Project** | `engines/project-engine/` | — | — | — | — | ❌ Missing (doc 01) | ❌ Missing |

*DPR Engine has no unit tests — only integration via workflow.

### 5.1 Engine-Specific Findings

**Validation Engine:** ✅ Fully compliant. Implements all business rules, two-phase gating (canEnterReview, canValidate), provenance tracking, completeness computation.

**Financial Engine:** ✅ Fully compliant. All formulas match reference (doc 05, reference doc). Subsidy matrix, EMI, DSCR, break-even, loan schedule all correct. Integer rupees throughout.

**Eligibility Engine:** ✅ Fully compliant. 7 criteria implemented. Negative list stubbed (passes with warning). All special categories handled.

**Knowledge Engine:** ✅ Fully compliant. NIC search with synonym expansion, machinery/raw material/employee/utility/capacity/market suggestions. Negative list checking.

**DPR Engine:** ✅ Functionally complete (18 sections). ❌ **No unit tests** — critical for regression protection.

**PDF Engine:** 🟡 Implementation uses `pdfkit` in a way that requires Node.js (fs, Buffer). **Cannot run in Capacitor WebView or Android.** Must be rewritten for client-side (pdf-lib, jsPDF, or Capacitor native bridge).

**OCR Engine:** 🟡 Mock implementation only processes UTF-8 text files (txt, csv, json). No ML Kit, Tesseract, or Capacitor Camera integration.

---

## 6. DATABASE COMPLIANCE

### 6.1 Schema Compliance (doc 03)

| Entity Group | Table | Implemented | Fields Match | Notes |
|--------------|-------|-------------|--------------|-------|
| **User Project Data** | `project` | ✅ Yes | ✅ | profileData JSON blob |
| | `applicant` | ❌ No | N/A | Embedded in profileData |
| | `project_financials` | ❌ No | N/A | Not separate table |
| | `dpr_document` | ❌ No | N/A | Not implemented |
| | `attachment` | ❌ No | N/A | Embedded in profileData |
| **AI Config** | `ai_provider_config` | ❌ No | N/A | Not implemented |
| **Reference Data** | `scheme` | ❌ No | N/A | Not in SQLite |
| | `rule_set` | ❌ No | N/A | Not in SQLite |
| | `activity/nic_code/*` | ❌ No | N/A | Loaded from JSON files |
| **App Meta** | `app_meta` | ❌ No | N/A | Not implemented |

### 6.2 Critical Deviations

1. **Single-table design** — Only `project` table exists. All profile data serialized as JSON in `profileData`. Reference data (NIC codes, rules) not in SQLite — loaded from bundled JSON files at runtime.
2. **No encryption at rest** — Prisma client has no encryption. SQLCipher or platform encryption not configured.
3. **No migration system** — Prisma `db push` used, no versioned migrations.
4. **Money as integer** — ✅ Correctly implemented (whole rupees in profile).
5. **Reproducibility triple** — ❌ Not implemented (knowledge_version, template_id, financials_snapshot_id not tracked).

---

## 7. KNOWLEDGE PACKAGE COMPLIANCE

### 7.1 Content Coverage (doc 09)

| Domain | File | Status | Records | Notes |
|--------|------|--------|---------|-------|
| NIC Codes Manufacturing | `nic_codes_manufacturing.json` | ✅ | ~4,238 | Matches doc 09 |
| NIC Codes Service | `nic_codes_service_service.json` | ✅ | ~5,828 | Matches doc 09 |
| NIC Codes Trading | `nic_codes_service_trading.json` | ✅ | ~134 | Sub-category under Service |
| NIC Codes Transport | `nic_codes_service_transport.json` | ✅ | ~200 | Sub-category under Service |
| Metadata | `nic_codes_metadata.json` | ✅ | — | Version, source, schema |
| Machinery Catalog | `pmegp_machinery_catalog.json` | ✅ | ~10 NIC prefixes | Good coverage |
| Raw Materials | `pmegp_raw_materials.json` | ✅ | ~10 NIC prefixes | Good coverage |
| Activity Defaults | `pmegp_activity_defaults.json` | ✅ | ~10 NIC prefixes | Employees, utilities, capacity, market |
| Subsidy Matrix | `pmegp_subsidy_matrix.json` | ✅ | 4 entries | GEN/SPECIAL × URBAN/RURAL |
| Negative List | `pmegp_negative_list.json` | ✅ | ~27 entries | Has trailing keywordPatterns |
| Location Data | `pmegp_location_data.json` | ✅ | 100+ districts | Aspirational + hill/border |

### 7.2 Data vs Code Boundary (doc 09, AGENTS.md)

| Should Be Data (Knowledge Package) | Status | Should Be Code (Engines) | Status |
|-------------------------------------|--------|--------------------------|--------|
| Subsidy rates, ceilings, own-contribution % | ✅ In JSON | EMI, DSCR, break-even formulas | ✅ In Financial Engine |
| Age rules, education rules | ✅ In JSON | Eligibility determination logic | ✅ In Eligibility Engine |
| Negative list entries | ✅ In JSON | Negative-list checking algorithm | ✅ In Eligibility Engine |
| DPR section structure | ✅ In DPR Engine code* | Interview flow logic | ✅ In features/ai/ |
| Financial benchmark ratios | ✅ In activity_defaults | AI behavior params (temp, tokens) | ❌ Not externalized |

*DPR section structure is hardcoded in DPR Engine, not in Knowledge Package. Minor deviation.

### 7.3 Versioning & Updates

- `knowledge_version` metadata exists in `nic_codes_metadata.json`
- **Update Engine missing** — no mechanism to verify/apply signed data packs
- **Signature verification not implemented** — Critical security gap (doc 12, 13)

---

## 8. AI COMPLIANCE

### 8.1 AI Architecture Compliance (doc 04, 16)

| Component | Spec | Implemented | Status |
|-----------|------|-------------|--------|
| **Provider Abstraction** | Generic OpenAI-compatible | ✅ ProviderManager + built-in z-ai | ✅ |
| **AI Settings Page** | Gear icon, base URL, key, model, test | ❌ No UI | ❌ |
| **Interviewer (Primary)** | Schema-driven, 7 phases | 🟡 Partial | 🟡 |
| **Guided Fallback** | Identical schema-driven questions | ❌ No implementation | ❌ |
| **Validation Gate** | Before downstream engines | ✅ InterviewStore calls ValidationEngine | ✅ |
| **AI Writer** | Number-injection guard, templates fallback | ❌ Not implemented | ❌ |
| **Live Info Enhancement** | Optional district/supplier context | ❌ Not implemented | ❌ |
| **Prompt Templates in KP** | Interviewer + writer prompts | ❌ Not in KP | ❌ |

### 8.2 Interview Implementation (doc 16)

| Phase | Spec (doc 16 §4) | Implemented | Gaps |
|-------|------------------|-------------|------|
| 1. Applicant Discovery | Name, age, gender, category, education, entity, prior subsidy, EDP | ✅ PHASE_CONFIGS | — |
| 2. Business Discovery | Business name, description, activity type, sector, location | ✅ PHASE_CONFIGS | — |
| 3. Activity Resolution | NIC code via Knowledge Engine, user confirmation | ✅ handleActivityResolution | — |
| 4. Project Sizing | Land, capacity, machinery, employees, utilities | ✅ PHASE_CONFIGS | — |
| 5. Financial Planning | Interest rate, tenure, sales, working capital, other assets | ✅ PHASE_CONFIGS | — |
| 6. Review | Summary presentation, user confirmation | ✅ handleReviewRequest | Review UI missing |
| 7. Validation Completion | Final validation gate | ✅ handleConfirm | — |

**Core Interview Logic:** ✅ Reasoning pipeline (8 stages) implemented in InterviewController
**Field Extraction:** ✅ Local + AI-assisted with confidence
**Question Planning:** ✅ Schema-driven from PHASE_CONFIGS
**Provenance Model:** ✅ Source × Verification implemented
**Suggestion Lifecycle:** ✅ Knowledge Engine → Suggestion → User Review → Acceptance
**State Machine:** ✅ 9 states implemented in InterviewStore.inferStatus()

### 8.3 Missing AI Components

1. **AI Writer** — No narrative generation, no number-injection guard
2. **Guided Forms Fallback** — Complete missing (React Hook Form + Zod wizard)
3. **AI Settings UI** — No gear icon page for provider configuration
4. **Prompt Templates in KP** — Not extracted to Knowledge Package

---

## 9. ANDROID COMPLIANCE

### 9.1 Capacitor Architecture (doc 10)

| Requirement | Spec | Implemented | Status |
|-------------|------|-------------|--------|
| **Capacitor 7 Android project** | `android/` folder generated | ❌ No `android/` folder | ❌ |
| **WebView runs local assets** | No remote site | ❌ Next.js dev server | ❌ |
| **SQLite Plugin** | `@capacitor-community/sqlite` | ❌ Prisma only (Node) | ❌ |
| **Camera Plugin** | OCR capture | ❌ Not configured | ❌ |
| **Filesystem Plugin** | PDF save, backup, export | ❌ Not configured | ❌ |
| **Secure Storage Plugin** | Android Keystore for API key, DB key | ❌ Not configured | ❌ |
| **Share Plugin** | Android share sheet | ❌ Not configured | ❌ |
| **Permissions** | Camera, storage only when needed | ❌ Not applicable | ❌ |
| **APK Build** | Signed APK/AAB output | ❌ No build config | ❌ |

### 9.2 Platform-Specific Findings

- **Entire codebase is Next.js 16** — Server components, API routes, `next.config.ts`, `package.json` scripts for `next dev`/`next build`
- **No Capacitor config** — `capacitor.config.ts` missing
- **No native plugins** — All Capacitor plugins from doc 10 §3 are absent
- **PDFKit requires Node.js** — Uses `fs`, `Buffer`, streams — incompatible with WebView
- **Prisma Client requires Node.js** — Cannot run in Capacitor WebView

**Verdict:** The application is **not an Android app**. It is a Next.js web application that violates the core architectural decision (Capacitor 7 → Android APK).

---

## 10. SECURITY COMPLIANCE

### 10.1 Threat Model Coverage (doc 13)

| Threat | Mitigation Spec | Implemented | Status |
|--------|----------------|-------------|--------|
| Lost/stolen device → PII exposure | SQLite encrypted at rest | ❌ No encryption | ❌ |
| API key leak to logs/exports/network | Secure storage, never logged, never exported | 🟡 API key not logged, but no secure storage | 🟡 |
| Tampered rule/data packs | Signature verification before apply | ❌ Update Engine missing | ❌ |
| Prompt injection via user/OCR | Untrusted input validation, engine isolation | ✅ Engines isolated, Zod validation | ✅ |
| PII in AI prompts/logs | Redaction before prompts/logs | 🟡 Masking in OCR, not in AI prompts | 🟡 |

### 10.2 Specific Security Gaps

| Gap | Location | Severity |
|-----|----------|----------|
| SQLite not encrypted | `src/lib/db.ts` (Prisma) | **Critical** |
| API key in SQLite (not secure storage) | AI Provider config not implemented | **Critical** |
| No signature verification for KP updates | Update Engine missing | **Critical** |
| PII not redacted before AI prompts | `providers/index.ts` sends full messages | **High** |
| No first-run transparency notice | Not implemented | **Medium** |
| Backups not encrypted | Import/Export Engine missing | **High** |
| Biometric/local unlock not implemented | Optional per doc 10 | **Low** |

---

## 11. TESTING COMPLIANCE

### 11.1 Test Coverage (doc 14)

| Test Layer | Tool | Engines Covered | Features Covered | Status |
|------------|------|-----------------|------------------|--------|
| Unit — Engines | Vitest | Validation, Financial, Eligibility, Knowledge | — | ✅ Good (93 tests) |
| Unit — Providers/AI | Vitest | — | Field extractor, parser, planner | 🟡 Partial |
| Integration | Vitest | — | InterviewStore + Repository | 🟡 Partial |
| Component/UI | Vitest + Testing Library | — | Dashboard components only | 🟡 Partial |
| E2E | Playwright | — | — | ❌ None |
| Android Device | — | — | — | ❌ N/A (no Android) |

### 11.2 Engine Test Quality

| Engine | Worked Examples | Boundary Fixtures | Version Fixtures | Reconciliation Invariants |
|--------|-----------------|-------------------|------------------|---------------------------|
| Validation | ❌ Synthetic only | ✅ Good | ❌ No | ❌ Not asserted |
| Financial | ❌ Synthetic only | ✅ Good | ❌ No | ❌ Not asserted |
| Eligibility | ❌ Synthetic only | ✅ Good | ❌ No | ❌ Not asserted |
| Knowledge | ❌ Synthetic only | ❌ No | ❌ No | N/A |

**Critical Finding:** **No worked-example fixtures with hand-verified expected outputs** as required by doc 14 §2 and DESIGN_PRINCIPLES §9. All tests use `createTestProfile()` synthetic data, not real PMEGP case studies with independently verified figures.

### 11.3 Missing Test Requirements

1. **Worked-example fixtures** — Real PMEGP cases with hand-calculated expected outputs
2. **AI/guided fallback matrix** — No tests proving both paths produce identical profiles
3. **Number-injection guard tests** — AI Writer not implemented, but guard should be tested
4. **Signature verification tests** — Update Engine missing
5. **Import/Export round-trip tests** — Engine missing
6. **Android device tests** — No Android build

---

## 12. PERFORMANCE FINDINGS

| Metric | Target (CLAUDE.md) | Current | Status |
|--------|-------------------|---------|--------|
| App startup (cold) | < 2s | N/A (Next.js dev) | — |
| Project open | < 500ms | N/A (Next.js API) | — |
| SQLite query | < 100ms | Prisma overhead | 🟡 |
| PDF generation | < 5s | Server-side, unmeasured | — |
| Knowledge search | < 200ms | In-memory array filter | ✅ Likely OK |
| AI timeout | User-configurable (30s default) | 3 retries × 1s backoff | ✅ |

### 12.1 Code Quality Issues

| Issue | Location | Impact |
|-------|----------|--------|
| `JSON.parse(JSON.stringify())` for deep clone | `field-updater.ts`, `create-test-profile.ts` | Performance, loses Dates/RegExp |
| Synchronous Knowledge Package loading | `knowledge-package/loader.ts` | Blocks startup on large NIC datasets (~10K entries) |
| No database indexing strategy | Prisma schema not visible | Query performance unknown |
| PDFKit in API route | `engines/pdf-engine/index.ts` | Memory pressure on server |

---

## 13. TECHNICAL DEBT

| Item | Location | Severity | Effort | Description |
|------|----------|----------|--------|-------------|
| Next.js API routes as backend | `src/app/api/*` | **Critical** | High | Violates offline-first, no-backend principle |
| Missing Capacitor/Android project | Root | **Critical** | High | Entire platform target missing |
| PDF Engine server-only | `engines/pdf-engine/` | **Critical** | Medium | Rewrite for client-side |
| OCR Engine mock-only | `engines/ocr-engine/` | **Critical** | High | Integrate ML Kit/Tesseract + Camera |
| Import/Export Engine missing | `engines/import-export-engine/` | **Critical** | High | Core durability feature |
| Update Engine missing | `engines/update-engine/` | **Critical** | High | KP updates, security |
| Project Engine missing | `engines/project-engine/` | **High** | Medium | Referenced in architecture |
| AI Writer missing | `features/ai/interview/` | **High** | Medium | Narrative generation |
| Guided Forms missing | `features/` | **High** | Medium | Complete fallback required |
| SQLite encryption missing | `src/lib/db.ts` | **High** | Medium | SQLCipher or platform encryption |
| No worked-example test fixtures | `engines/*/__tests__/` | **High** | Medium | Hand-verified PMEGP cases |
| Knowledge Package not in SQLite | JSON files only | **Medium** | Low | Load from bundled assets |
| Provenance aggregate not persisted | InterviewStore only | **Medium** | Low | Should be in DB |
| `npm` dependencies in `package.json` | `next`, `next-auth`, etc. | **Medium** | Low | Not needed for Capacitor |
| `pmegp_activity_defaults.json` only 10 prefixes | Knowledge Package | **Medium** | Low | Sparse coverage |
| Negative list JSON has malformed trailing entry | `pmegp_negative_list.json` | **Low** | Low | KeywordPatterns breaks prefix match |

---

## 14. ARCHITECTURE DRIFT

| Drift | Source Document | Implementation | Severity |
|-------|-----------------|----------------|----------|
| **Backend exists** | DESIGN_PRINCIPLES §2, CLAUDE.md Rule 1 | `src/app/api/*` Next.js API routes | **Critical** |
| **Web app, not Android** | doc 01, 10 | Next.js + React 19, no Capacitor | **Critical** |
| **Project Engine missing** | doc 01, 02 | Referenced, not in `src/engines/` | **High** |
| **Import/Export Engine missing** | doc 02, 12 | Referenced, not implemented | **Critical** |
| **Update Engine missing** | doc 02, 12 | Referenced, not implemented | **Critical** |
| **Guided Forms missing** | doc 04 §2, DESIGN_PRINCIPLES §7 | Not in `features/` | **High** |
| **AI Writer missing** | doc 04 §7, 07 §6 | Not implemented | **High** |
| **PDF Engine wrong platform** | doc 08 | pdfkit in Next.js API | **Critical** |
| **OCR Engine mock** | doc 11 | Text file parsing only | **Critical** |
| **Database schema mismatch** | doc 03 | Single `project` table only | **High** |
| **Reference data not in SQLite** | doc 03 | NIC codes in JSON files | **Medium** |
| **Knowledge Version not tracked in DPR** | doc 03, 07 | `generateDPR()` doesn't record triple | **Medium** |
| **AI Settings UI missing** | doc 04 §3.1, 15 §4 | No gear icon page | **Medium** |
| **Prompt Templates not in KP** | doc 04 §9, 09 | Hardcoded in `buildSystemPrompt()` | **Low** |

---

## 15. TOP 100 MISSING REQUIREMENTS

*Prioritized by architectural criticality. Items 1-20 are showstoppers for Stage A approval.*

| # | Requirement | Source | Current State |
|---|-------------|--------|---------------|
| 1 | **Capacitor 7 Android project with APK build** | doc 10, DESIGN_PRINCIPLES §1 | ❌ Next.js only |
| 2 | **Remove all Next.js API routes (no backend)** | DESIGN_PRINCIPLES §2, CLAUDE Rule 1 | ❌ `src/app/api/*` exists |
| 3 | **Client-side PDF generation (offline, no Node.js)** | doc 08, DESIGN_PRINCIPLES §1 | ❌ pdfkit in API route |
| 4 | **On-device OCR (ML Kit/Tesseract + Camera)** | doc 11, DESIGN_PRINCIPLES §1 | ❌ Mock text parser |
| 5 | **Import/Export Engine (JSON backup, share, restore)** | doc 12, DESIGN_PRINCIPLES §4 | ❌ Not implemented |
| 6 | **Update Engine (signed KP data packs, verification)** | doc 12, DESIGN_PRINCIPLES §13 | ❌ Not implemented |
| 7 | **SQLite encryption at rest (SQLCipher/platform)** | doc 13, DESIGN_PRINCIPLES §11 | ❌ Plain Prisma |
| 8 | **AI Writer with number-injection guard** | doc 04 §7, 07 §6 | ❌ Not implemented |
| 9 | **Guided Forms fallback (complete wizard)** | doc 04 §2, DESIGN_PRINCIPLES §7 | ❌ Not implemented |
| 10 | **AI Settings UI (gear icon, provider config, test)** | doc 04 §3.1, 15 §4 | ❌ Not implemented |
| 11 | **Project Engine** | doc 01, 02 | ❌ Not implemented |
| 12 | **Worked-example test fixtures for all engines** | doc 14 §2, DESIGN_PRINCIPLES §9 | ❌ Synthetic only |
| 13 | **Secure storage for API key (Android Keystore)** | doc 13 §4, 10 §3 | ❌ Not implemented |
| 14 | **Signature verification for KP updates** | doc 12 B3, 13 §9 | ❌ Update Engine missing |
| 15 | **Reproducibility triple in DPR (KP version, template, snapshot)** | doc 03, 07 | ❌ Not recorded |
| 16 | **Reference data in SQLite (scheme, rules, NIC codes)** | doc 03 | ❌ JSON files only |
| 17 | **First-run transparency notice** | doc 13 §7, 15 §9 | ❌ Not implemented |
| 18 | **Biometric/local unlock (optional)** | doc 10 §3, 13 §10 | ❌ Not implemented |
| 19 | **Full DPR Engine unit tests** | doc 14 §1 | ❌ No tests |
| 20 | **PDF Engine unit tests** | doc 14 §8 | ❌ No tests |
| 21 | **OCR Engine unit tests** | doc 14 §1 | ❌ No tests |
| 22 | **Import/Export round-trip tests** | doc 14 §6 | ❌ Engine missing |
| 23 | **Update Engine atomic apply tests** | doc 14 §6 | ❌ Engine missing |
| 24 | **AI/guided fallback matrix tests** | doc 14 §4 | ❌ Guided missing |
| 25 | **Number-injection guard tests** | doc 14 §3 | ❌ Writer missing |
| 26 | **Android device E2E tests** | doc 14 §1 | ❌ No Android |
| 27 | **Playwright E2E tests** | doc 14 §1 | ❌ Not configured |
| 28 | **Project Profile feature forms** | doc 02 | ❌ `features/project-profile/` empty |
| 29 | **DPR preview feature** | doc 02 | ❌ `features/dpr/` empty |
| 30 | **Financial review feature** | doc 02 | ❌ `features/financial/` empty |
| 31 | **Eligibility display feature** | doc 02 | ❌ `features/eligibility/` empty |
| 32 | **PDF view/share feature** | doc 02 | ❌ `features/pdf/` empty |
| 33 | **Knowledge search UI** | doc 02 | ❌ `features/knowledge/` empty |
| 34 | **OCR capture UI** | doc 02 | ❌ `features/ocr/` empty |
| 35 | **Settings feature** | doc 02 | ❌ `features/settings/` empty |
| 36 | **Knowledge Package prompt templates** | doc 09, 04 §9 | ❌ Hardcoded in orchestrator |
| 37 | **Machinery catalog coverage (only 10 prefixes)** | doc 09 | 🟡 Sparse |
| 38 | **Raw materials catalog coverage** | doc 09 | 🟡 Sparse |
| 39 | **Activity defaults coverage** | doc 09 | 🟡 Sparse |
| 40 | **Sample DPRs in KP** | doc 09 | ❌ Not included |
| 41 | **FAQ in KP** | doc 09 | ❌ Not included |
| 42 | **Glossary in KP** | doc 09 | ❌ Not included |
| 43 | **Circulars in KP** | doc 09 | ❌ Not included |
| 44 | **Validation rules in KP** | doc 09 | ❌ Hardcoded in ValidationEngine |
| 45 | **Financial ratios in KP** | doc 09 | 🟡 In activity_defaults only |
| 46 | **Portal mapping in KP** | doc 09 | ❌ Not implemented |
| 47 | **DPR templates in KP** | doc 09 | ❌ Hardcoded in DPR Engine |
| 48 | **AI Interview: live info enhancement** | doc 04 §8, 16 §5 | ❌ Not implemented |
| 49 | **AI Interview: Phase 6 Review UI** | doc 16 §4 | ❌ No UI |
| 50 | **AI Interview: Phase 7 Validation Completion UI** | doc 16 §4 | ❌ No UI |
| 51 | **Interview resume handler (full)** | doc 16 §11.4 | 🟡 Partial |
| 52 | **Field dependency graph enforcement** | doc 16 §7 | 🟡 Partial in planner |
| 53 | **"I don't know" strategy full impl** | doc 16 §8 | 🟡 Partial in planner |
| 54 | **Provenance: VALIDATED stamp by ValidationEngine** | doc 16 §9.5 | ❌ Not implemented |
| 55 | **Provenance: CONFIRMED on REVIEW_PENDING confirm** | doc 16 §9.5 | 🟡 Partial |
| 56 | **Suggestion: inline confirmation UI** | doc 16 §10 | ❌ Not implemented |
| 57 | **State machine: edit transitions backward** | doc 16 §11.3 | 🟡 Partial |
| 58 | **State machine: stale snapshot preservation** | doc 16 §11.3 | ❌ Not implemented |
| 59 | **State machine: forward one-step re-run** | doc 16 §11.3 | ❌ Not implemented |
| 60 | **DPR number-integrity check** | doc 07 §6 | ❌ Not implemented |
| 61 | **PDF: client-side fonts bundled** | doc 08 §6 | ❌ Not implemented |
| 62 | **PDF: deterministic layout** | doc 08 §4 | ❌ Not verified |
| 63 | **PDF: table pagination** | doc 08 §5 | ❌ Not verified |
| 64 | **PDF: Android share sheet** | doc 08 §7, 10 §3 | ❌ Not implemented |
| 65 | **OCR: PII masking before logging** | doc 11 §7, 13 §6 | 🟡 Partial in extractor |
| 66 | **OCR: Human confirmation mandatory** | doc 11 §5 | ❌ No UI |
| 67 | **OCR: Extracted fields → Zod validation** | doc 11 §5 | ❌ Not implemented |
| 68 | **Import: AI key never exported** | doc 12 A4 | ❌ Engine missing |
| 69 | **Import: Versioned JSON with schema_version** | doc 12 A3 | ❌ Engine missing |
| 70 | **Import: Zod validation before SQLite** | doc 12 A3 | ❌ Engine missing |
| 71 | **Backup: Encrypted SQLite copy** | doc 12 A3 | ❌ Engine missing |
| 72 | **Restore: User-confirmed replace/merge** | doc 12 A3 | ❌ Engine missing |
| 73 | **Update: Check for update on start** | doc 12 B2 | ❌ Engine missing |
| 74 | **Update: Download signed pack** | doc 12 B2 | ❌ Engine missing |
| 75 | **Update: Verify signature before apply** | doc 12 B3 | ❌ Engine missing |
| 76 | **Update: Atomic apply, no mixed version** | doc 12 B3 | ❌ Engine missing |
| 77 | **Update: Never rewrite existing DPRs** | doc 12 B4 | ❌ Engine missing |
| 78 | **Update: Offline behavior** | doc 12 B5 | ❌ Engine missing |
| 79 | **Database migration system** | doc 03 | ❌ Prisma db push only |
| 80 | **Money as integer paise (not rupees)** | doc 03 | 🟡 Rupees used |
| 81 | **Zod schemas at every boundary** | CLAUDE.md | ✅ Good in engines |
| 82 | **No magic numbers in engines** | CLAUDE.md | ✅ Constants used |
| 83 | **Externalized user-facing strings (i18n)** | DESIGN_PRINCIPLES | 🟡 Hardcoded English |
| 84 | **Accessibility (keyboard, screen reader, contrast)** | DESIGN_PRINCIPLES | ❌ Not verified |
| 85 | **Responsive mobile-first (44px touch targets)** | doc 15 | ❌ Not verified |
| 86 | **Sticky footer layout** | doc 15 | ❌ Not verified |
| 87 | **Performance: <2s cold start** | CLAUDE.md | ❌ Next.js dev |
| 88 | **Performance: <500ms project open** | CLAUDE.md | ❌ API latency |
| 89 | **Performance: <100ms SQLite query** | CLAUDE.md | 🟡 Prisma overhead |
| 90 | **Import boundary lint rule** | doc 14 §7 | ❌ Not configured |
| 91 | **Determinism guards (no clock/random in engines)** | doc 14 §8 | ✅ Engines pure |
| 92 | **Engine error handling for impossible scenarios** | CLAUDE.md §2 | ✅ Not over-handled |
| 93 | **Small focused modules over large files** | CLAUDE.md | ✅ Good |
| 94 | **No comments explaining WHAT** | CLAUDE.md | ✅ Good |
| 95 | **Composition over inheritance** | CLAUDE.md | ✅ Good |
| 96 | **Shared types in shared/types** | CLAUDE.md | ✅ Good |
| 97 | **No hardcoded secrets** | CLAUDE.md | ✅ Good |
| 98 | **PII masked in logs** | doc 13 §6 | 🟡 Partial |
| 99 | **API key never in crash reports** | doc 13 §4.2 | 🟡 No crash reporting |
| 100 | **Multi-scheme seams preserved** | DESIGN_PRINCIPLES §12 | ✅ Good |

---

## 16. PRIORITIZED FIX PLAN

### Phase 0: Architectural Correction (Prerequisite for all work)

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| **P0-1** | **Migrate from Next.js to Vite + React + Capacitor 7** | 2-3 weeks | — |
| **P0-2** | **Delete all `src/app/api/*` routes** | 1 day | P0-1 |
| **P0-3** | **Configure Capacitor Android project (`android/` folder)** | 1 week | P0-1 |
| **P0-4** | **Replace Prisma with `@capacitor-community/sqlite` + SQLCipher** | 1-2 weeks | P0-1 |

### Phase 1: Core Engine Completion (Can proceed in parallel after P0-1)

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| **P1-1** | **Implement Import/Export Engine** (JSON export/import, encrypted backup/restore) | 2 weeks | P0-4 |
| **P1-2** | **Implement Update Engine** (signed pack download, verification, atomic apply) | 2 weeks | P0-4, KP manifest |
| **P1-3** | **Implement Project Engine** (project lifecycle, state transitions) | 1 week | P0-4 |
| **P1-4** | **Rewrite PDF Engine for client-side** (pdf-lib or jsPDF, bundled fonts) | 2 weeks | P0-1 |
| **P1-5** | **Implement on-device OCR Engine** (Capacitor Camera + ML Kit/Tesseract) | 2-3 weeks | P0-1, P0-3 |
| **P1-6** | **Add worked-example test fixtures** for all 4 core engines | 1 week | — |

### Phase 2: AI Layer Completion

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| **P2-1** | **Implement AI Writer** with number-injection guard | 2 weeks | Financial/Eligibility/DPR engines |
| **P2-2** | **Implement Guided Forms Fallback** (React Hook Form + Zod wizard, all 7 phases) | 3 weeks | PHASE_CONFIGS, ValidationEngine |
| **P2-3** | **Build AI Settings UI** (gear icon, provider config, test connection) | 1 week | ProviderManager, Secure Storage |
| **P2-4** | **Extract prompt templates to Knowledge Package** | 1 week | KP structure |

### Phase 3: Feature UI Implementation

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| **P3-1** | **Project Profile feature** (forms for all sections) | 3 weeks | Guided Forms, ValidationEngine |
| **P3-2** | **DPR Preview feature** (structured view, edit→regenerate) | 2 weeks | DPR Engine, PDF Engine |
| **P3-3** | **Financial Review feature** (tables, charts, DSCR/break-even visualization) | 2 weeks | Financial Engine, Recharts |
| **P3-4** | **Eligibility Display feature** (checklist with reasons) | 1 week | Eligibility Engine |
| **P3-5** | **PDF View/Share feature** (Capacitor Share + Filesystem) | 1 week | P1-4, P0-3 |
| **P3-6** | **Knowledge Search UI** (NIC code, activity discovery) | 1 week | Knowledge Engine |
| **P3-7** | **OCR Capture UI** (Camera → Review → Confirm) | 2 weeks | P1-5 |
| **P3-8** | **Settings feature** (AI config, backup, update check) | 1 week | P1-1, P1-2 |

### Phase 4: Security & Polish

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| **P4-1** | **SQLite encryption at rest** (SQLCipher) | 1 week | P0-4 |
| **P4-2** | **Secure storage for API key** (Android Keystore via Capacitor) | 1 week | P0-3 |
| **P4-3** | **First-run transparency notice** | 3 days | P0-1 |
| **P4-4** | **Biometric unlock (optional)** | 1 week | P0-3 |
| **P4-5** | **PII redaction before AI prompts** | 1 week | ProviderManager |
| **P4-6** | **Import boundary lint rule** (CI enforcement) | 3 days | — |
| **P4-7** | **Accessibility audit** (WCAG AA) | 1 week | — |
| **P4-8** | **Performance optimization** (bundle, queries, memory) | 1 week | — |

### Phase 5: Testing & Release Hardening

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| **P5-1** | **Playwright E2E tests** (full journeys, AI + guided) | 2 weeks | P2-2, P3-1 |
| **P5-2** | **Android device tests** (real hardware) | 1 week | P0-3 |
| **P5-3** | **Signature verification tests** (tampered packs) | 3 days | P1-2 |
| **P5-4** | **Import/Export round-trip tests** | 3 days | P1-1 |
| **P5-5** | **Number-injection guard tests** | 3 days | P2-1 |
| **P5-6** | **APK build pipeline** (signing, versioning) | 1 week | P0-3 |

---

### Summary Timeline Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0: Architectural Correction | 4-6 weeks | 4-6 weeks |
| Phase 1: Core Engine Completion | 6-8 weeks | 10-14 weeks |
| Phase 2: AI Layer Completion | 5-7 weeks | 15-21 weeks |
| Phase 3: Feature UI Implementation | 10-12 weeks | 25-33 weeks |
| Phase 4: Security & Polish | 5-6 weeks | 30-39 weeks |
| Phase 5: Testing & Release | 4-5 weeks | **34-44 weeks total** |

---

## CONCLUSION

The PMEGP Assistant repository demonstrates **strong engineering discipline** in the implemented portions — particularly the four core engines (Validation, Financial, Eligibility, Knowledge) which are pure, deterministic, well-tested, and architecturally compliant. The TypeScript code quality is high, dependency boundaries are enforced, and the AI interview orchestration is thoughtfully designed.

**However, the project is fundamentally misaligned with its architectural mandate:**

1. **It is a Next.js web application, not a Capacitor Android app** — the single most critical deviation
2. **Three engines are completely missing** (Import/Export, Update, Project) — breaking offline durability and KP updates
3. **PDF and OCR engines are non-functional on the target platform** — server-only and mock respectively
4. **The entire `features/` layer (UI) is 90% missing** — only AI interview orchestration exists
5. **No worked-example test fixtures exist** — correctness cannot be independently verified against real PMEGP cases

**Recommendation:** **Do not proceed to implementation (Stage B)** until Phase 0 (Architectural Correction) is complete and the codebase runs as a Capacitor Android application with all core engines functional on-device. The current codebase, while high-quality in parts, does not satisfy the project's constitutional requirements for an offline-first, AI-first Android application.

---

*End of Audit Report*