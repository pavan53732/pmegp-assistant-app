# PMEGP Assistant — Architecture Documentation

This folder is the architecture documentation set for the PMEGP Assistant. It is
**documentation only** — no application code is written until this set has been
reviewed and approved.

The project's governing rules live one level up:

- [`../DESIGN_PRINCIPLES.md`](../DESIGN_PRINCIPLES.md) — the architectural constitution. Every
  decision in these documents must be consistent with it.
- [`../CLAUDE.md`](../CLAUDE.md) — the same principles phrased as binding instructions for any
  AI coding agent working in this repository.

## What this app is

A **self-contained, offline-first, AI-first Android application** that helps prepare
bank-ready PMEGP project reports (DPRs). The AI interview is the primary interaction
model; guided forms are the complete fallback. All business logic, calculations, PDF
generation, OCR, and storage run **100% on-device**. The app has **no backend and
no database server of ours**. The only external communication is **optional** and
goes directly from the app to a **cloud AI provider the user configures** in the
AI Settings page.

Intended users: bank managers, CSC/VLE centers, AP MEPMA staff, PMEGP consultants,
entrepreneurs, and district officers. It must feel like a serious professional
business tool.

## Reading order

| # | Document | Covers |
|---|----------|--------|
| 01 | [System architecture](01-system-architecture.md) | Layers, data flow, the three-stage AI/engine pipeline |
| 02 | [Modules & folder structure](02-modules-and-folder-structure.md) | features / engines / providers / database / shared |
| 03 | [Data model](03-data-model.md) | SQLite schema, entities, encryption at rest |
| 04 | [AI architecture](04-ai-architecture.md) | Interviewer → engines → writer, Provider Manager, AI Settings |
| 05 | [Financial engine](05-financial-engine.md) | Loan, subsidy, EMI, DSCR, break-even, P&L, cash flow |
| 06 | [Eligibility engine](06-eligibility-engine.md) | PMEGP rule checks, per-criterion verdicts |
| 07 | [DPR engine](07-dpr-engine.md) | Assembling the bank-ready report |
| 08 | [PDF engine](08-pdf-engine.md) | Client-side, on-device PDF generation |
| 09 | [Knowledge Package](09-knowledge-package.md) | Bundled data pack, versioning, signed updates |
| 10 | [Android architecture](10-android-architecture.md) | Capacitor, plugins, on-device storage |
| 11 | [OCR architecture](11-ocr-architecture.md) | On-device OCR, assistive extraction, review |
| 12 | [Import/Export & Update](12-import-export-and-update.md) | Backup, restore, share, signed data-pack updates |
| 13 | [Security & privacy](13-security-and-privacy.md) | Encryption at rest, key handling, PII, threat model |
| 14 | [Testing strategy](14-testing-strategy.md) | Independently testable engines, worked-example fixtures |
| 15 | [Application workflows](15-application-workflows.md) | User journeys, feature orchestration, engine sequencing |
| 16 | [AI Interview & Project Discovery](16-ai-interview-and-project-discovery.md) | Structured Project Profile schema, field ownership, AI reasoning pipeline, interview phases, knowledge-assisted interview, activity discovery, field dependencies, provenance model (Source × Verification), suggestion lifecycle, project profile state machine (with REVIEW_PENDING) |
| — | [Traceability matrix](traceability-matrix.md) | Requirement → document → test mapping |

### Reference material

| Document | Purpose |
|----------|---------|
| [PMEGP scheme values](reference/pmegp-scheme-values-reference.md) | Extracted PMEGP rates, ceilings, formulas, categories — reference for Knowledge Package authoring (needs verification against latest KVIC circular) |

## Non-negotiables (summary — full text in DESIGN_PRINCIPLES.md)

1. Offline-first; no mandatory internet.
2. No mandatory login; no user accounts.
3. No backend or database server of ours.
4. On-device SQLite is the source of truth.
5. AI is the primary experience, provider-independent, with a guided fallback.
6. AI never performs deterministic financial or eligibility calculations.
7. On-device OCR; client-side PDF.
8. Every engine is independently testable without an AI model.
9. UI features, business engines, and AI providers stay loosely coupled.
10. Privacy-first local storage (encryption at rest, on-device only).
