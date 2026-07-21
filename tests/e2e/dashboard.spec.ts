// ─── Dashboard E2E ──────────────────────────────────────────────────────────
// Exercises the full web app journey:
//   1. Load dashboard
//   2. Create a demo project (via createTestProfile)
//   3. Navigate to Financial review
//   4. Navigate to Eligibility
//   5. Navigate to DPR preview (18 sections)
//   6. Knowledge search
//   7. Settings (AI provider form)
//
// All assertions use accessibility-friendly locators (getByRole / getByText).
// The "Create demo project" flow seeds a fully-populated profile via
// `createTestProfile()` so every downstream screen has valid data.
// ───────────────────────────────────────────────────────────────────────────

import { test, expect, type Page } from "@playwright/test";

/**
 * Create a demo project from the dashboard and return the project profile URL.
 * Waits for navigation to /project/:id and for the profile header to render.
 */
async function createDemoProject(page: Page): Promise<string> {
  await page.goto("/");
  // Wait for the dashboard to finish loading (skeletons disappear).
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  // The "Create demo project" button appears in both the toolbar and the
  // empty-state card — click the first visible one.
  const demoButton = page.getByRole("button", { name: "Create demo project" }).first();
  await demoButton.click();
  // Wait for navigation to the project profile screen.
  await page.waitForURL(/\/project\/[^/]+$/);
  // Wait for the profile screen to finish loading the profile from the repo.
  await expect(page.getByRole("heading", { name: "Rajesh Pickle Unit" })).toBeVisible();
  return page.url();
}

// ── 1. Loads dashboard ──────────────────────────────────────────────────────

test("loads dashboard with PMEGP Assistant title", async ({ page }) => {
  await page.goto("/");
  // The header brand text.
  await expect(page.getByRole("heading", { name: "PMEGP Assistant" })).toBeVisible();
  // The dashboard's own heading.
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});

// ── 2. Create demo project ──────────────────────────────────────────────────

test("create demo project navigates to project profile and shows card on dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

  const demoButton = page.getByRole("button", { name: "Create demo project" }).first();
  await demoButton.click();

  // Should navigate to /project/:id.
  await page.waitForURL(/\/project\/[^/]+$/);
  await expect(page).toHaveURL(/\/project\/[^/]+$/);

  // The profile screen should show the demo project's business name.
  await expect(page.getByRole("heading", { name: "Rajesh Pickle Unit" })).toBeVisible();

  // Navigate back to dashboard and verify the project card appears.
  await page.getByRole("link", { name: /Dashboard/i }).first().click();
  await page.waitForURL("/");
  await expect(page.getByText("Rajesh Pickle Unit")).toBeVisible();
});

// ── 3. Navigate to financial ─────────────────────────────────────────────────

test("financial review displays computed figures (total cost, EMI, DSCR)", async ({
  page,
}) => {
  await createDemoProject(page);

  // From the project profile, click "Financial review".
  await page.getByRole("link", { name: /Financial review/i }).first().click();
  await page.waitForURL(/\/project\/[^/]+\/financial$/);

  // Wait for the financial engine output to render (skeletons disappear).
  await expect(page.getByText("Financial review")).toBeVisible();

  // KPI strip — verify the key figures are displayed. Scope to <main> so
  // the sidebar's "own contribution" text (in <aside>) is excluded. Within
  // <main>, the KPI card labels appear before the table rows, so .first()
  // picks the KPI label.
  const main = page.getByRole("main");
  await expect(main.getByText("Total project cost").first()).toBeVisible();
  await expect(main.getByText("EMI").first()).toBeVisible();
  await expect(main.getByText("DSCR").first()).toBeVisible();
  await expect(main.getByText("Own contribution").first()).toBeVisible();
  await expect(main.getByText("Subsidy").first()).toBeVisible();

  // The full figures table should contain the EMI row.
  await expect(page.getByText("All financial figures")).toBeVisible();
  await expect(page.getByText("EMI (monthly)")).toBeVisible();
});

// ── 4. Navigate to eligibility ───────────────────────────────────────────────

test("eligibility screen shows eligible/ineligible banner", async ({ page }) => {
  await createDemoProject(page);

  await page.getByRole("link", { name: /Eligibility check/i }).first().click();
  await page.waitForURL(/\/project\/[^/]+\/eligibility$/);

  // Wait for the eligibility engine to render.
  await expect(page.getByText(/Eligibility ·/)).toBeVisible();

  // The banner must say either "Eligible" or "Not eligible".
  const eligibleBanner = page.getByRole("heading", {
    name: /Eligible for PMEGP subsidy|Not eligible for PMEGP subsidy/i,
  });
  await expect(eligibleBanner).toBeVisible();

  // The checklist should also be present.
  await expect(page.getByText("Eligibility checklist")).toBeVisible();
});

// ── 5. Navigate to DPR ───────────────────────────────────────────────────────

test("DPR preview renders 18 sections in an accordion", async ({ page }) => {
  await createDemoProject(page);

  await page.getByRole("link", { name: /Generate DPR/i }).first().click();
  await page.waitForURL(/\/project\/[^/]+\/dpr$/);

  // Wait for the DPR engine to generate the document.
  await expect(page.getByText(/DPR preview ·/)).toBeVisible();

  // The card description confirms 18 sections were generated.
  await expect(page.getByText(/All 18 sections/)).toBeVisible();

  // Count accordion trigger buttons (each has aria-expanded).
  // All 18 start collapsed (expanded=false).
  const accordionTriggers = page.getByRole("button", { expanded: false });
  await expect(accordionTriggers).toHaveCount(18);

  // Expand the first section and verify content renders.
  await accordionTriggers.first().click();
  // The expanded trigger should now have expanded=true.
  await expect(page.getByRole("button", { expanded: true })).toHaveCount(1);
});

// ── 6. Knowledge search ──────────────────────────────────────────────────────

test("knowledge search returns results for a query", async ({ page }) => {
  await page.goto("/knowledge");

  await expect(page.getByRole("heading", { name: "Knowledge search" })).toBeVisible();

  // The search input is pre-filled with "pickle" and results are shown by
  // default. Clear and search for a different term to exercise the flow.
  const searchInput = page.getByLabel("Query");
  await searchInput.clear();
  await searchInput.fill("bakery");
  await page.getByRole("button", { name: "Search" }).click();

  // Results card should appear with a count > 0.
  const resultsHeading = page.getByText(/Results \(\d+\)/);
  await expect(resultsHeading).toBeVisible();
  const headingText = (await resultsHeading.textContent()) ?? "";
  const match = headingText.match(/\((\d+)\)/);
  const resultCount = match ? parseInt(match[1], 10) : 0;
  expect(resultCount, `Expected results for "bakery", got: ${headingText}`).toBeGreaterThan(0);
});

// ── 7. Settings ──────────────────────────────────────────────────────────────

test("settings screen shows AI provider form", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // The AI provider card title (exact match — "AI provider" also appears
  // in the page subtitle).
  await expect(page.getByText("AI provider", { exact: true })).toBeVisible();

  // The form fields should be present and editable.
  await expect(page.getByLabel("Base URL")).toBeVisible();
  await expect(page.getByLabel("API key")).toBeVisible();
  await expect(page.getByLabel("Model name")).toBeVisible();

  // The Test connection and Save buttons (exact match — the settings page
  // also has a "Save PIN" button which would cause a strict-mode violation).
  await expect(page.getByRole("button", { name: /Test connection/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
});
