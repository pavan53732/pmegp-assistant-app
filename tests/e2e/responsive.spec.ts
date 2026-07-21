// ─── Responsive E2E (Mobile) ────────────────────────────────────────────────
// Verifies the mobile layout:
//   1. On a Pixel 5 viewport, the bottom tab bar is visible.
//   2. The sidebar is hidden.
//   3. Navigation works via the bottom tab bar.
//   4. All interactive touch targets are at least 44px tall.
//
// These tests force a mobile viewport via `test.use({ viewport })` so they
// pass in both the "chromium" and "mobile" projects.
// ───────────────────────────────────────────────────────────────────────────

import { test, expect, type Locator } from "@playwright/test";

// Force a mobile viewport for all tests in this file (Pixel 5 = 393×851).
test.use({ viewport: { width: 393, height: 851 } });

test.describe("Mobile responsive layout", () => {
  test("bottom tab bar is visible and sidebar is hidden", async ({ page }) => {
    await page.goto("/");

    // The header brand should still be visible.
    await expect(page.getByRole("heading", { name: "PMEGP Assistant" })).toBeVisible();

    // The bottom tab bar is a <nav> element (the only <nav> on the page).
    const bottomTabBar = page.getByRole("navigation");
    await expect(bottomTabBar).toBeVisible();

    // The sidebar is an <aside> — it should be hidden on mobile.
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeHidden();

    // The bottom tab bar should contain links for all 4 primary routes.
    await expect(bottomTabBar.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(bottomTabBar.getByRole("link", { name: "Knowledge" })).toBeVisible();
    await expect(bottomTabBar.getByRole("link", { name: "OCR" })).toBeVisible();
    await expect(bottomTabBar.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("navigation works via the bottom tab bar", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    const bottomTabBar = page.getByRole("navigation");

    // Tap "Knowledge" in the bottom tab bar.
    await bottomTabBar.getByRole("link", { name: "Knowledge" }).click();
    await page.waitForURL("/knowledge");
    await expect(page.getByRole("heading", { name: "Knowledge search" })).toBeVisible();

    // Tap "Settings".
    await bottomTabBar.getByRole("link", { name: "Settings" }).click();
    await page.waitForURL("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Tap "Dashboard" to go back.
    await bottomTabBar.getByRole("link", { name: "Dashboard" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  });

  test("bottom tab bar touch targets are at least 44px tall", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    const bottomTabBar = page.getByRole("navigation");
    const tabLinks = bottomTabBar.getByRole("link");

    const count = await tabLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Each tab link must be at least 44px tall (WCAG 2.5.5 touch target).
    for (let i = 0; i < count; i++) {
      const box = await tabLinks.nth(i).boundingBox();
      expect(box, `Tab link ${i} had no bounding box`).not.toBeNull();
      expect(box!.height, `Tab link ${i} is only ${box!.height}px tall`).toBeGreaterThanOrEqual(44);
    }
  });

  test("dashboard CTAs meet 44px touch target on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    // The "New Project" and "Create demo project" buttons must be ≥44px.
    const newProjectBtn = page.getByRole("button", { name: "New Project" }).first();
    const demoBtn = page.getByRole("button", { name: "Create demo project" }).first();

    await assertMinTouchTarget(newProjectBtn, "New Project");
    await assertMinTouchTarget(demoBtn, "Create demo project");
  });
});

/**
 * Assert that a locator's element is at least 44×44 CSS pixels (WCAG 2.5.5).
 */
async function assertMinTouchTarget(locator: Locator, label: string): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} had no bounding box`).not.toBeNull();
  expect(box!.height, `${label} is only ${box!.height}px tall (need ≥44)`).toBeGreaterThanOrEqual(44);
  expect(box!.width, `${label} is only ${box!.width}px wide (need ≥44)`).toBeGreaterThanOrEqual(44);
}
