# Frozen Contracts

**Version:** 1.0
**Status:** ENFORCED — These files/modules are READ-ONLY unless the Architecture Guardian explicitly approves a change.

---

## Frozen Files

| # | File / Module | Owner | Reason |
|---|---|---|---|
| 1 | `src/shared/types/project-profile.ts` | Foundation | The canonical 13-segment data contract. All subsystems consume this. |
| 2 | `src/shared/types/provenance.ts` | Foundation | Source × Verification provenance model. Engine readiness depends on it. |
| 3 | `src/shared/types/state-machine.ts` | Foundation | 9-state machine + ItemSource type. |
| 4 | `src/shared/types/interview.ts` | Foundation | 7 interview phases + PhaseProgress. |
| 5 | `src/shared/types/schemas/` | Foundation | Zod schemas mirroring the type system. |
| 6 | `src/shared/types/index.ts` | Foundation | Barrel re-exports. |
| 7 | `src/shared/events/event-types.ts` | Foundation | 13 typed event definitions. |
| 8 | `src/shared/events/event-bus.ts` | Foundation | EventBus singleton. |
| 9 | `src/shared/events/index.ts` | Foundation | Barrel re-exports. |
| 10 | `src/engines/validation-engine/index.ts` | Engine Team A | Public API: `validateProject(profile) → ValidationResult`. Two-phase gating. |
| 11 | `src/engines/eligibility-engine/index.ts` | Engine Team A | Public API: `checkEligibility(profile) → EligibilityResult`. 7 checks. |
| 12 | `src/engines/financial-engine/index.ts` | Engine Team A | Public API: `computeFinancials(profile) → FinancialResult`. |
| 13 | `src/engines/knowledge-engine/index.ts` | Knowledge Team | 12 public functions. Pure, synchronous, data-driven. |
| 14 | `src/database/interfaces.ts` | Infrastructure | `IProjectRepository` interface. |
| 15 | `src/database/project-repository.ts` | Infrastructure | Prisma implementation of IProjectRepository. |
| 16 | `src/features/ai/interview-store/interview-store.ts` | AI Team | `InterviewStore` class — state management, field updates, validation. |
| 17 | `src/features/ai/interview-store/field-updater.ts` | AI Team | Pure field manipulation helpers. |
| 18 | `IMPLEMENTATION_RULES.md` | Architecture | 18 enforced rules. |
| 19 | `AGENT_CONTRACTS.md` | Architecture | Per-subsystem boundaries. |
| 20 | `FROZEN_CONTRACTS.md` | Architecture | This file. |

## Rules

1. **No modifications** to any file listed above without Architecture Guardian review and approval.
2. **No signature changes** to any exported function, type, or interface.
3. **No new exports** from frozen modules.
4. **No reordering** of event types in `EventTypeMap`.
5. Feature agents MAY import from frozen modules. They MAY NOT modify them.
6. If a frozen contract needs to change, the Architecture Guardian must:
   - Assess the impact on all downstream subsystems
   - Update this document
   - Commit with a clear justification
7. Adding NEW files alongside frozen modules (e.g., a new engine) is allowed if it does not modify existing files.
8. The Import Boundary Matrix in AGENT_CONTRACTS.md remains in effect.

## Change Request Process

To request a frozen contract change:

1. Document the exact change needed and why.
2. List all subsystems affected.
3. Propose backward-compatible alternatives first.
4. Architecture Guardian reviews, approves/rejects, and applies if approved.