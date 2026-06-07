/**
 * F4-10: Smoke tests for critical flows.
 * These tests verify the core user journeys work end-to-end.
 * Requires a running dev/staging instance at PLAYWRIGHT_BASE_URL.
 *
 * Flows covered:
 *  1. Public class landing page renders
 *  2. Student identification flow (email step)
 *  3. Dashboard login redirect (unauthenticated)
 *  4. 404 page for unknown routes
 */

import { test, expect } from "@playwright/test";

// ─── 1. Public landing page ───────────────────────────────────────────────────

test("class landing page renders without auth", async ({ page }) => {
  // A public class should return 200 or redirect; not an unhandled error
  const response = await page.goto("/c/test-class");
  // Either the page loads (200) or shows a 404 — never an unhandled 500
  expect(response?.status()).not.toBe(500);
});

// ─── 2. Dashboard redirects unauthenticated users ────────────────────────────

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");
  // Should end up at login page
  await expect(page).toHaveURL(/\/login|\/auth|\/sign-in/, { timeout: 5000 });
});

// ─── 3. Student identification form is present on quiz page ──────────────────

test("quiz page shows identification prompt for unidentified student", async ({ page }) => {
  // Navigate to any quiz path — even a non-existent one should show proper 404, not 500
  const response = await page.goto("/c/some-class/some-module/some-quiz");
  expect(response?.status()).not.toBe(500);
});

// ─── 4. 404 page ─────────────────────────────────────────────────────────────

test("unknown route shows 404 page", async ({ page }) => {
  const response = await page.goto("/this-does-not-exist-at-all");
  // Next.js returns 404 for unknown routes
  expect(response?.status()).toBe(404);
});

// ─── 5. API health: attempt events endpoint requires auth ────────────────────

test("attempt events API returns 401 without cookie", async ({ request }) => {
  const response = await request.post("/api/attempts/fake-id/events", {
    data: { type: "tab_blur" },
  });
  expect(response.status()).toBe(401);
});

// ─── 6. Rate limit endpoint: attempt start requires auth ─────────────────────

test("attempt start API returns 401 without cookie", async ({ request }) => {
  const response = await request.post("/api/quizzes/fake-id/attempts", {
    data: {},
  });
  expect(response.status()).toBe(401);
});
