# Release Checklist — PMEGP Assistant

> Final gate before each release. All items must pass before tagging.

---

## Pre-Release Quality Gate

- [ ] `bun run lint` passes with zero errors
- [ ] `npx tsc --noEmit` passes with zero errors (in `src/` only, excluding `examples/` and `skills/`)
- [ ] All existing tests pass
- [ ] No new architectural boundary violations (check against `FROZEN_CONTRACTS.md`)
- [ ] `DEFINITION_OF_DONE.md` checklist satisfied for all changed subsystems

---

## AI Interview

- [ ] End-to-end interview flow completes without errors
- [ ] AI provider switching works (configure → interview → switch → interview)
- [ ] Streaming responses work correctly
- [ ] Chat history persists and restores on re-enter
- [ ] Stop button cancels in-flight requests
- [ ] All 7 interview phases progress correctly
- [ ] Location fields collected (state, district, area, hill/border)
- [ ] Financial totals compute correctly (not ₹0)

---

## Engine Pipeline

- [ ] Eligibility check runs and produces correct results
- [ ] Financial analysis runs (DSCR, break-even, P&L)
- [ ] DPR generates all 18 sections without errors
- [ ] PDF generates from DPR without errors
- [ ] Pipeline state transitions are correct (`VALIDATED` → `ELIGIBILITY_READY` → `FINANCIAL_READY` → `DPR_READY`)
- [ ] Pipeline errors are handled gracefully (no crash)

---

## PDF Output

- [ ] Cover page renders with correct applicant details
- [ ] All tables render with proper alignment
- [ ] Headers and footers on every page
- [ ] Page numbers correct
- [ ] Indian number formatting (₹1,23,456)
- [ ] Print-friendly layout

---

## Data & Persistence

- [ ] SQLite database schema is correct
- [ ] All JSON columns read/write correctly
- [ ] Chat history persists (max 200 messages)
- [ ] Project CRUD operations work
- [ ] AI provider config persists

---

## UI & Accessibility

- [ ] Dashboard renders on mobile (375px)
- [ ] Dashboard renders on tablet (768px)
- [ ] Dashboard renders on desktop (1440px)
- [ ] Dark mode works across all components
- [ ] Sticky footer maintained
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Notification center works
- [ ] Settings dialog saves correctly

---

## Performance

- [ ] Initial page load < 3 seconds
- [ ] Quick tools lazy-loaded (`React.lazy`)
- [ ] No unnecessary re-renders
- [ ] Database queries are efficient

---

## Release

- [ ] Git history clean (no UUID commits)
- [ ] All commits pushed to main
- [ ] `worklog.md` updated with session summary
- [ ] Version number updated (if applicable)