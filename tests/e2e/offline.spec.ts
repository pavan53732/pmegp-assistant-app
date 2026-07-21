// ─── Offline E2E ────────────────────────────────────────────────────────────
// Verifies the app's offline-first guarantee:
//   1. Load the dashboard (online).
//   2. Create a demo project (writes to local SQLite/IndexedDB).
//   3. Go offline (context.setOffline(true)).
//   4. Navigate to the Financial review — verify it still renders computed
//      figures. The financial engine is pure/synchronous and the profile is
//      loaded from local storage, so no network calls are needed.
//   5. Verify no app-level network errors appear in the console.
//
// HMR / dev-server WebSocket disconnect noise is filtered out — only real
// app network errors (fetch / XHR failures) count as failures.
// ───────────────────────────────────────────────────────────────────────────

import { test, expect } from "@playwright/test";

/** Patterns that indicate dev-server / HMR noise (not app errors). */
const HMR_NOISE = [
  /websocket/i,
  /sockjs/i,
  /\bhmr\b/i,
  /vite/i,
  /dev server/i,
  /hot reload/i,
];

/** Patterns that indicate a real network failure. */
const NETWORK_ERROR = /net::ERR|Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED|ERR_NETWORK/i;

test("financial review works fully offline with no network errors", async ({
  page,
  context,
}) => {
  // Collect console errors and page errors throughout the test.
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  // ── Step 1: Load dashboard (online) ──────────────────────────────────────
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

  // ── Step 2: Create a demo project ────────────────────────────────────────
  const demoButton = page
    .getByRole("button", { name: "Create demo project" })
    .first();
  await demoButton.click();
  await page.waitForURL(/\/project\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Rajesh Pickle Unit" })).toBeVisible();

  // ── Step 3: Go offline ───────────────────────────────────────────────────
  await context.setOffline(true);

  // ── Step 4: Navigate to financial review (client-side route, no reload) ──
  await page.getByRole("link", { name: /Financial review/i }).first().click();
  await page.waitForURL(/\/project\/[^/]+\/financial$/);

  // Wait for the financial engine output to render. If the app made any
  // network call, this would hang or show an error. Scope to <main> so the
  // sidebar's "own contribution" text is excluded on desktop viewports.
  await expect(page.getByText("Financial review")).toBeVisible({ timeout: 15_000 });
  const main = page.getByRole("main");
  await expect(main.getByText("Total project cost").first()).toBeVisible();
  await expect(main.getByText("EMI").first()).toBeVisible();
  await expect(main.getByText("DSCR").first()).toBeVisible();

  // Give the page a moment to settle so any delayed console errors surface.
  await page.waitForTimeout(1_000);

  // ── Step 5: Verify no app-level network errors ───────────────────────────
  // Filter out HMR / dev-server disconnect noise.
  const realNetworkErrors = consoleErrors.filter(
    (e) => NETWORK_ERROR.test(e) && !HMR_NOISE.some((p) => p.test(e)),
  );
  const realPageErrors = pageErrors.filter(
    (e) => NETWORK_ERROR.test(e) && !HMR_NOISE.some((p) => p.test(e)),
  );

  expect(realNetworkErrors, `Console network errors: ${realNetworkErrors.join("; ")}`).toEqual([]);
  expect(realPageErrors, `Page network errors: ${realPageErrors.join("; ")}`).toEqual([]);

  // Restore online state for any subsequent tests.
  await context.setOffline(false);
});
