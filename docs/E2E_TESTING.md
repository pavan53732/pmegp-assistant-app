# E2E Testing Guide (Playwright)

End-to-end tests for the PMEGP Assistant web app, covering the full user
journey: dashboard → create demo project → financial review → eligibility →
DPR → knowledge search → settings, plus offline-first and mobile-responsive
verifications.

## Quick start

```bash
# From the project root:

# Run all E2E tests (chromium + mobile projects)
bunx playwright test

# Or with npx:
npx playwright test
```

The `webServer` block in `playwright.config.ts` automatically starts the Vite
dev server (`bun run dev` on port 3000) if it isn't already running. You do
**not** need to start it manually.

> **Note:** `@playwright/test` is already listed as a devDependency in
> `package.json`. No `package.json` changes are needed to run these tests.

## Running specific tests

```bash
# Run a single test file
bunx playwright test tests/e2e/dashboard.spec.ts

# Run a single test by name (substring match)
bunx playwright test -g "create demo project"

# Run only the chromium project (desktop)
bunx playwright test --project=chromium

# Run only the mobile project (Pixel 5)
bunx playwright test --project=mobile
```

## Viewing the HTML report

After a run, Playwright generates an HTML report:

```bash
# Open the last report in your browser
bunx playwright show-report
```

The report includes:
- Pass/fail status per test per project
- Screenshots on failure
- Full trace (DOM snapshot, network, console) on first retry

## Debugging

```bash
# UI mode — interactive test runner with step-by-step inspector
bunx playwright test --ui

# Headed mode — watch the browser run the tests
bunx playwright test --headed

# Debug mode — pauses on each step, Inspector panel open
bunx playwright test --debug

# Run a single test in debug mode
bunx playwright test tests/e2e/offline.spec.ts --debug
```

## Test files

| File | Tests | What it covers |
|------|-------|----------------|
| `tests/e2e/dashboard.spec.ts` | 7 | Full app journey: dashboard, demo project, financial, eligibility, DPR (18 sections), knowledge search, settings |
| `tests/e2e/offline.spec.ts` | 1 | Offline-first guarantee: go offline, navigate to financial, verify no network errors |
| `tests/e2e/responsive.spec.ts` | 4 | Mobile layout: bottom tab bar visible, sidebar hidden, tab navigation, 44px touch targets |

**Total: 12 test definitions × 2 projects (chromium + mobile) = 24 executions.**

## Browser projects

Defined in `playwright.config.ts`:

| Project | Device | Viewport |
|---------|--------|----------|
| `chromium` | Desktop Chrome | 1280×720 |
| `mobile` | Pixel 5 | 393×851 (touch + mobile UA) |

All tests run in both projects by default. The `responsive.spec.ts` file forces
a mobile viewport via `test.use({ viewport })` so the layout assertions hold
regardless of which project executes them.

## Test data strategy

Tests are **deterministic** — they do not rely on pre-seeded data or external
APIs. Each test that needs a project uses the Dashboard's "Create demo project"
button, which calls `createTestProfile()` to seed a fully-populated profile:

- **Business name:** Rajesh Pickle Unit
- **Activity:** Manufacturing (NIC 103005 — pickles & chutney)
- **Total project cost:** ₹1,10,000
- **All 28 mandatory fields filled**

Each Playwright test gets a fresh browser context (fresh IndexedDB), so there's
no cross-test contamination.

## Locator strategy

All locators are accessibility-friendly (no brittle CSS selectors):

```typescript
// ✅ Good — semantic roles
page.getByRole("button", { name: "Create demo project" })
page.getByRole("heading", { name: "PMEGP Assistant" })
page.getByRole("link", { name: /Financial review/i })
page.getByRole("button", { expanded: false })  // accordion triggers

// ✅ Good — visible text
page.getByText("Total project cost")
page.getByText(/All 18 sections/)

// ✅ Good — form labels
page.getByLabel("Base URL")
page.getByLabel("API key")
```

## Handling async loading

The app loads project data from the local SQLite repository (async). Screens
show shadcn `<Skeleton>` placeholders during load. Tests use `expect(...).toBeVisible()`
which auto-retries until the element appears (default 10s timeout). For
navigation, `page.waitForURL()` waits for the route change.

## CI integration

```bash
# In CI, install browsers first:
bunx playwright install --with-deps chromium

# Then run (exit code non-zero on any failure):
bunx playwright test --project=chromium
```

The HTML reporter output can be published as a CI artifact for debugging.

## Troubleshooting

**"Timed out waiting for port 3000"** — The dev server didn't start in 30s.
Check `bun run dev` works manually. You can also start it yourself in a
separate terminal; `reuseExistingServer: true` will pick it up.

**"Element not visible"** — The screen is still showing skeletons. Increase
the expect timeout or add a more specific wait condition. Most screens settle
within 2s.

**Offline test fails with network errors** — The filter excludes HMR/WebSocket
noise. If you see a real `net::ERR` error, the app made an unexpected network
call — that's a genuine bug.

**Mobile test fails on desktop project** — The `responsive.spec.ts` file forces
a mobile viewport, so it should pass in both projects. If it fails in
`chromium`, check that the viewport override is applied (`test.use` at the top
of the file).
