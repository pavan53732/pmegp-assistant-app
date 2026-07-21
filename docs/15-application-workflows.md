# 15 — Application Workflows

Status: draft for review · No application code yet
Related: [01-system-architecture.md](01-system-architecture.md) · [02-modules-and-folder-structure.md](02-modules-and-folder-structure.md) · [04-ai-architecture.md](04-ai-architecture.md) · [16-ai-interview-and-project-discovery.md](16-ai-interview-and-project-discovery.md) · [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md)

This document maps the **user-facing journeys** and shows how `features/` code orchestrates the deterministic engines and the AI-first interaction model. It fills the gap between the engine specs (docs 05–09) and the system architecture (doc 01) by making the orchestration explicit.

The app is **AI-first**: the AI interview is the primary interaction model. Guided forms are the complete fallback. Both produce the exact same Structured Project Profile. Orchestration lives in `features/`, not in a separate engine. Engines are pure and stateless; features own the sequence, the UI state, and the decision of when to call what.

---

## 1. Primary journey — New Project → Bank-ready DPR

This is the app's core value proposition: take an entrepreneur from zero to a complete, bank-ready DPR with correct financials.

```
┌─────────────────────────────────────────────────────────────────┐
│  USER opens app → taps "New Project"                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1 — Data Collection (features/ai/ or features/project-   │
│           profile/)                                             │
│                                                                 │
│  AI (primary): Conversational interview discovers the project.  │
│  Questions are SCHEMA-DRIVEN — generated only to populate       │
│  missing or low-confidence fields in the Structured Project     │
│  Profile. AI does not ask arbitrary questions.                   │
│                                                                 │
│  The complete interview specification — phases, reasoning        │
│  pipeline, knowledge assistance, activity discovery, confidence  │
│  model, and "I don't know" handling — is in                     │
│  [16 — AI Interview & Project Discovery](16-ai-interview-      │
│  and-project-discovery.md).                                      │
│                                                                 │
│  Guided Forms (fallback): Same schema-driven questions in a     │
│  multi-step wizard (React Hook Form + Zod).                     │
│                                                                 │
│  Output: validated Structured Project Profile (identical from   │
│  both paths). Persisted to SQLite continuously.                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2 — Project Completion & Validation                      │
│           (engines/validation-engine)                            │
│                                                                 │
│  Calls: engines/validation-engine                               │
│  Input: Structured Project Profile                              │
│  Output:                                                        │
│    • completeness percentage                                    │
│    • missing mandatory fields                                   │
│    • validation errors                                          │
│    • contradictions (e.g., "no land" + "own premises")          │
│    • per-field and aggregate confidence                         │
│                                                                 │
│  Both the AI interview and guided forms READ this state to      │
│  determine the next required question.                          │
│                                                                 │
│  Downstream engines (steps 3–6) may NOT execute until           │
│  validation passes (required fields present, no blockers).      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3 — Eligibility Check (features/eligibility/)            │
│                                                                 │
│  Calls: engines/eligibility-engine                              │
│  Input: ProjectProfile + SchemeParams (from Knowledge Package)  │
│  Output: EligibilityResult (structured verdict with per-        │
│          criterion checks, blockers, warnings).                 │
│                                                                 │
│  Displayed to user. A non-eligible verdict does NOT block       │
│  the flow — the user may still want to see financials or        │
│  adjust inputs.                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4 — Financial Computation (features/financial/)          │
│                                                                 │
│  Calls: engines/financial-engine                                │
│  Input: FinancialInput (derived from profile) +                 │
│         SchemeFinancialParams (from Knowledge Package)          │
│  Output: FinancialResult — project cost, subsidy, loan, EMI,   │
│          DSCR, break-even, P&L, cash flow, balance sheet.       │
│                                                                 │
│  Snapshotted to SQLite (project_financials).                    │
│  Displayed to user for review.                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5 — DPR Assembly (features/dpr/)                         │
│                                                                 │
│  5a. Narrative generation                                       │
│      AI (primary): features/ai/ sends FinancialResult JSON to   │
│              the AI writer. AI writes prose sections. The        │
│              number-injection guard verifies every figure        │
│              matches engine output before accepting.             │
│      Fallback: Templated prose from the Knowledge Package.      │
│                                                                 │
│  5b. Document assembly                                          │
│      Calls: engines/dpr-engine                                  │
│      Input: DprInput (profile + eligibility + financials +      │
│             narrative + template + knowledge refs)               │
│      Output: DprDocument (structured, render-agnostic).         │
│      Records reproducibility triple (knowledgeVersion,          │
│      templateId, financialsSnapshotId).                         │
│                                                                 │
│  User previews the assembled DPR.                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6 — PDF Generation (features/pdf/)                       │
│                                                                 │
│  Calls: engines/pdf-engine                                      │
│  Input: DprDocument + PdfOptions (template, page size)          │
│  Output: PdfArtifact (file written to device storage).          │
│                                                                 │
│  User can view, share (Android share sheet), or save.           │
└─────────────────────────────────────────────────────────────────┘
```

### Key invariants across the journey

- **Numbers are identical** regardless of interaction model. The same `FinancialResult` drives both paths.
- **AI never runs steps 2, 3, or 4.** Feature code calls engines directly.
- **Validation gates everything.** Steps 3–6 cannot execute until the Validation Engine passes.
- **Every step persists state to SQLite**, so the user can exit and resume at any point.
- **The number-injection guard** (step 5a) is the last safety gate before numbers enter prose. It is mandatory and cannot be bypassed.
- **No engine consumes raw conversation** — only the validated Structured Project Profile.

---

## 2. Project Completeness Model

Every project exposes the following state, computed by the Validation Engine:

| Property | Type | Description |
|---|---|---|
| `completeness` | number (0–100) | Percentage of mandatory fields populated |
| `missingFields` | string[] | Mandatory fields not yet filled |
| `validationErrors` | ValidationError[] | Fields failing Zod or business-rule checks |
| `contradictions` | Contradiction[] | Conflicting answers requiring clarification |
| `confidence` | ConfidenceMap | Per-field and aggregate confidence |

This state is:
- **Displayed** to the user as progress through the interview/wizard
- **Read** by the AI to select the next schema-driven question
- **Read** by the guided forms to determine the next wizard step
- **Checked** before unlocking downstream engines

---

## 3. Resume / Edit Project

```
Open app → select existing project → resume at last incomplete step
                                   → or edit any completed step
```

- Resuming loads the saved Structured Project Profile, re-runs the Validation Engine, and presents the current completeness state.
- Editing an earlier field **re-triggers validation**, which may invalidate downstream outputs. The feature layer re-runs affected engines and clears stale snapshots.
- Already-generated DPRs are **not silently rewritten**. The user explicitly regenerates if inputs changed.

---

## 4. AI Settings Configuration

```
Gear icon → AI Settings page (features/settings/ or features/ai/)

  1. Enter Base URL, API Key, Model Name
  2. Tap "Test Connection"
     → providers/provider-manager validates config
     → success: save (key to secure storage, rest to SQLite)
     → failure: show error, do not save
  3. AI interview becomes available as the primary interaction model
```

- Without AI configured, the guided forms serve as the interaction model.
- Configuring AI upgrades the experience to the conversational interview.
- Removing the configuration reverts to guided forms.
- The API key is stored in secure storage (Android Keystore-backed), never in SQLite, never logged, never exported.

---

## 5. OCR Capture

```
Within a project → "Add Quotation" or "Scan Document"

  1. Camera capture (Capacitor Camera plugin)
  2. On-device OCR extracts raw text + layout
  3. Field extraction (deterministic parsing)
  4. Review screen — user confirms / corrects extracted fields
  5. Confirmed data saved to SQLite (attachment table)
  6. Fields available for use in project profile / financials
```

- OCR output is **untrusted** and **never authoritative**. Human confirmation is mandatory.
- No image or text leaves the device.
- Confirmed OCR data flows through the same Zod validation as manually entered data.

---

## 6. Export / Share / Backup

```
Project list → select project → Export / Share
                              → or: Settings → Full Backup

  Export:   engines/import-export-engine serializes project to JSON
            → user chooses destination via share sheet or filesystem
  Backup:   full encrypted SQLite copy → user-directed location
  Share:    export + Android share sheet
```

- The AI API key is **never included** in any export or backup.
- Exported files carry `schema_version` and `knowledge_version` for import compatibility.
- This is the app's durability story — there is no cloud backup.

---

## 7. Import / Restore

```
Settings → Import Project  → pick JSON file → validate → import to SQLite
Settings → Restore Backup  → pick backup file → validate → restore (user-confirmed)
```

- Import validates against Zod schemas; malformed or tampered files are rejected entirely (no partial apply).
- Restore replaces/merges local data after explicit user confirmation.
- Money values are carried as stored integers, never re-derived on import.

---

## 8. Knowledge Package Update

```
App start (if online) or Settings → "Check for Updates"

  1. Check for update (optional network call)
  2. Download signed data pack
  3. VERIFY SIGNATURE (mandatory — reject if invalid)
  4. Validate schema/version
  5. Apply to SQLite atomically (new knowledge_version recorded)
```

- A failed verification discards the pack and retains the current version.
- The update **never silently rewrites** existing DPRs. Each DPR keeps the `knowledge_version` it was produced with.
- With no connectivity, the app continues indefinitely on the bundled/last-applied package.
- Outputs display "rules current as of \<date\>" from the active knowledge version.

---

## 9. First-run experience

```
Install → first launch

  1. Load bundled Knowledge Package into SQLite (tag knowledge_version)
  2. Show first-run transparency notice:
     "This application stores your project information only on your device.
      No applicant data is uploaded automatically."
     [OK] / [Don't show again]
  3. Land on the home/project-list screen — fully functional, no setup required
  4. Prompt to configure AI provider (gear icon) — recommended but not required
```

- No login, no account creation, no consent gate.
- App is immediately usable via guided forms; AI interview is available once configured.
- The app encourages AI configuration for the best experience but never blocks on it.

---

## 10. Orchestration responsibilities (features/ vs engines/)

| Responsibility | Owner | NOT owned by |
|---|---|---|
| Sequencing steps, navigation, UI state | `features/` | `engines/` |
| Deciding when to call which engine | `features/` | `engines/` |
| Calling the AI provider | `features/` via `providers/` | `engines/` |
| Invalidating stale outputs on edit | `features/` | `engines/` |
| Persisting state to SQLite | `features/` via `database/` | `engines/` |
| Project completeness & validation | `engines/validation-engine` | `features/`, AI |
| Computing financial figures | `engines/financial-engine` | `features/`, AI |
| Deciding eligibility | `engines/eligibility-engine` | `features/`, AI |
| Assembling the DPR structure | `engines/dpr-engine` | AI |
| Rendering PDF | `engines/pdf-engine` | AI |
| Number-integrity verification | `engines/dpr-engine` | AI |

This table is the enforcement of [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md) principle 10: the UI orchestrates; it does not calculate.
