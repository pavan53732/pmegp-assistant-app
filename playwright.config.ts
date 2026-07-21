// ─── Playwright E2E Configuration ───────────────────────────────────────────
// Runs the full PMEGP Assistant web app journey end-to-end. The dev server
// (`bun run dev` → Vite on http://localhost:3000) is started automatically by
// the `webServer` block and reused if already running.
//
// Two browser projects:
//   • chromium  — Desktop Chrome (1280×720)
//   • mobile    — Pixel 5 (393×851, touch + mobile UA)
//
// Tests live in `tests/e2e/`. Run with `bunx playwright test` (or
// `npx playwright test`). See `docs/E2E_TESTING.md` for the full guide.
// ───────────────────────────────────────────────────────────────────────────

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 1,
  reporter: "html",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
