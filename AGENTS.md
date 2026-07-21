# AGENTS.md — Instructions for All AI Coding Agents

This file provides instructions for any AI coding agent working in this repository.
Tool-specific files (CLAUDE.md, .clinerules, .kilocoderules, GEMINI.md) inherit from
this document and add tool-specific guidance. If you have a tool-specific file, read
both this file AND your tool-specific file.

---

## Project Identity

**PMEGP Assistant** — a self-contained, offline-first, **AI-first** Android application
that helps prepare bank-ready PMEGP (Prime Minister's Employment Generation Programme)
project reports. Professional field tool for bank managers, CSC/VLE operators, PMEGP
consultants, entrepreneurs, and district officers.

- **Not** a SaaS product
- **Not** a web-first application
- **Not** a consumer chat app
- **Is** a serious offline business tool
- **One app, not versioned releases** — no V1/V2 staging

---

## Governing Documents

Read these in order before making any architectural decision:

1. `DESIGN_PRINCIPLES.md` — the 15-principle architectural constitution
2. `CLAUDE.md` — actionable rules, forbidden actions, definition of done
3. `docs/README.md` — index to the full architecture documentation set (15 docs)

---

## Core Rules (All Agents Must Follow)

### 1. No Backend
There is no server, no API, no database server of ours. Everything runs on-device.
Do not scaffold, suggest, or depend on any backend infrastructure.

### 2. External Communication
Only two outbound network paths exist (both optional, user-initiated):
- App → user-configured AI endpoint (AI Settings page, gear icon)
- App → signed data-pack source (Knowledge Package updates)

No applicant or project data leaves the device automatically.

### 3. AI Role
AI is the **interviewer** (collects input) and **writer** (wraps numbers in prose).
AI is NEVER the calculator. Deterministic engines produce every number.

### 4. AI is the Primary Experience (with Guided Fallback)
AI interview is the **intended** way users interact with the app. It discovers the
project through conversation, validates details, and generates professional narratives.
AI questions are **schema-driven** — generated only to populate missing or low-confidence
fields in the Structured Project Profile, never arbitrary (principle 15).
If AI is unavailable or not configured, the app provides an equivalent **guided wizard**
that collects the same information. Both paths produce identical deterministic outputs.
The absence of AI must never prevent a user from completing a project.

### 5. Validation Gates Engines
A deterministic **Validation Engine** (principle 14) must pass before any downstream
engine (Eligibility, Financial, DPR, PDF) may execute. It computes completeness %,
missing fields, validation errors, contradictions, and confidence. Both the AI interview
and guided forms read this state to determine the next required question.

### 6. Deterministic Engines
Engines are pure functions. Same input → same output. No AI, no network, no clock
reads, no randomness inside engines. All variability is injected via parameters.

### 7. Provider Independence
The app has no baked-in AI provider. Any OpenAI-compatible or custom gateway works.
Never couple to a specific vendor.

### 8. Privacy
- SQLite encrypted at rest
- API key in secure storage only — never logged, never exported, never backed up
- PII redacted before logs or AI prompts
- First-run transparency notice (not a consent gate)

### 9. Testability
Every engine is independently testable without AI. Worked-example fixtures with
hand-verified expected outputs. Reconciliation invariants asserted.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript (strict), Vite |
| Mobile | Capacitor 7 → Android APK |
| UI | Tailwind CSS, shadcn/ui |
| Forms | React Hook Form + Zod |
| State | Zustand + TanStack Query |
| Storage | SQLite (on-device, encrypted) |
| Charts | Recharts |
| OCR | On-device (ML Kit / Tesseract) |
| PDF | Client-side generation |
| Testing | Vitest + Playwright + device testing |

---

## Repository Structure

```
src/
├── app/                  # shell, routing, providers, first-run notice
├── features/             # UI + orchestration (depends on engines + providers)
├── engines/              # PURE business logic — NO UI, NO AI, NO I/O
│   └── (validation-engine/, financial-engine/, eligibility-engine/, etc.)
├── providers/            # AI provider abstraction (ONLY network code)
├── database/             # SQLite access, migrations, repositories
├── knowledge-package/    # bundled data pack (ships in APK)
└── shared/               # cross-cutting helpers, types, ui components, i18n
```

### Dependency Rule

```
features ──▶ engines ──▶ shared
   │            │
   │            └──▶ database (repositories)
   │
   ├──▶ providers ──▶ shared
   └──▶ database
```

**Hard constraints:**
- `engines/` NEVER imports `features/`, `providers/`, or AI code
- `providers/` is the ONLY place with outbound network calls
- `engines/` NEVER performs I/O (no SQLite, no filesystem, no network)
- `shared/` depends on nothing internal

---

## Forbidden Actions

Never:
- Introduce a backend, BaaS (Firebase/Supabase), or server-side API
- Use Redux, MobX, or alternative state management
- Hardcode API keys, model names, or scheme-specific values in engines
- Use AI for deterministic calculations
- Duplicate business logic
- Mix UI with engines or providers with business logic
- Bypass Zod validation
- Store money as floating point
- Log or export the AI API key
- Import `features/` or `providers/` from `engines/`
- Pass raw conversation messages to any engine (only the Structured Project Profile)
- Run downstream engines before the Validation Engine passes
- Let AI generate questions not mapped to the Project Profile schema
- Put financial formulas in Knowledge Package JSON (formulas are code in `engines/`)
- Put interview flow logic in Knowledge Package (belongs in `features/ai/`)

---

## Definition of Done

Every feature must:
- Work offline
- Have a guided fallback if AI is unavailable (identical outputs)
- Pass the Validation Engine gate before running downstream engines
- Have deterministic engine outputs
- Be tested (worked-example fixtures for engines)
- Be accessible
- Respect dependency direction
- Have no hardcoded secrets
- Have user-facing strings externalized

---

## Code Quality

- TypeScript strict mode — no `any` unless truly unavoidable
- Pure functions where possible
- Composition over inheritance
- Shared types in `shared/types/`
- Zod schemas at every boundary
- No magic numbers — use named constants from Knowledge Package
- Money as integer (paise), format at the edge only
- No comments explaining WHAT; only WHY when non-obvious

---

## Project Decisions & Domain Knowledge

These are locked decisions that all agents must respect. They are not derivable from
code alone — they represent product intent and domain knowledge.

### AI role — the "active bookend"

AI is the *planner, interviewer, researcher, and writer*. The app is the *calculator,
validator, and rule engine*. The full pipeline:

1. **AI Interviewer** — asks natural schema-driven questions (business, district,
   urban/rural, category, land, employees, production, machinery, working capital).
   Collects, validates, organizes into Structured Project Profile.
2. **Validation Engine** — deterministic gate. Completeness %, missing fields,
   contradictions, confidence. Downstream engines cannot run until it passes.
3. **Deterministic Engines** — eligibility, subsidy, loan, own-contribution, EMI,
   DSCR, break-even, P&L, cash flow, balance sheet. Never AI.
4. **AI Writer** — receives engine-computed numbers as JSON. Writes bank-ready prose.
   **Number-injection guard:** computed figures injected as non-negotiable tokens +
   post-generation check that every figure in prose matches engine output.

AI may use **live info when available** (district/mandal/PIN context, industrial areas,
suppliers, market demand, notifications, current rates) — enhancement only, never
required, never authoritative for financial numbers of record.

### Beneficiary context (critical for UX)

Most beneficiaries do NOT know:
- Their NIC code or sector classification
- Whether their activity is Manufacturing or Service
- PMEGP eligibility rules, negative list, or cost ceilings
- Subsidy percentages or category implications
- Required documents or EDP training requirements

They only know: "I want to start a bakery" or "I want to buy a goods vehicle."
The app must **discover** everything else through the interview. This is why AI-first
matters — it guides non-technical users through complex scheme requirements.

### PMEGP sector structure

PMEGP accepts two main sectors: **Manufacturing** and **Service**.
- Trading is NOT a standalone sector — certain trading activities are accepted under Service
- Transport is NOT a standalone sector — certain transport activities are accepted under Service
- The sector determines the **project cost ceiling** (Manufacturing vs Service have different limits)
- The sector determines **subsidy percentages**

### Bundled Knowledge Package contents

The APK ships with a complete Knowledge Package so the app works immediately on install:
- PMEGP Rules (eligibility criteria, subsidy matrix, ceilings, own-contribution %, negative list)
- Activities (permitted activity catalog)
- NIC Codes (4 files: manufacturing, service-service, service-trading, service-transport)
- Machinery Database (common machinery, indicative specs)
- Raw Material Database
- Banks (bank/branch reference data)
- Templates (DPR templates, PDF layouts, checklists)
- Sample DPRs (reference examples)
- FAQ
- Circulars (relevant notifications/circulars text)
- Financial Ratios (default/benchmark ratios for projections)
- Validation Rules (field constraints)
- Default Prompt Templates (interviewer + writer prompt scaffolds)

### Import/Export is the ONLY durability story

There is no cloud backup. A broken phone must not wipe a consultant's DPRs.
The Import/Export Engine handles: export project as JSON, backup/restore SQLite,
share project with another consultant. This is critical for field users.

### First-run transparency notice (exact intent)

On first launch, show ONCE (not a consent gate): "This application stores your project
information only on your device. No applicant data is uploaded automatically."
With OK / Don't-show-again. Do NOT make the offline tool feel like an online service.

### Why Capacitor, not React Native

Chosen because: form-heavy app suits web tech, future reuse for web/admin/desktop
versions of the same codebase. Capacitor 7 → Android APK is the production target.

### The `claude-api` / Claude Code skill

The `claude-api` skill available in Claude Code is a **dev tool for the AI assistant
building this app**. It is NOT part of the PMEGP app itself. The app uses a generic
provider abstraction — never any specific vendor's SDK or tools.

---

## Knowledge Engine & NIC Code Lookup

The Knowledge Engine (`engines/knowledge-engine/`) owns **activity discovery** — matching a
beneficiary's business description to the correct PMEGP-permitted NIC code. This is NOT a
separate engine; it is an internal responsibility of the Knowledge Engine.

Implementation notes:
- NIC data lives in `src/knowledge-package/` as 4 normalized JSON files (manufacturing,
  service-service, service-trading, service-transport) with schema `{nicCode, description,
  sector, subCategory}`
- Build an **offline search index** at app initialization from these canonical files
- The index supports: exact lookup, text search, fuzzy matching, synonym expansion
- Both AI Interview and guided search query the same Knowledge Engine interface
- Performance target: < 200ms per search
- Cost ceilings are NOT in NIC data — they live in PMEGP Rules (determined by sector)
- Do NOT create an "Activity Resolution Engine" — this responsibility belongs to Knowledge Engine
- Do NOT add `pmegpEligible`, `projectCostCeiling`, or `activityId` to NIC entries
- Negative-list checking is the Eligibility Engine's responsibility, not Knowledge Engine's

### Knowledge Package: Data vs Code Boundary

The Knowledge Package stores **data** — rates, thresholds, rules, constants, templates,
reference catalogs. It does NOT store **logic**:

- **Formulas are code.** EMI, DSCR, break-even, depreciation, P&L — these are TypeScript
  functions in `engines/financial-engine/`. They consume parameters (rates, periods) from
  the Knowledge Package, but the formula itself lives in code. Never put formula expressions
  in JSON files — it forces a runtime evaluator, kills type safety, and makes engines
  untestable in isolation.
- **Interview flow logic is orchestration.** Which question to ask next, follow-up branching,
  conditional paths — these belong in `features/ai/` or are derived from Validation Engine
  state (which fields are missing/invalid). The Knowledge Package may store the schema of
  what fields exist, but not how to navigate between them.
- **Create files when data exists.** Don't scaffold empty JSON files for future data.
  Create Knowledge Package files only when actual data is ready to populate them.
- **Separate datasets by domain ownership, not file size.** Each file should represent
  an independent knowledge domain (e.g., PMEGP rules, negative list, subsidy matrix are
  separate domains). Don't split one domain into many files; don't merge unrelated domains
  into one file. Consolidate related constants (project limits, margin money, EDP, age,
  education) into a single `pmegp_rules.json` rather than fragmenting.

**Valid Knowledge Package contents** (data that engines consume):
- PMEGP Rules (eligibility criteria, subsidy matrix, ceilings, own-contribution %)
- Negative list (prohibited activities)
- NIC codes (activity catalog — 4 files)
- Machinery database, raw material database
- Bank/branch reference data
- DPR section structure (section names, required inputs — NOT AI behavior like min words/temperature)
- Portal mapping (profile field → portal field → DPR field canonical mapping)
- DPR narrative templates, PDF layouts
- Default prompt templates (for AI interviewer/writer)
- Financial benchmark ratios, default assumptions
- Validation rules (field constraints, valid ranges)
- Sample DPRs, FAQ, glossary, circulars

**NOT valid Knowledge Package contents:**
- Financial formulas (belong in `engines/financial-engine/` as TypeScript)
- Interview flow logic / question branching (belong in `features/ai/`)
- AI behavior parameters (temperature, top_p, min/max words)
- Bankability scoring / risk interpretation (feature-level concern, not a new engine)
- Empty scaffolded files for future data

---

## Working Agreement

- **Documentation first.** Do not write application code until architecture docs are
  reviewed and approved.
- Ask before creating files or taking hard-to-reverse actions.
- Prefer worked-example tests for anything touching money or eligibility.
- Multi-scheme seams stay in the architecture; PMEGP is the only implemented scheme.

---

## Architecture Documentation

Full architecture: `docs/README.md` (15 documents + traceability matrix).

Key documents for implementation:
- `docs/02-modules-and-folder-structure.md` — where code goes
- `docs/05-financial-engine.md` — most correctness-sensitive engine
- `docs/15-application-workflows.md` — user journeys and orchestration
- `docs/traceability-matrix.md` — requirement coverage
