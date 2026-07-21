# 04 — AI Architecture

> The app is **AI-first, not AI-required**. AI is the primary user interaction model; guided forms are the complete fallback. AI drives the *front* (interview) and the *back* (writing) of the workflow — it **never** performs financial or eligibility calculations. See [DESIGN_PRINCIPLES.md](../DESIGN_PRINCIPLES.md).

---

## 1. The core principle: AI as an active bookend

The AI is the **planner, interviewer, researcher, and writer**.
The app is the **calculator, validator, and rule engine**.

```
Entrepreneur
    │
    ▼
[ AI Interview (primary) ]       ← AI-first
[ Guided Forms (fallback) ]      ← complete alternative
    │  both produce identical output
    ▼
Structured Project Profile        ← plain data, no AI
    │
    ▼
[ Project Completion &            ← deterministic gate
  Validation ]                      (completeness, missing fields,
    │                                contradictions, confidence)
    ▼
[ Deterministic Engines ]         ← code only, NEVER AI
    • Eligibility Engine
    • Financial Engine
    • DPR Engine (data)
    │  produces computed numbers
    ▼
Computed Results (JSON)           ← plain data, no AI
    │
    ▼
[ AI Writing (primary) ]          ← AI-first
[ Templates (fallback) ]          ← complete alternative
    │  wraps numbers in bank-ready prose
    ▼
Bank-ready DPR
    │
    ▼
[ PDF Engine ]                    ← code only
```

The narrative may vary between runs. **The numbers must not.** That is the entire safety contract of this app.

---

## 2. AI-first, not AI-required

The AI interview is the **primary user interaction model** — it discovers the project
through natural conversation, validates missing details, explains concepts, and
generates professional narratives. Guided forms are the **complete fallback** when AI
is unavailable or not configured. The app must remain fully usable without AI.

| Stage | AI (primary) | Guided Fallback |
|-------|-------------|-----------------|
| Data collection | Natural conversational interview | Guided wizard (same schema-driven questions) |
| Validation | Validation Engine (identical) | Validation Engine (identical) |
| Calculations | Deterministic engines | Deterministic engines (identical) |
| DPR prose | AI-written narrative | Templated prose with the same engine numbers |
| Live info | Fetched when available | Omitted; nothing breaks |

**Both paths produce the exact same Structured Project Profile.** All deterministic
engines operate only on this profile — no engine may consume raw conversational
messages. The guided fallback is not a degraded mode for correctness — only for UX
richness and prose quality.

---

## 3. Provider abstraction

The app is **provider-independent**. It ships with no baked-in provider, no bundled key, and no dependency on any vendor's servers — including Anthropic.

### 3.1 AI Settings page (reached via gear icon)

The user configures:

| Field | Example | Notes |
|-------|---------|-------|
| Base URL | `https://api.openai.com/v1` | Any OpenAI-compatible / custom gateway |
| API Key | `sk-...` | Stored on-device, encrypted at rest; never logged |
| Model Name | `gpt-4o`, `claude-...`, etc. | Free text |
| **Test Connection** | — | Validates config before use |

Supported by abstraction (examples, not an allow-list): OpenAI, Anthropic, Gemini, DeepSeek, GLM, Groq, Ollama Cloud, OpenRouter, AgentRouter, any OpenAI-compatible or custom gateway.

### 3.2 Provider Manager interface

```
providers/
  types.ts            // ChatMessage, ChatRequest, ChatResponse, ProviderConfig
  provider-manager.ts // selects + calls the active provider
  openai/             // OpenAI-compatible adapter
  anthropic/          // Anthropic-protocol adapter
  custom/             // generic gateway adapter
```

A conceptual (non-final) shape:

```ts
interface AIProvider {
  id: string;
  testConnection(config: ProviderConfig): Promise<TestResult>;
  chat(req: ChatRequest, config: ProviderConfig): Promise<ChatResponse>;
  // streaming optional
}
```

The rest of the app depends only on `AIProvider` / the manager — never on a concrete vendor SDK. Swapping providers changes configuration, not app code.

### 3.3 The only external call

The single permitted outbound network call in the entire app is **device → user-configured AI endpoint**. There is no server of ours in the path. Requests carry only the minimum context needed for the interview or writing task, with PII minimized and never logged. See [13-security-and-privacy.md](13-security-and-privacy.md).

---

## 4. Schema-driven AI questions (principle 15)

The AI interview does not ask arbitrary questions. Every question maps to a field or
field group in the **Structured Project Profile** schema. The interview is
schema-driven.

The complete specification of interview behavior — the Structured Project Profile
schema, the AI reasoning pipeline, interview phases, question planning, knowledge
assistance, activity discovery, the "I don't know" strategy, the confidence model,
and the suggestion lifecycle — is defined in
[16 — AI Interview & Project Discovery Architecture](16-ai-interview-and-project-discovery.md).

Key invariants (summarized from doc 16):

- The AI selects the next question based on which mandatory fields are **missing**,
  which fields have **low confidence**, and which answers contain **contradictions**
  — as determined by the Validation Engine.
- Both the AI interview and the guided wizard cover **exactly the same ground**
  because both are driven by the same schema and the same validation state.
- No engine ever receives raw conversation text — only the validated Structured
  Project Profile.
- The interview follows a phased progression (Applicant Discovery → Business
  Discovery → Activity Resolution → Project Sizing → Financial Planning →
  Review → Validation Completion), with a field dependency graph enforcing
  ordering within and across phases.
- The AI reasoning pipeline has 8 stages; AI is called at most twice per turn
  (field extraction and response generation). The other 6 stages are
  deterministic.

Rules:
- The interview **only fills fields**. It does not compute eligibility or money.
- Every collected value is validated against the same Zod schemas the guided forms
  use — the AI cannot bypass validation.
- Output is a `ProjectProfile` object identical to what the guided forms produce.
  Downstream engines cannot tell whether data came from AI or form.
- Untrusted input: user answers (and any OCR-extracted text) are data, never
  instructions. Prompt-injection attempts must not change engine behavior — authority
  lives in code.

---

## 5. Project Completion & Validation (principle 14)

After the interview or guided forms populate the Structured Project Profile, a
deterministic **Validation Engine** runs before any downstream engine may execute.

It computes:

| Output | Description |
|--------|-------------|
| **Completeness %** | Percentage of mandatory fields populated |
| **Missing fields** | List of mandatory fields not yet filled |
| **Validation errors** | Fields that fail Zod or business-rule validation |
| **Contradictions** | Conflicting answers (e.g., "no land" + "own premises") |
| **Confidence** | Per-field and aggregate confidence score |

The AI interview and the guided forms both **read this state** to determine the next
required question. When completeness reaches the threshold and no blockers remain,
downstream engines (Eligibility, Financial, DPR, PDF) are unlocked.

The Validation Engine is deterministic, pure, and independently testable — it is an
engine in `engines/validation-engine/`, not part of the AI layer.

---

## 6. Deterministic engines (NOT AI)

Covered fully in [05-financial-engine.md](05-financial-engine.md) and [06-eligibility-engine.md](06-eligibility-engine.md). For AI purposes, the only thing that matters here:

**The AI never sees this stage as something it can do. It receives the *output*, not the *responsibility*.**

---

## 7. AI Writing Engine

**Job:** turn computed results into bank-ready prose.

Input is the engine output as JSON, e.g.:

```json
{
  "projectCost": 2000000,
  "subsidy": 700000,
  "bankLoan": 1100000,
  "ownContribution": 200000,
  "monthlySales": 450000,
  "monthlyProfit": 82000,
  "dscr": 2.1,
  "breakEvenMonths": 14
}
```

Output sections: Executive Summary, Business Description, Manufacturing Process, Market Analysis, SWOT, Risk Analysis, Employment Details, Conclusion.

### 7.1 The number-injection guard (mandatory)

An LLM can restate a *correct* number wrong in prose (₹7,00,000 → ₹70,000). To prevent the deterministic guarantee from leaking at the last step:

1. **Inject, don't dictate.** Financial figures are inserted into the prose as non-negotiable tokens/placeholders sourced directly from the engine output — the model writes *around* them.
2. **Post-generation verification.** After the AI returns prose, a deterministic check scans every financial figure appearing in the text and confirms it matches the engine output exactly. Any mismatch → the figure is corrected or the section is regenerated. Prose ships only when all numbers reconcile.
3. **Numbers of record** always come from the engines, never from the model's free text.

---

## 8. Live information (optional enhancement)

When a provider (or the user's connectivity) allows, the AI may enrich context with: district/mandal/PIN context, nearby industrial areas, local suppliers, market demand signals, government notifications, rule/rate updates.

Constraints:
- **Never required.** Absence of live info never blocks a DPR.
- **Never a source of financial numbers of record.** Live data may inform narrative color, not engine inputs, unless explicitly entered and validated by the user.

---

## 9. Prompt templates live in the Knowledge Package

Default prompt templates (interview prompts, section-writing prompts) ship inside the [Bundled Knowledge Package](09-knowledge-package.md) so they can be updated via the signed Update Engine without an app rebuild. See [12-import-export-and-update.md](12-import-export-and-update.md).

---

## 10. Testability

Per the constitution, engines are testable with **no AI in the loop**. Conversely, the AI layer is tested with the engines mocked — interview output is asserted against Zod schemas, and the writing guard is tested by feeding known JSON and asserting every number survives into the prose. The Validation Engine is tested independently with fixture profiles containing missing fields, contradictions, and edge cases. Neither side needs the other to be verified.
