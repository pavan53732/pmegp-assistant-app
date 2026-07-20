---
Task ID: 4
Agent: Dashboard & Bug Fix Agent
Task: Fix critical dialog bug + dramatically improve dashboard UI with new features

Files Created:
- src/app/api/projects/[id]/route.ts — DELETE endpoint for project deletion
- src/components/dashboard/subsidy-calculator.tsx — Subsidy Calculator quick tool
- src/components/dashboard/eligibility-checker.tsx — Eligibility Checker quick tool
- src/components/dashboard/scheme-info.tsx — Scheme Info display card

Files Modified:
- src/app/page.tsx — Complete dashboard redesign, Dialog bug fix

Key Changes:
1. CRITICAL BUG FIX: Removed `forceMount={true}` and `modal={false}` from Dialog component. These props caused Radix UI overlay to intercept click events, making the "Create & Start Interview" button non-functional.

2. DELETE /api/projects/[id]: Uses ProjectRepository.delete() with P2025 (not found) error handling.

3. Dashboard Redesign:
   - Hero: Gradient emerald banner with decorative blurs, gradient text, hover-glow CTA button
   - Stats: 4-column grid (Total, In Progress, Completed, DPR Ready) with colored icon boxes
   - Project List: Search input, colored left-border per status, styled badges, created+updated dates, delete with AlertDialog confirmation
   - Empty State: Illustration placeholder with CTA button
   - Quick Tools: 3 Collapsible cards (Subsidy Calculator, Eligibility Checker, Scheme Info)
   - Footer: 2-column layout with branding + resource links
   - Header: Sticky with backdrop blur
   - Responsive: Mobile-first with sm/md/lg breakpoints

4. Subsidy Calculator: Supports all 5 categories, Urban/Rural, correct PMEGP rates, ₹25L max cap warning.

5. Eligibility Checker: Age (18-65), category, education, prior subsidy checks with pass/fail display.

6. All lint checks pass. Dev server compiles cleanly.