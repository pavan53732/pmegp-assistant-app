# Implementation Rules

**Version:** 1.0  
**Status:** ENFORCED — Every coding agent MUST read this before writing any code.

These rules are derived from the frozen architecture. Violating any rule is a bug.

---

## 1. Validation Engine is the Only Gatekeeper
No downstream engine may run until `validateProject()` returns `canValidate: true`. No UI should duplicate validation logic.

## 2. Engines Are Pure Functions
Engines never modify the ProjectProfile. They receive a snapshot and return results. No side effects, no I/O, no network, no database writes. The Validation Engine is the ONLY engine that may write to `validation.*`.

## 3. Field Ownership Is Absolute
Every field has exactly one authoritative owner. No subsystem silently overwrites another's data. User/Applicant → personal data. Knowledge Engine → NIC code/sector. Validation Engine → validation.*. Interview → provenance.*, completion.*.

## 4. Knowledge Package Is Read-Only
Never modified at runtime. Suggestions come ONLY from the Knowledge Package — never from AI. AI-generated suggestions are prohibited.

## 5. AI Never Computes Financial Outputs
AI is the interviewer and writer, never the calculator. AI writer receives engine output as fixed JSON tokens. A post-generation check verifies figures match.

## 6. Repository Is the Only Persistence Layer
All database access goes through `IProjectRepository`. No direct Prisma calls outside `src/database/`.

## 7. All Money Values Are Integer Rupees
No floating-point arithmetic for financial values. All rupee amounts are integers. `Math.round()` for all currency calculations.

## 8. No Direct Prisma Outside Repository
`import { db } from '@/lib/db'` is banned outside `src/database/`. All data access uses repository interfaces.

## 9. UI Never Performs Business Calculations
The UI displays values; it does not compute them. Total fields are computed by the engine/store layer.

## 10. Single Data Contract
The ProjectProfile is the ONLY object passed between subsystems. Both AI interview and guided forms produce the identical type. Engines consume ONLY ProjectProfile.

## 11. Provenance Is Inviolable
Engine readiness = `verification === "CONFIRMED" || verification === "VALIDATED"`. Source does NOT factor in. The REVIEW_PENDING screen is the single mandatory confirmation point.

## 12. No UI-Owned Interview State
Interview state lives in the Interview Store, not in component state. Every screen reads from and writes to the same store.

## 13. Provider Isolation
The only outbound network call is to the user's configured AI endpoint. All AI access goes through the provider abstraction. API key stored encrypted, never logged.

## 14. Offline-First
If a feature cannot work offline, it is either optional or wrong. Knowledge Package ships in the app. All engines run on-device.

## 15. Event-Driven Communication
Subsystems communicate via typed events, not direct function calls. Interview → [Project Updated Event] → Validation → [Validation Result Event] → UI.

## 16. Privacy
PII masked before it enters any log, prompt, or export. Aadhaar: last 4 digits only. PAN: masked. No PII in AI prompts unless necessary.

## 17. Import Boundaries
`engines/` must NOT import from `features/`, `providers/`. `providers/` must NOT import from `engines/` or `features/`. `shared/` depends on nothing internal.

## 18. Scheme Parameterization
No scheme-specific values hardcoded in engine logic. All PMEGP parameters come from the Knowledge Package. Engines receive `SchemeParams` as arguments.