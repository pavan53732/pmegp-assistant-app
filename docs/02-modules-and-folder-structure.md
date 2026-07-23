# 02 — Modules & Folder Structure

Status: Draft for review. Application code is fully implemented.

This document defines the repository layout and the module boundaries. It exists to make the [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md) principle "clear separation of UI, engines, and providers" concrete and enforceable.

---

## 1. Top-level layout

```
pmegp-assistant-app/
├── DESIGN_PRINCIPLES.md      # the constitution — every change checked against it
├── CLAUDE.md                 # the same principles as instructions for AI coding agents
├── docs/                     # this architecture documentation set
├── android/                  # Capacitor Android project (generated)
├── public/                   # static assets
└── src/                      # all application source
```

All application source lives under `src/`. The three top-level concerns — **UI features**, **business engines**, and **AI providers** — are separated into sibling folders so a dependency from one into another is visible in an import path and can be linted.

```
src/
├── app/                  # app shell, routing, providers, first-run notice
│
├── features/             # UI + feature orchestration (may depend on engines + providers)
│   ├── ai/               # AI interview + writer UI, AI Settings (gear icon)
│   ├── project-profile/
│   ├── dpr/
│   ├── financial/
│   ├── eligibility/
│   ├── pdf/
│   ├── knowledge/
│   ├── ocr/
│   └── settings/
│
├── engines/              # PURE business logic — NO UI, NO AI, NO I/O side effects
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
│
├── providers/            # AI provider abstraction (the ONLY outbound network code)
│   ├── provider-manager.ts
│   ├── openai/
│   ├── anthropic/
│   └── custom/           # any OpenAI-compatible / custom gateway
│
├── database/             # SQLite access, migrations, repositories
│   └── sqlite/
│
├── knowledge-package/    # the bundled data pack shipped in the APK (see doc 09)
│
└── shared/               # cross-cutting, dependency-free helpers
    ├── ui/               # shadcn/ui components, design tokens
    ├── utils/
    ├── types/            # shared TypeScript types (incl. scheme-parameterized types)
    └── i18n/             # externalized strings (English now, seams kept)
```

---

## 2. The dependency rule

Dependencies flow in ONE direction. Inner layers must not import outer layers.

```
features ──▶ engines ──▶ shared
   │            │
   │            └──▶ database (repositories only)
   │
   ├──▶ providers ──▶ shared
   │
   └──▶ database
```

Hard constraints:

- **engines/** must not import from `features/`, `providers/`, or any AI code. An engine takes plain data in and returns plain data out. This is what makes engines independently testable with no AI model in the loop.
- **providers/** is the only place allowed to make outbound network calls. No engine, no feature component talks to the network directly.
- **engines/** must not perform I/O (no direct SQLite, no file system, no network). They receive data from repositories via the calling feature and return results. This keeps them pure and deterministic.
- **shared/** depends on nothing internal — it is a leaf.
- The **Financial Engine and Eligibility Engine never import the AI layer.** (Enforces "AI never calculates.")

These rules should be enforced mechanically (e.g. an import-boundary lint rule) once tooling is set up — see [14-testing-strategy.md](14-testing-strategy.md) §7.

---

## 3. Engine contract

Every engine exposes a deterministic, side-effect-free interface: same input → same output, always. Engines are framework-agnostic TypeScript packages that could, in principle, run in Node, a browser, or a test runner with no mocks.

Illustrative shape (not final API):

```
// engines/financial-engine — pure functions over plain data
computeSubsidy(profile: ProjectProfile, scheme: SchemeParams): SubsidyResult
computeLoanSchedule(...): LoanSchedule
computeDSCR(...): DSCRResult
```

Because engines are pure, the AI writer receives their output as plain JSON and never recomputes anything.

---

## 4. Scheme parameterization

PMEGP is the only implemented scheme, but rules, ceilings, and templates are passed in as `SchemeParams` rather than hardcoded inside engine logic. Adding a second scheme later means adding data, not rewriting engines. The seam lives in `shared/types` (the `SchemeParams` shape) and `knowledge-package/` (the data).

---

## 5. Where the "constitution" is enforced

| Principle | Enforced by |
|---|---|
| AI-first with fallback | AI interview and guided forms produce identical Structured Project Profile |
| Validation gates engines | downstream engines (eligibility, financial, DPR, PDF) cannot run until validation passes |
| AI never calculates | engines/ cannot import providers/; engines tested with no AI |
| Offline-first | providers/ is the only network code, and it is optional |
| Provider independence | all AI access goes through `provider-manager` |
| Testable engines | pure functions, no I/O, deterministic interfaces |
| Privacy-first | PII lives only in database/sqlite; providers/ send only what the writer is given |

See [03-data-model.md](03-data-model.md) next for the SQLite schema and entities.
