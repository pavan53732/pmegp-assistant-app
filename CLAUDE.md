# CLAUDE.md — Instructions for AI Coding Agents

This file governs how any AI coding agent (Claude Code or otherwise) works in this
repository. It restates [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) as actionable
rules. If anything here conflicts with a request, surface the conflict before acting.

---

## Project Goal

The goal of this repository is NOT simply to generate PMEGP DPRs.

The goal is to build a **deterministic, offline-first business planning platform** for
government-supported entrepreneurship. Every architectural decision should favor:

- Accuracy over speed
- Determinism over flexibility
- Offline capability over cloud features
- Long-term maintainability over quick delivery
- Provider independence over vendor lock-in
- Modularity over monolithic convenience
- User privacy over data collection
- Professional document quality over visual gimmicks

---

## What this project is

PMEGP Assistant is a **self-contained, offline-first, AI-first Android app** — a professional
field tool for bank managers, CSC/VLE centers, AP MEPMA staff, PMEGP consultants,
entrepreneurs, and district officers. It must feel like a serious business application.

---

## Non-negotiable rules

1. **No backend of ours. Ever.** All logic, calculations, PDF, OCR, and storage are
   100% on-device. There is no Fastify/Node/PostgreSQL server. Do not scaffold one,
   do not assume one, do not add a dependency that needs one.
2. **External communication is minimal and explicit.** No applicant or project data
   leaves the device automatically. Only explicit user-configured AI requests or
   user-approved update checks may communicate externally. The AI call goes directly
   from the app to the cloud AI endpoint the user sets on the AI Settings page
   (gear icon): Base URL + API Key + Model Name, with a Test-connection action.
3. **No login / no authentication** anywhere, for any persona.
4. **AI never computes financial or eligibility values.** Deterministic engines produce
   every number. AI only interviews (collects/validates/organizes input) and writes
   prose around numbers the engines already produced. When the AI writes a report,
   inject computed figures as fixed tokens and verify every financial figure in the
   prose matches engine output.
5. **AI-first, not AI-required.** The AI interview is the primary user interaction
   model. Guided forms are the complete fallback. Both produce the exact same
   Structured Project Profile. All deterministic engines operate only on this
   profile — no engine may consume raw conversational messages. AI questions are
   schema-driven: generated only to populate missing or low-confidence fields, never
   arbitrary. The absence of AI must never prevent completing a project.
6. **Project Completion & Validation gates the engines.** No downstream engine
   (Eligibility, Financial, DPR, PDF) may execute until the Structured Project
   Profile passes a deterministic validation stage that computes completeness
   (percentage, missing fields, validation errors, contradictions, confidence).
7. **Every engine is independently testable** with no AI model in the loop. Engines
   expose deterministic interfaces and are covered by worked-example tests.
8. **Privacy-first local storage.** On-device PII (profiles, applicant/financial data)
   is encrypted at rest. Redact PII before any log or AI prompt. Show the one-time
   first-run transparency notice (not a cloud-style consent gate).
9. **Provider-independent AI.** No coupling to any one vendor. Any OpenAI-compatible or
   custom gateway must work. The `claude-api` Claude Code skill is a dev tool for the
   assistant, not part of the app.

---

## Stack

### Frontend
- React 19
- TypeScript (strict mode)
- Vite

### Mobile
- Capacitor 8 → Android APK

### UI
- Tailwind CSS
- shadcn/ui

### Forms & Validation
- React Hook Form
- Zod

### State Management
- Zustand
- TanStack Query

### Storage
- SQLite (on-device, encrypted at rest)

### Charts
- Recharts

### Other
- On-device OCR (ML Kit / Tesseract)
- Client-side PDF generation

### Testing
- Vitest
- Playwright
- Android device testing

---

## Repository Structure

```
src/
├── app/                  # app shell, routing, providers, first-run notice
├── features/             # UI + feature orchestration (depends on engines + providers)
│   ├── ai/
│   ├── project-profile/
│   ├── dpr/
│   ├── financial/
│   ├── eligibility/
│   ├── pdf/
│   ├── knowledge/
│   ├── ocr/
│   └── settings/
├── engines/              # PURE business logic — NO UI, NO AI, NO I/O
│   ├── project-engine/
│   ├── validation-engine/
│   ├── financial-engine/
│   ├── eligibility-engine/
│   ├── dpr-engine/
│   ├── pdf-engine/
│   ├── knowledge-engine/
│   ├── ocr-engine/
│   ├── import-export-engine/
│   └── update-engine/
├── providers/            # AI provider abstraction (ONLY outbound network code)
│   ├── provider-manager.ts
│   ├── openai/
│   ├── anthropic/
│   └── custom/
├── database/             # SQLite access, migrations, repositories
├── knowledge-package/    # bundled data pack shipped in the APK
└── shared/               # cross-cutting, dependency-free helpers
    ├── ui/
    ├── utils/
    ├── types/
    └── i18n/
```

---

## Forbidden Actions

Never:
- Introduce Redux, MobX, or any other state library
- Introduce Firebase, Supabase, or any BaaS
- Introduce a Node/Express/Fastify backend
- Introduce server-side APIs or database servers
- Hardcode API keys or model names
- Hardcode scheme-specific values in engine logic
- Use AI for deterministic calculations
- Duplicate business logic across features
- Mix UI components with engine logic
- Mix providers with business logic
- Bypass Zod validation at any boundary
- Store money as floating point
- Log or export the AI API key
- Send PII to any endpoint without user initiation
- Import `features/` or `providers/` from `engines/`
- Feed raw AI conversation messages to any deterministic engine
- Run Eligibility/Financial/DPR engines before validation passes
- Let AI ask questions not mapped to the Project Profile schema
- Create an "Activity Resolution Engine" — NIC lookup belongs to Knowledge Engine
- Add `pmegpEligible`, `projectCostCeiling`, or `activityId` to NIC code entries
- Store cost ceilings in NIC data (they belong in PMEGP Rules, keyed by sector)
- Put financial formulas in Knowledge Package JSON (formulas are code in engines/, not data)
- Put interview flow logic in Knowledge Package (flow logic belongs in features/ai/)
- Scaffold empty Knowledge Package files before actual data is available

---

## Definition of Done

Every feature implementation must satisfy:

- ✓ Works offline (no network required for core function)
- ✓ AI-first with guided fallback (both produce identical Structured Project Profile)
- ✓ Validation gate passes before downstream engines run
- ✓ Deterministic engine outputs (same input → same output)
- ✓ Tested with worked-example fixtures (for engines)
- ✓ Accessible (keyboard nav, screen reader, sufficient contrast)
- ✓ Responsive on target Android devices
- ✓ Modular (respects dependency direction)
- ✓ No duplicated business logic
- ✓ Uses Provider Manager for any AI call
- ✓ Uses SQLite via database layer (never direct)
- ✓ No hardcoded secrets
- ✓ PII masked in logs and minimized in prompts
- ✓ User-facing strings externalized (i18n seam)

---

## Performance Budget

| Operation | Target |
|---|---|
| App startup (cold) | < 2 seconds |
| Project open | < 500 ms |
| SQLite query | < 100 ms |
| PDF generation | < 5 seconds |
| Knowledge search | < 200 ms |
| AI timeout | User-configurable (default 30s) |

---

## Code Quality Rules

- TypeScript strict mode. No `any` without explicit justification.
- Prefer composition over inheritance.
- No magic numbers — use named constants from the Knowledge Package or config.
- Pure functions in engines (no side effects, no I/O).
- Shared types live in `shared/types/` — never duplicate interfaces.
- Prefer Zod schemas as the single source of truth for validation.
- Never bypass validation — all data entering an engine or leaving a boundary is validated.
- Prefer small, focused modules over large files.
- No barrel exports that re-export the world.

---

## Architecture at a glance

```
AI Interview (primary) OR Guided Forms (fallback)
        ↓
Structured Project Profile
        ↓
Project Completion & Validation
        ↓
Eligibility Engine → Financial Engine → DPR Engine → PDF Engine
```

Supporting engines: Knowledge, Import/Export, Update, OCR, Project.
AI provider access: Provider Manager (only outbound network code).

Keep **UI features**, **business engines**, and **AI providers** loosely coupled and in
separate folders (see [docs/02-modules-and-folder-structure.md](docs/02-modules-and-folder-structure.md)).

See [docs/README.md](docs/README.md) for the full architecture document set.
See [AGENTS.md](AGENTS.md) for project decisions, domain knowledge, and Knowledge Engine guidance
that all AI agents share.

---

## Working agreement

- **Do not write application code until the architecture documentation is reviewed and
  approved.** Documentation first.
- Ask before creating files or taking hard-to-reverse actions.
- Prefer worked-example tests for anything touching money or eligibility.
- Keep user-facing strings externalized (i18n seams) even though the app is English now.
- Multi-scheme seams stay in the architecture; PMEGP is the only implemented scheme.

---

## Behavioral Guidelines

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
`1. [Step] → verify: [check]`
`2. [Step] → verify: [check]`
`3. [Step] → verify: [check]`

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
