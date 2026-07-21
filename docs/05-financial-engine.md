# 05 — Financial Engine

> Status: architecture / design. No implementation yet.
> Governed by [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md). This engine is the single most correctness-sensitive part of the application.

## Purpose

The Financial Engine computes every monetary and financial-ratio figure the application produces. It is a **pure, deterministic, self-contained package**. Given the same inputs it always returns the same outputs. It has **no dependency on the AI layer, the network, the database, or the UI**.

The AI layer never performs any calculation described in this document. The AI writer receives the *output* of this engine as JSON and describes it in prose — nothing more.

## Responsibilities

The engine computes:

- **Project cost** — aggregation of capital expenditure (land/building where applicable, machinery, equipment, pre-operative expenses) and working capital.
- **Margin money (subsidy)** — the PMEGP margin-money grant, derived from the subsidy matrix (category × area) applied to the eligible project cost, subject to the applicable ceiling.
- **Bank loan** — the term-loan + working-capital portion financed by the bank.
- **Own contribution** — the beneficiary's contribution (category-dependent %).
- **EMI** — equated monthly instalment for the term loan (principal, rate, tenure).
- **Repayment schedule** — amortization table (opening balance, interest, principal, closing balance) per period.
- **Depreciation** — asset-wise depreciation schedule.
- **P&L projection** — projected profit & loss over the plan horizon (typically 3–5 years).
- **Cash flow projection** — inflows/outflows per period.
- **Balance sheet projection** — projected balance sheet per year.
- **DSCR** — Debt Service Coverage Ratio per period and average.
- **Break-even analysis** — break-even point in value and/or units.
- **Financial ratios** — as required by the DPR (current ratio, etc.).

## Non-responsibilities (hard boundaries)

- It does **not** decide eligibility (that is the [Eligibility Engine](06-eligibility-engine.md)) — though it consumes the *category* and *area* facts that both engines share.
- It does **not** read scheme rules from the network — all parameters come from the [Bundled Knowledge Package](09-knowledge-package.md).
- It does **not** format documents — that is the [DPR Engine](07-dpr-engine.md) and [PDF Engine](08-pdf-engine.md).
- It does **not** call, prompt, or depend on any AI provider.

## Interface shape (illustrative, not final code)

The engine exposes a deterministic, side-effect-free interface. Inputs and outputs are plain typed data (validated with Zod at the boundary).

```
computeFinancials(input: FinancialInput, params: SchemeFinancialParams): FinancialResult
```

- `FinancialInput` — structured project facts (project cost breakdown, category, area, interest rate, tenure, projected sales/expenses, etc.).
- `SchemeFinancialParams` — subsidy matrix, ceilings, own-contribution %, taken from the Knowledge Package (scheme-parameterized — see multi-scheme seams).
- `FinancialResult` — all computed figures above, as structured JSON. This is exactly what the AI writer later receives.

No global state. No hidden inputs. Every parameter that affects a number is an explicit argument.

## Scheme parameterization

All scheme-specific constants (subsidy percentages by category/area, unit-cost ceilings, own-contribution percentages) are **injected** via `SchemeFinancialParams`, never hardcoded in the calculation logic. PMEGP is the only scheme populated today, but the calculation code contains no literal "PMEGP" values. This is the multi-scheme seam at the financial layer.

## Rounding and money representation

- A single, documented rounding policy applies across the engine (defined once, reused everywhere) so figures reconcile across P&L, cash flow, balance sheet, and the subsidy/loan split.
- Money is represented in a way that avoids floating-point drift for currency (integer minor units or a decimal library — decided at implementation time, recorded here when chosen).
- Every rounded figure must still reconcile: project cost = own contribution + bank loan + margin money.

## Testability (mandatory)

Per the "every engine independently testable" principle:

- The engine is tested with **worked examples** — known inputs with hand-verified expected outputs — covering each category × area combination, ceiling boundaries, and rounding edges.
- Tests run with **no AI model, no network, no database**.
- Reconciliation invariants are asserted (the split always sums to project cost; DSCR uses the same figures as the repayment schedule; etc.).
- Fixtures double as the reference the AI writer's output is checked against (see the number-injection guard in [04-ai-architecture.md](04-ai-architecture.md)).

## Correctness posture

Because these figures inform real financing decisions by bankers and consultants:

- The engine is the source of truth for every number in the app.
- Where an official PMEGP parameter is ambiguous, the value used is documented with its source in the Knowledge Package, not guessed inline.
- The engine surfaces "rules current as of <date>" provenance from the Knowledge Package so outputs are traceable to a rule version.
