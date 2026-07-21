# 06 — Eligibility Engine

Status: draft for review · No application code until architecture docs are approved
Related: [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md) · [05-financial-engine.md](05-financial-engine.md) · [09-knowledge-package.md](09-knowledge-package.md) · [04-ai-architecture.md](04-ai-architecture.md)

---

## 1. Purpose

The Eligibility Engine decides whether an applicant + proposed project qualify under PMEGP, and explains **why** in per-criterion detail. It is a pure, deterministic module: same input → same verdict, every time, with no AI in the loop.

It answers three questions:

1. **Is the applicant eligible?** (age, prior assistance, entity type, etc.)
2. **Is the activity permitted?** (negative-list check)
3. **Is the project within scheme limits?** (cost ceilings by activity type)

The output is a structured verdict, never free text. The AI Writing layer may later narrate it, but the verdict itself is code.

---

## 2. Position in the flow

```
AI Interview (primary) or Guided Forms (fallback)
        │  both produce the same Structured Project Profile
        ▼
  Validation Engine   ──►  completeness %, missing fields, contradictions
        │  downstream engines unlock only after validation passes
        ▼
  Eligibility Engine  ──►  EligibilityResult (structured)
        │
        ▼
  Financial Engine (only runs if/after eligibility is known)
```

The Validation Engine (principle 14) must pass before Eligibility runs — it ensures the Structured Project Profile is complete and consistent. Eligibility runs before or alongside the Financial Engine. A non-eligible verdict does not block calculation (the user may still want to see numbers), but it is surfaced prominently.

---

## 3. Determinism & testability (non-negotiable)

Per [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md):

- Pure functions. No I/O, no network, no AI, no `Date.now()` inside logic (the "as-of" date is passed in).
- All scheme thresholds come from the **Knowledge Package** (see [09](09-knowledge-package.md)), never hardcoded in the engine.
- Fully testable with fixtures and **no AI model in the loop**.
- Every rule cites its source (guideline clause + version) so a verdict is auditable.

---

## 4. Input contract (shape only — illustrative, not final schema)

```
EligibilityInput {
  asOfDate: string           // ISO date; caller supplies, engine never reads the clock
  scheme: "PMEGP"            // scheme key — engine is scheme-parameterized
  applicant: {
    age: number
    category: "GEN" | "SC" | "ST" | "OBC" | "MINORITY" | "WOMEN" | "EX_SERVICEMEN" | "PH" | "NER" | ...
    area: "RURAL" | "URBAN"
    educationSelfDeclared?: string
    priorGovtSubsidy?: boolean   // already availed PMEGP/PMRY/other subsidy?
    entityType: "INDIVIDUAL" | "SHG" | "TRUST" | "SOCIETY" | "COOP" | ...
  }
  project: {
    activityType: "MANUFACTURING" | "SERVICE" | "BUSINESS"
    nicCode?: string
    totalProjectCost: number
  }
}
```

## 5. Output contract (structured verdict)

```
EligibilityResult {
  eligible: boolean                 // overall
  asOfDate: string
  scheme: "PMEGP"
  checks: EligibilityCheck[]        // one per criterion, always populated
  blockers: string[]                // criterionIds that failed hard
  warnings: string[]                // soft flags (e.g. self-declared education)
}

EligibilityCheck {
  criterionId: string               // e.g. "age.min", "activity.negative-list"
  label: string                     // human label (i18n key in UI)
  passed: boolean
  actual?: string | number
  required?: string | number
  reason: string                    // plain explanation of pass/fail
  source: { clause: string; version: string }   // auditability
}
```

The verdict **always** returns the full `checks` array — even passing checks — so the UI and the DPR can show a complete eligibility statement, not just failures.

---

## 6. Criteria (PMEGP — values live in the Knowledge Package, not here)

The engine evaluates at least these criterion families. Exact thresholds are data, versioned in the Knowledge Package.

| Criterion family | What it checks |
|---|---|
| `age.min` | Applicant meets minimum age |
| `activity.negative-list` | Proposed activity is **not** on the PMEGP negative list |
| `activity.permitted` | Activity maps to a permitted category/NIC |
| `cost.ceiling` | Total project cost within the ceiling for its activity type |
| `applicant.prior-assistance` | Not already availed a barred govt subsidy |
| `applicant.entity-type` | Entity type is permitted |
| `education` | Education requirement (soft/declared where applicable) |

> Note: PMEGP parameters (ceilings, category-based subsidy %, negative list, age) are set by KVIC/MoMSME and revised by notification. The engine must treat them as **versioned data**, and the authoritative values must be sourced/cited during Knowledge Package authoring — see [09-knowledge-package.md](09-knowledge-package.md). No parameter is hardcoded in engine logic.

---

## 7. Negative-list handling

The negative list is central to PMEGP eligibility and changes over time. It lives in the Knowledge Package as structured data (keyword/NIC-based entries with source clauses). The engine:

- Matches the proposed activity/NIC against negative-list entries.
- On a match → `activity.negative-list` fails with the specific entry cited.
- On ambiguity (fuzzy keyword match, no NIC) → **warning**, not a hard block, so a human decides. The engine never silently guesses.

---

## 8. Relationship to the AI layer

- The **AI Interviewer** gathers the raw facts, but the engine — not the AI — decides eligibility.
- The **AI Writer** may narrate the verdict into DPR prose, but only from the structured `EligibilityResult`. It may not assert an eligibility conclusion the engine did not produce, and any threshold it mentions must match `checks[].required` exactly (same number-injection discipline as the Financial Engine).
- Without AI configured, the verdict and a plain templated explanation are still fully available via the guided fallback.

---

## 9. Test strategy

- **Boundary fixtures**: exactly-at-ceiling, one-over, one-under; min-age boundary; each category.
- **Negative-list fixtures**: known barred activities → fail with correct citation; near-miss keywords → warning.
- **Full-verdict fixtures**: assert the complete `checks[]` array, not just `eligible`.
- **Version fixtures**: same input against two rule-pack versions → verdict changes as expected, proving the engine reads data not constants.
- Run entirely without AI. This is the proof that "AI never decides eligibility" holds.

---

## 10. Open items to confirm during Knowledge Package authoring

- Authoritative current PMEGP values (age, ceilings, subsidy %, negative list) with official citation + version date.
- Exact category enumeration and how special-category subsidy % interacts with rural/urban.
- Whether education is a hard criterion or informational for the target activities.

These are **data** decisions, not engine-logic decisions — the engine design above is stable regardless of the values.
