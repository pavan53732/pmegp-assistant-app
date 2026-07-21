# GEMINI.md — Instructions for Gemini / Google AI Agents

This file provides Gemini-specific guidance for working in this repository.
Read `AGENTS.md` first for the full project rules — this file adds Gemini-specific
instructions only.

---

## Context Loading

Before working on any task, read:
1. `AGENTS.md` — core rules, stack, structure, forbidden actions, **project decisions & domain knowledge**
2. `DESIGN_PRINCIPLES.md` — the 15-principle constitution
3. The specific `docs/` file(s) relevant to your task

**Important:** `AGENTS.md` contains critical domain knowledge about PMEGP sector structure,
beneficiary context, AI role pipeline, Knowledge Package contents, and locked architectural
decisions. Read the "Project Decisions & Domain Knowledge" section thoroughly before implementation.

---

## Gemini-Specific Instructions

### Understanding the Project
This is an **offline-first, AI-first Android app** built with React + Capacitor. The AI
interview is the primary interaction model; guided forms are the complete fallback. It is NOT:
- A cloud application
- A web service
- A Firebase/GCP project
- A Vertex AI integration

Do not suggest or assume any Google Cloud services. The app runs entirely on-device.

### AI Provider Note
This app uses a **generic AI provider abstraction**. The user configures their own
AI endpoint (any OpenAI-compatible API). Gemini models are one valid choice among
many — but the app code NEVER hardcodes any provider, including Google/Gemini.

Do not:
- Add `@google/generative-ai` SDK directly in features
- Hardcode Gemini model names or endpoints
- Assume Gemini-specific API features (grounding, function calling syntax, etc.)
- Suggest Vertex AI, Firebase ML, or Cloud Functions

All AI access goes through `src/providers/provider-manager.ts`.

---

## Key Constraints

| Rule | What it means for Gemini agents |
|------|------|
| No backend | Do not suggest Cloud Run, Cloud Functions, or App Engine |
| Offline-first | Do not suggest features requiring connectivity |
| Provider-independent | Do not assume Gemini API specifics in app code |
| On-device OCR | Do not suggest Cloud Vision API; use on-device ML Kit |
| On-device storage | Do not suggest Firestore, Cloud SQL, or BigQuery |
| Deterministic engines | AI (any model) never calculates — engines do |
| Validation gates engines | Downstream engines cannot run until Validation Engine passes (P14) |
| Schema-driven questions | AI questions map to Project Profile schema fields, never arbitrary (P15) |

---

## Architecture Summary

```
src/
├── features/     → UI + orchestration (may use engines + providers)
├── engines/      → PURE business logic (NO AI, NO I/O, NO network)
│   └── (validation-engine/, financial-engine/, eligibility-engine/, etc.)
├── providers/    → AI abstraction (ONLY network code in the app)
├── database/     → SQLite (on-device, encrypted)
├── knowledge-package/ → bundled reference data
└── shared/       → types, utils, UI components
```

### Dependency Rule
- `engines/` NEVER imports `features/`, `providers/`, or AI code
- `providers/` is the ONLY place with network calls
- `engines/` takes data in, returns data out — pure functions

---

## Testing

- Engine tests: pure unit tests, no AI, no network, worked-example fixtures
- Feature tests: both AI-on (primary) and guided fallback paths
- Integration tests: full flow with in-memory SQLite
- Never mock engine logic in tests — run the real engine

---

## Forbidden Actions

Do NOT:
- Add any Google Cloud SDK (`@google-cloud/*`, `firebase`, `firebase-admin`)
- Add Vertex AI or Gemini SDK directly (all AI goes through provider-manager)
- Suggest Cloud Vision for OCR (must be on-device)
- Suggest Firestore/Realtime DB (SQLite on-device only)
- Suggest Cloud Functions for any backend logic
- Hardcode any model name or API endpoint
- Use AI for financial or eligibility calculations
- Import `features/` or `providers/` from `engines/`
- Store money as floating point
- Log the AI API key
- Create an "Activity Resolution Engine" (NIC lookup belongs to Knowledge Engine)
- Store cost ceilings or eligibility flags in NIC code entries (belong in PMEGP Rules)
- Put financial formulas in Knowledge Package JSON (formulas are code in `engines/`)
- Put interview flow logic in Knowledge Package (belongs in `features/ai/`)

---

## Project State

- Architecture documentation: complete (15 docs + traceability matrix in `docs/`)
- Application code: not yet started — awaiting architecture review approval
- Full architecture docs: `docs/README.md`
- Constitution: `DESIGN_PRINCIPLES.md` (15 principles)
