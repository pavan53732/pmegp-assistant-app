# 14 — Testing Strategy

Status: draft for review · No application code yet
Related: [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md) · [05-financial-engine.md](05-financial-engine.md) · [06-eligibility-engine.md](06-eligibility-engine.md) · [04-ai-architecture.md](04-ai-architecture.md) · [07-dpr-engine.md](07-dpr-engine.md)

Testing is how the constitution's promises become verifiable. The central rule: **every engine is independently testable with no AI model in the loop.** Correctness of money and eligibility is proven by running engines directly.

---

## 1. Test layers

| Layer | Tool | What it covers |
|---|---|---|
| **Unit — engines** | Vitest | Financial, Eligibility, Validation, DPR, PDF-structure, Knowledge, Import/Export, Update logic. Pure functions, no AI, no network, no device. |
| **Unit — providers/AI layer** | Vitest (mocked transport) | Provider Manager selection, request shaping, number-injection guard, interview→schema validation. Engines mocked. |
| **Integration** | Vitest | Feature flows wiring UI orchestration → engines → SQLite (in-memory/temp DB). |
| **Component/UI** | Vitest + Testing Library | Forms, validation, AI Settings, first-run notice. |
| **E2E** | Playwright (web build) + Android device testing | Full journeys: intake → eligibility → financials → DPR → PDF, AI-on and guided fallback. |

---

## 2. The engine correctness bar (highest priority)

Because these figures inform real financing decisions:

- **Worked-example fixtures** — known inputs with hand-verified expected outputs, covering:
  - each **category × area** combination for subsidy,
  - **ceiling boundaries** (at / just over / just under),
  - **rounding edges** and reconciliation (project cost = own contribution + bank loan + margin money),
  - EMI/DSCR/break-even against independently computed values.
- **Eligibility fixtures** — full `checks[]` asserted (not just the boolean), negative-list hits with citations, age/entity boundaries.
- **Version fixtures** — same input against two `knowledge_version`s → outputs change as expected, proving engines read *data*, not hardcoded constants.

All of the above run with **no AI and no network**. This is the concrete proof of "AI never calculates."

---

## 3. The number-injection guard tests

The app's core safety contract ("narrative may vary, numbers may not") is tested explicitly:

- Feed the writer known `FinancialResult` JSON; assert **every** figure in returned prose matches the engine value.
- Inject deliberately corrupted narratives (₹7,00,000 → ₹70,000); assert the DPR Engine's integrity check **rejects** them.
- Assert guided fallback templated prose carries the identical numbers to AI-on prose.

See [04-ai-architecture.md](04-ai-architecture.md) §6.1 and [07-dpr-engine.md](07-dpr-engine.md) §6.

---

## 3a. Validation Engine tests

The Validation Engine (principle 14) gates all downstream engines. Its tests must cover:

- **Completeness fixtures**: profiles with 0%, partial, and 100% mandatory fields → assert correct completeness percentage and missing-field list.
- **Contradiction detection**: profiles with conflicting answers (e.g., "no land" + "own premises") → assert specific contradictions returned.
- **Validation error fixtures**: fields that fail Zod or business-rule checks → assert error list.
- **Confidence scoring**: profiles with ambiguous or low-quality answers → assert per-field and aggregate confidence.
- **Gate enforcement**: assert downstream engines receive a validation-pass token; assert they refuse to run when validation has not passed.

All tests run with no AI and no network — the Validation Engine is a pure, deterministic engine.

---

## 4. AI primary / guided fallback matrix

Every core journey is tested **twice** — AI configured (primary) and AI unavailable (guided fallback) — asserting:

- Calculations are byte-identical in both modes.
- With AI unavailable, intake falls back to the guided wizard and DPR to templated prose.
- No path *requires* AI to reach a complete, correct DPR + PDF.

---

## 5. Security/privacy tests

- **API key never leaks**: assert it is absent from logs, exports, and backups; present only in secure storage and outbound provider calls.
- **PII redaction**: assert PII is masked before any log and minimized in prompts.
- **Signature verification**: assert a tampered/invalid data pack is rejected and the current knowledge version is retained (see [12](12-import-export-and-update.md), [13](13-security-and-privacy.md)).
- **Untrusted input**: prompt-injection / malicious OCR text cannot change an engine verdict or figure.

---

## 6. Import/Export & Update tests

- Round-trip: export → import → assert data equality (numbers unchanged).
- Reject malformed/tampered import files (no partial apply).
- Backup/restore across a simulated fresh install.
- Update apply is atomic; failed verify leaves no mixed-version state.

---

## 7. Boundary/lint enforcement

- An **import-boundary rule** enforces the dependency direction in [02-modules-and-folder-structure.md](02-modules-and-folder-structure.md): `engines/` may not import `features/` or `providers/`; only `providers/` makes network calls. A violation fails CI.

---

## 8. Determinism guards

- Engines must not read the clock or randomness internally (`asOfDate` and any variability are injected). A test asserts repeated calls with identical inputs yield identical outputs.

---

## 9. What "done" means for a change touching money/eligibility

A change is not complete until:
1. Worked-example tests cover the new/changed behavior and pass.
2. Reconciliation invariants still hold.
3. The guided fallback path is tested and correct.
4. No new engine→AI or engine→network dependency was introduced.
