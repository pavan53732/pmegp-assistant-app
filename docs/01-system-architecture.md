# 01 — System Architecture

> Governed by [`../DESIGN_PRINCIPLES.md`](../DESIGN_PRINCIPLES.md). Documentation only — no code.

## 1. One-sentence description

A self-contained, offline-first, **AI-first** Android app in which an AI interview
(or a guided form fallback) populates a Structured Project Profile, a validation
gate ensures completeness, and **deterministic on-device engines** perform every
calculation and produce a bank-ready PMEGP DPR — with no server of ours involved.

## 2. Layered view

```
┌───────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER  (React 19 + TS + Tailwind + shadcn/ui)     │
│  Feature screens: profile, eligibility, financial, DPR, PDF,    │
│  knowledge, OCR capture, AI settings (gear icon)                │
├───────────────────────────────────────────────────────────────┤
│  APPLICATION / ORCHESTRATION  (feature controllers, hooks,      │
│  TanStack Query + Zustand state)                                │
├───────────────────────────────────────────────────────────────┤
│  AI LAYER (PRIMARY)           │  BUSINESS ENGINES (DETERMINISTIC)│
│  • Interview orchestrator     │  • Project Engine               │
│  • Writer orchestrator        │  • Validation Engine            │
│  • Provider Manager           │  • Eligibility Engine           │
│    (user-configured endpoint) │  • Financial Engine             │
│                               │  • DPR Engine                   │
│  GUIDED FORMS (FALLBACK)      │  • Knowledge Engine             │
│  • Same questions, form-based │  • PDF Engine                   │
│  • Same Structured Profile    │  • OCR Engine                   │
│    output                     │  • Import/Export Engine         │
│                               │  • Update Engine                │
├───────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                     │
│  • SQLite (on-device, source of truth, encrypted at rest)      │
│  • Bundled Knowledge Package (ships in APK)                    │
├───────────────────────────────────────────────────────────────┤
│  PLATFORM  (Capacitor 7 → Android: camera, filesystem,          │
│  secure storage, share)                                         │
└───────────────────────────────────────────────────────────────┘

        The ONLY outbound network call (optional):
        App  ──HTTPS──▶  user-configured cloud AI endpoint
```

The vertical split in the middle band is deliberate: **the AI layer and the
business engines never merge**. Engines do not call AI; AI does not calculate.
Both the AI interview and the guided forms produce the **exact same Structured
Project Profile** — engines only consume this profile, never raw conversational
messages.

## 3. The pipeline

This is the core workflow and the reason the app is trustworthy for bankers.

```
   Entrepreneur / operator
            │
            ▼
   ┌──────────────────────────┐   AI asks natural questions driven by the
   │ STAGE 1 — INTERVIEW      │   Project Profile schema (business, district,
   │  AI (primary)             │   urban/rural, category, land, employees,
   │  Guided Forms (fallback)  │   production, machinery, working capital).
   └──────────────────────────┘   Questions target missing or low-confidence
            │                      fields — never arbitrary.
            ▼
   ┌──────────────────────────┐
   │  Structured Project       │   Validated, typed project data (Zod schema).
   │  Profile                  │   Identical output from both interaction models.
   └──────────────────────────┘
            │
            ▼
   ┌──────────────────────────┐   Deterministic gate. Computes: completeness %,
   │ STAGE 2 — VALIDATION      │   missing fields, validation errors,
   │  Project Completion &     │   contradictions, confidence. Downstream
   │  Validation               │   engines may NOT execute until this passes.
   └──────────────────────────┘
            │
            ▼
   ┌──────────────────────────┐   Eligibility → Financial → DPR data. Pure
   │ STAGE 3 — ENGINES         │   functions, no AI, no network. Same input →
   │  Deterministic calc       │   same output, always.
   └──────────────────────────┘
            │
            ▼
   ┌──────────────────────────┐   Computed numbers handed to the AI as JSON.
   │ STAGE 4 — NARRATIVE       │   AI writes executive summary, business
   │  AI (primary)             │   description, process, market/SWOT/risk,
   │  Templates (fallback)     │   employment, conclusion. If AI is unavailable,
   └──────────────────────────┘   templated prose uses the same numbers.
            │
            ▼
   ┌──────────────────────────┐
   │  DPR → Client PDF         │   Assembled on-device, rendered to PDF on-device.
   └──────────────────────────┘
```

**Integrity guard (stage 4):** every financial figure the AI writes is injected as
a non-negotiable token, and a post-generation check verifies each figure in the
prose matches the engine output. An AI can restate a correct number incorrectly in
a sentence; this check catches that. See [AI architecture](04-ai-architecture.md).

## 4. Data flow at rest and in motion

- **At rest:** all project data lives in on-device SQLite, encrypted at rest. The
  Knowledge Package ships bundled in the APK and is read-only at runtime (replaced
  only via the signed Update Engine).
- **In motion:** the only bytes leaving the device are the interview/writing
  prompts and responses exchanged with the user-configured AI endpoint — and only
  when the user has configured and enabled AI. No applicant data is ever sent to
  any server of ours, because we have none.

## 5. Offline behavior

Everything except the AI calls works with the network fully off:
intake (via guided forms), validation, eligibility, all financial math, DPR
assembly, PDF generation, OCR, backup/restore, and reading the Knowledge Package.
When AI is unavailable, the guided forms collect the same data and templated prose
fills the narrative sections.

## 6. What this architecture deliberately excludes

- No backend service, API server, or database server of ours.
- No user accounts, login, sessions, or server-side identity.
- No telemetry or applicant data upload.
- No hard dependency on any single AI vendor.

## 7. Cross-references

- Folder layout that realizes these layers: [02 — Modules](02-modules-and-folder-structure.md)
- The AI-first layer in detail: [04 — AI architecture](04-ai-architecture.md)
- User journeys and feature orchestration: [15 — Application workflows](15-application-workflows.md)
- Why engines are isolated and how they are tested: [14 — Testing](14-testing-strategy.md)
