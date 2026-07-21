# 07 — DPR Engine

Status: draft for review · No application code yet
Related: [04-ai-architecture.md](04-ai-architecture.md) · [05-financial-engine.md](05-financial-engine.md) · [06-eligibility-engine.md](06-eligibility-engine.md) · [08-pdf-engine.md](08-pdf-engine.md) · [03-data-model.md](03-data-model.md)

---

## 1. Purpose

The DPR (Detailed Project Report) Engine assembles the final, bank-ready project report. It is the **orchestrator that composes** validated profile data, deterministic engine outputs, knowledge-package content, and (optionally) AI-written prose into a single structured document — which the [PDF Engine](08-pdf-engine.md) then renders.

The DPR Engine itself is **deterministic and AI-free**: it decides *what goes where*, in what order, using which template and which numbers. It does not invent content and it does not calculate.

---

## 2. What a DPR contains

A PMEGP DPR typically includes:

- Cover / applicant & unit identification
- Executive summary
- Promoter profile
- Business / product description
- Manufacturing process (or service delivery model)
- Market analysis
- Machinery & equipment list (with quotations)
- Raw materials
- Manpower / employment generation
- **Financials**: project cost, means of finance (own contribution + bank loan + margin money), EMI/repayment, depreciation, P&L, cash flow, balance sheet, DSCR, break-even
- Eligibility statement
- SWOT & risk analysis
- Conclusion
- Annexures (quotations, checklists)

---

## 3. Inputs

```
DprInput {
  profile: ProjectProfile           // validated (AI interview or guided forms → Validation Engine)
  eligibility: EligibilityResult    // from Eligibility Engine (structured)
  financials: FinancialResult       // from Financial Engine (structured, authoritative numbers)
  knowledge: KnowledgeRefs          // template id, activity notes, process text, etc. (versioned)
  narrative?: DprNarrative          // optional AI-written prose sections
  templateId: string                // which DPR template/format
}
```

Key point: `financials` is the **single source of numbers**. No other input may introduce a financial figure. The `narrative`, if present, is prose only.

---

## 4. Output

```
DprDocument {
  sections: DprSection[]            // ordered, structured content ready for rendering
  meta: {
    schemeCode: "PMEGP"
    knowledgeVersion: string        // reproducibility triple (see data model)
    templateId: string
    financialsSnapshotId: string
    generatedAt: string
    aiUsed: boolean                 // was AI narrative used, or templated fallback?
  }
}
```

The `DprDocument` is a structured, render-agnostic object. The same object can drive PDF today and (potentially) other formats later without changing the engine.

---

## 5. AI-on (primary) vs guided fallback

Per the "AI is the primary experience with guided fallback" principle, the DPR Engine produces a complete document either way:

| Section type | AI ON (primary) | Guided Fallback |
|---|---|---|
| Numbers (cost, subsidy, EMI, DSCR…) | From `financials` | From `financials` (identical) |
| Eligibility statement | Narrated from `eligibility` | Templated from `eligibility` |
| Prose (summary, market, SWOT, risk…) | From `narrative` (AI) | From knowledge-package templates |

The engine treats `narrative` as optional enrichment. If it is absent, templated prose fills the same slots. **The document is always complete and always uses the same numbers.**

---

## 6. The number-integrity check (mandatory)

Before a `DprDocument` is considered valid, the DPR Engine runs a deterministic verification pass:

1. Extract every financial figure appearing in narrative/prose sections.
2. Compare each against the authoritative `financials` values.
3. If any figure in prose does not match an engine value → **reject the narrative** (fall back to templated prose or re-request), and never silently ship a mismatched number.

This is the last line of defense for the app's core safety contract: *the narrative may vary, the numbers may not.* See [04-ai-architecture.md](04-ai-architecture.md) §6.1.

---

## 7. Reproducibility

Each generated DPR records the triple **(knowledgeVersion, templateId, financialsSnapshotId)** (see [03-data-model.md](03-data-model.md)). This guarantees:

- The same project can be regenerated identically.
- A later rule/knowledge update never silently alters an already-produced DPR.
- A banker can trace any figure back to the rule version that produced it.

---

## 8. Determinism & testability

- The DPR Engine is pure given its inputs (the optional AI call happens *outside* it, in the AI layer; the engine receives `narrative` as data).
- Testable with fixtures and **no AI model**: given fixed profile + eligibility + financials + a stub narrative, it must always produce the same `DprDocument`.
- The number-integrity check is unit-tested with deliberately corrupted narratives to prove it catches mismatches.

---

## 9. Boundaries

- Does **not** calculate anything (Financial Engine) or decide eligibility (Eligibility Engine).
- Does **not** call AI providers (the AI layer supplies `narrative`).
- Does **not** render pixels or PDF bytes (PDF Engine).
- Does **not** read scheme rules from the network (Knowledge Package only).
