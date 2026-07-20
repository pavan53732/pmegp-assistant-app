# Definition of Done — PMEGP Assistant

> **Enforcement:** Every subsystem must satisfy **all applicable** checklist items below before merge. The Architecture Guardian is the sole authority on sign-off. No exceptions.

---

## 1. Universal Completion Checklist

_Every subsystem — no exceptions — must pass ALL items._

- [ ] Public API documented with JSDoc/TSDoc (`@param`, `@returns`, `@throws`, `@example`)
- [ ] Zero ESLint errors (`bun run lint`)
- [ ] Zero TypeScript errors (strict mode)
- [ ] Unit tests added (min 80% branch coverage for deterministic engines, min 60% for AI-dependent modules)
- [ ] Integration test for primary happy path
- [ ] Emits expected events (verify via event-bus integration test)
- [ ] Uses repository layer correctly (no direct Prisma calls outside `src/database/`)
- [ ] No architectural boundary violations (checked against `FROZEN_CONTRACTS.md`)
- [ ] Error states handled with user-friendly messages
- [ ] Loading states implemented for all async operations
- [ ] Dark mode rendering verified
- [ ] Mobile responsive layout verified (320px, 375px, 768px, 1024px breakpoints)
- [ ] Keyboard accessibility verified (Tab, Enter, Escape)
- [ ] No console errors in browser
- [ ] No memory leaks (cleanup in `useEffect` return)

---

## 2. Engine-Specific Checklist

_Applicable to deterministic engines: `validation-engine`, `eligibility-engine`, `financial-engine`, `knowledge-engine`, `dpr-engine`._

- [ ] Pure function signature (no side effects, no I/O)
- [ ] All edge cases tested (empty input, null fields, boundary values, invalid types)
- [ ] Provenance metadata correctly set on output
- [ ] State machine transitions validated (only allowed transitions)
- [ ] Performance: < 100ms for single profile evaluation

---

## 3. AI-Dependent Subsystem Checklist

_Applicable to: `interview`, `ocr-engine`, `provider-runtime`._

- [ ] Graceful degradation when AI is unavailable
- [ ] Timeout handling (configurable, default 30s)
- [ ] Retry logic with exponential backoff (configurable, max 3 retries)
- [ ] Rate limit awareness (queue requests, show user feedback)
- [ ] Streaming support where applicable
- [ ] Fallback behavior documented
- [ ] Context window management (don't exceed model limits)
- [ ] Cost estimation / awareness (token counting)
- [ ] Provider-agnostic (works with OpenAI-compatible and Anthropic-compatible endpoints)

---

## 4. UI Component Checklist

_Applicable to all components under `src/components/` and `src/app/` page files._

- [ ] Uses shadcn/ui components (no custom reimplementations of existing components)
- [ ] Consistent with design system (emerald/teal palette, no indigo/blue)
- [ ] Loading skeleton during async operations
- [ ] Error boundary for runtime errors
- [ ] Empty state with helpful message and CTA
- [ ] Tooltip / icon accessibility (`aria-label` on icon-only buttons)
- [ ] Framer Motion animations respect `prefers-reduced-motion`
- [ ] Sticky footer maintained (`min-h-screen flex flex-col`, `mt-auto`)
- [ ] Print styles where applicable

---

## 5. API Route Checklist

_Applicable to all files under `src/app/api/`._

- [ ] Input validation with Zod schemas
- [ ] Authentication check (when applicable)
- [ ] Proper HTTP status codes (`200`, `201`, `400`, `401`, `404`, `409`, `422`, `500`)
- [ ] Error responses follow centralized error-handler format (`src/app/api/error-handler.ts`)
- [ ] Rate limiting awareness
- [ ] No sensitive data in response (API keys masked)
- [ ] Request/response types exported from `src/shared/types/`

---

## 6. Database Checklist

_Applicable to any change involving `prisma/schema.prisma` or `src/database/`._

- [ ] Schema changes via Prisma only (edit `schema.prisma`, run `db:push`)
- [ ] Migrations documented
- [ ] No N+1 queries
- [ ] JSON columns have type-safe read/write helpers
- [ ] Indexes on frequently queried columns

---

## 7. State Machine Checklist

_Applicable to any code that reads, writes, or transitions project state._

- [ ] Only valid transitions allowed (per state machine specification)
- [ ] Invalid transitions throw descriptive errors
- [ ] State persisted to database on every transition
- [ ] Resume behavior tested (open existing project → correct state restored)
- [ ] Edit behavior tested (edit field → forward states invalidated, not deleted)

---

## 8. Architecture Guardian Review

_Final gate. The Architecture Guardian verifies these independently._

- [ ] No frozen contract violations
- [ ] No circular imports
- [ ] Dependency direction correct:
  - `engines` ← `shared` (engines consume shared, never the reverse)
  - `features` → `engines` (features delegate to engines, never the reverse)
  - Features never import other features directly
- [ ] Event bus used for cross-subsystem communication (no direct imports between features)
- [ ] No business logic in UI components or API routes (delegate to engines/features)

---

## 9. Merge Requirements

_Administrative gate applied before the branch is merged._

- [ ] All applicable checklist items above passed
- [ ] Squashed into a single conventional commit (`feat:`, `fix:`, `chore:`, `docs:` prefix)
- [ ] Commit message references the subsystem and applicable checklist section(s)
- [ ] `worklog.md` updated with Task ID, Agent, Work Log, Stage Summary

---

## 10. Release Candidate (v1.0) Additional

_Beyond per-subsystem DoD. These gates apply to the release as a whole._

- [ ] End-to-end interview flow completes without errors
- [ ] Full project lifecycle works: `Draft → Interview → Review → Confirmed → Eligibility → Financial → DPR → PDF → Exported`
- [ ] At least one AI provider configured and tested
- [ ] PDF output is bank-ready
- [ ] OCR handles at least Aadhaar and PAN
- [ ] All 7 deterministic engines pass 80%+ branch coverage
- [ ] Lighthouse score > 90 for Performance and Accessibility
- [ ] No critical or high severity bugs open