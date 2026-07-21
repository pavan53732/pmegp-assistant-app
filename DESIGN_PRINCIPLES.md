# DESIGN_PRINCIPLES.md

The architectural constitution for the **PMEGP Assistant** app.

Every decision — human or AI-authored — must be checked against this document. If a
proposed change conflicts with a principle here, the change is wrong until this
document is deliberately amended first. This file changes rarely and only on purpose.

---

## What this app is

A **self-contained, offline-first, AI-first Android application** that helps prepare
bank-ready PMEGP (Prime Minister's Employment Generation Programme) project
documents. It is a **professional field tool** — used by bank managers, CSC/VLE
centers, AP MEPMA staff, PMEGP consultants, entrepreneurs, and district officers —
and must feel like a serious business application, not a consumer chat app.

It runs where its users work: villages and field offices with poor or no
connectivity. It must be fully functional with the network switched off.

---

## The principles

### 1. Offline-first
The app works with **no internet, no account, and no server of ours**. Connectivity
is an enhancement, never a requirement. Any feature that cannot work offline is
either optional or wrong.

### 2. No mandatory backend or server of ours
There is **no backend and no database server** that we own or operate. All business
logic, calculations, PDF generation, OCR, and storage run **100% on-device**. The
app must never depend on our infrastructure to function.

### 3. No mandatory login
There are **no user accounts and no authentication** — for any persona. The tool
runs the moment it is installed.

### 4. SQLite is the local source of truth
Persistent, on-device **SQLite** holds all project data. There is no upstream master
copy; the device is authoritative. Durability comes from the Import/Export Engine
(backup, restore, share), not from a cloud.

### 5. Deterministic calculations
Every financial and eligibility figure is produced by **code in the engines**, never
by an AI model. Given the same inputs, the engines always produce the same outputs.
Money and eligibility must be reproducible and auditable.

### 6. AI assists, but never invents financial figures
AI is the **interviewer** (collects and organizes input) and the **writer**
(wraps engine-computed numbers in prose). It is never the calculator. Computed
figures are injected into AI-written text as fixed tokens, and a post-generation
check verifies every financial figure in the prose matches the engine output.

### 7. AI-first, not AI-required
The AI interview is the **primary user interaction model** — it discovers the
project through natural conversation, validates missing details, explains concepts,
and generates professional narratives. Guided forms are the **complete fallback
interaction model** when AI is unavailable or not configured. Both produce the
**exact same Structured Project Profile**. All deterministic engines operate only on
this profile — no engine may consume raw conversational messages. The app ships with
no AI provider and no key; the user configures one in the AI Settings page (gear
icon): Base URL, API Key, Model Name, then tests the connection. It is a generic
provider abstraction — any OpenAI-compatible or custom gateway. We are **not coupled
to any vendor**. The absence of AI must never prevent a user from completing a
project.

### 8. The only external call is app → user's AI
The single outbound network path is **optional** and goes **directly from the device
to the AI endpoint the user chose**. Nothing else phones home. The user's API key is
stored on-device (encrypted) and never touches any server of ours or any log.

### 9. Engines are independently testable
Each engine (Financial, Eligibility, DPR, PDF, Knowledge, Project, Validation,
Import/Export, Update) exposes **deterministic interfaces** and can be tested
**without any AI model in the loop**. This is the enforcement mechanism for
principle 5: correctness is provable by running the engines directly.

### 10. Clear separation of UI, engines, and providers
**UI features**, **business engines**, and **AI providers** stay loosely coupled and
independently replaceable. Engines contain no UI and no provider code. Providers
contain no business logic. The UI orchestrates; it does not calculate.

### 11. Privacy-first local storage
On-device data includes real PII (applicant profiles, financial data). It is
**encrypted at rest**. A one-time **first-run transparency notice** — not a
cloud-style consent gate — states that data stays on the device and nothing is
uploaded automatically. PII is masked/redacted before it ever enters a log or an AI
prompt.

### 12. Scheme-parameterized
PMEGP is the only implemented scheme, but rules, templates, and the financial engine
are **parameterized by scheme** so additional government schemes can be added later
without rewriting the engines.

### 13. Knowledge ships in the box, updates are signed
The APK bundles a complete **Knowledge Package** (rules, activities, NIC codes,
machinery, raw materials, templates, sample DPRs, FAQ, circulars, financial ratios,
validation rules, default prompt templates) so the app is useful immediately.
Updates arrive as **signed data packs** verified before they touch SQLite, because
rule packs drive money calculations.

### 14. Project Completion & Validation gates the engines
No downstream engine (Eligibility, Financial, DPR, PDF) may execute until the
**Structured Project Profile** passes a deterministic validation stage. This stage
computes **completeness** (percentage, missing fields, validation errors,
contradictions, confidence) and prevents engines from running on incomplete or
conflicting data. Both the AI interview and the guided forms use this completeness
state to determine the next required question — AI questions are generated only to
populate missing or low-confidence fields in the profile schema, never arbitrarily.

### 15. AI questions originate from the Project Profile schema
The AI interview does not ask arbitrary questions. Every question maps to a field or
field group in the **Structured Project Profile** schema. The interview is
schema-driven: the AI selects the next question based on which mandatory fields are
missing, which fields have low confidence, and which answers contain contradictions
— as determined by the Validation Engine. This ensures the AI interview and the
guided wizard cover exactly the same ground.

---

## The pipeline

```
AI Interview (primary) OR Guided Forms (fallback)
        │
        ▼
Structured Project Profile
        │
        ▼
Project Completion & Validation
        │
        ▼
Eligibility Engine
        │
        ▼
Financial Engine
        │
        ▼
DPR Engine
        │
        ▼
PDF Engine
```

Both interaction models converge on the same Structured Project Profile. Everything
below the profile is deterministic, AI-free, and identical regardless of how the
data was collected.

---

## How to use this document

- New feature? Check it against all 15 principles before designing.
- Reviewing code (human or AI)? Reject anything that violates a principle.
- A principle genuinely needs to change? Amend this file first, deliberately, and
  note why. Never let code quietly drift from the constitution.
