/**
 * F6-19: Accessibility audit con axe-core sobre las rutas principales.
 * F6-18/F6-21 (apoyo): chequeo de overflow horizontal y tap targets en móvil.
 *
 * Requiere una instancia corriendo (igual que smoke.spec.ts) y datos locales:
 *  - Profesor: AULA_E2E_EMAIL / AULA_E2E_PASSWORD (default: test.profe@gmail.com / profe)
 *  - Clase pública: AULA_E2E_CLASS_SLUG (default: geografia-de-colombia)
 *
 * Fallan el test las violaciones axe critical/serious. Las moderate/minor,
 * el overflow y los tap targets pequeños se reportan como anotaciones.
 */

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const EMAIL = process.env.AULA_E2E_EMAIL ?? "test.profe@gmail.com";
const PASSWORD = process.env.AULA_E2E_PASSWORD ?? "profe";
const CLASS_SLUG = process.env.AULA_E2E_CLASS_SLUG ?? "geografia-de-colombia";

const MOBILE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1366, height: 900 };

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function runAxe(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  const minor = results.violations.filter(
    (v) => v.impact !== "critical" && v.impact !== "serious"
  );
  if (minor.length > 0) {
    test.info().annotations.push({
      type: `axe-minor (${label})`,
      description: minor
        .map((v) => `${v.id} [${v.impact}] ×${v.nodes.length}`)
        .join("; "),
    });
  }
  expect(
    serious,
    `Violaciones axe critical/serious en ${label}:\n` +
      serious
        .map(
          (v) =>
            `  ${v.id} [${v.impact}]: ${v.help}\n` +
            v.nodes
              .slice(0, 5)
              .map((n) => `    → ${n.target.join(" ")}`)
              .join("\n")
        )
        .join("\n")
  ).toEqual([]);
}

async function checkNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    return { docWidth, viewport: window.innerWidth, overflows: docWidth > window.innerWidth + 1 };
  });
  expect(
    overflow.overflows,
    `Overflow horizontal en ${label}: contenido ${overflow.docWidth}px > viewport ${overflow.viewport}px`
  ).toBe(false);
}

async function reportSmallTapTargets(page: Page, label: string) {
  const small = await page.evaluate(() => {
    const MIN = 24; // mínimo duro (WCAG 2.5.8); lo deseable es 44
    const out: string[] = [];
    document
      .querySelectorAll<HTMLElement>("a[href], button, input, select, textarea, [role='button']")
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return; // oculto
        if (r.height < MIN || r.width < MIN) {
          const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
          out.push(`${el.tagName.toLowerCase()} "${text}" ${Math.round(r.width)}×${Math.round(r.height)}`);
        }
      });
    return out.slice(0, 20);
  });
  if (small.length > 0) {
    test.info().annotations.push({
      type: `tap-targets <24px (${label})`,
      description: small.join("; "),
    });
  }
}

// ─── Rutas públicas (sin sesión) ──────────────────────────────────────────────

const publicRoutes: Array<{ name: string; path: string }> = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "clase pública", path: `/c/${CLASS_SLUG}` },
];

for (const route of publicRoutes) {
  test(`a11y: ${route.name} (desktop)`, async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(route.path);
    await runAxe(page, `${route.name} desktop`);
  });

  test(`responsive: ${route.name} sin overflow en móvil`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto(route.path);
    await checkNoHorizontalOverflow(page, `${route.name} @375px`);
    await reportSmallTapTargets(page, `${route.name} @375px`);
  });

  test(`responsive: ${route.name} sin overflow en tablet`, async ({ page }) => {
    await page.setViewportSize(TABLET);
    await page.goto(route.path);
    await checkNoHorizontalOverflow(page, `${route.name} @768px`);
  });
}

// ─── Rutas del dashboard (con sesión de profesor) ─────────────────────────────

test.describe("dashboard", () => {
  test("a11y + responsive: listado de clases", async ({ page }) => {
    await login(page);
    await page.setViewportSize(DESKTOP);
    await runAxe(page, "dashboard desktop");
    await page.setViewportSize(MOBILE);
    await checkNoHorizontalOverflow(page, "dashboard @375px");
    await reportSmallTapTargets(page, "dashboard @375px");
  });

  test("a11y + responsive: editor de clase y secciones", async ({ page }) => {
    test.slow(); // 5 secciones × axe contra el dev server
    await login(page);
    // Entrar a la primera clase del listado
    const classLink = page
      .locator('a[href^="/dashboard/clases/"]:not([href$="/nueva"])')
      .first();
    await classLink.click();
    await page.waitForURL(/\/dashboard\/clases\/[0-9a-f-]+$/, { timeout: 10000 });
    const classUrl = page.url();

    for (const section of ["", "/estudiantes", "/calificaciones", "/intentos", "/configuracion"]) {
      await page.goto(classUrl + section);
      await page.setViewportSize(DESKTOP);
      await runAxe(page, `clase${section || "/overview"} desktop`);
      await page.setViewportSize(MOBILE);
      await checkNoHorizontalOverflow(page, `clase${section || "/overview"} @375px`);
      await reportSmallTapTargets(page, `clase${section || "/overview"} @375px`);
    }
  });

  test("a11y + responsive: nueva clase, notificaciones y archivo", async ({ page }) => {
    await login(page);
    for (const path of ["/dashboard/clases/nueva", "/dashboard/notificaciones", "/dashboard/archivo"]) {
      await page.goto(path);
      await page.setViewportSize(DESKTOP);
      await runAxe(page, `${path} desktop`);
      await page.setViewportSize(MOBILE);
      await checkNoHorizontalOverflow(page, `${path} @375px`);
    }
  });
});

// ─── Vista pública de la clase: módulo y contenido ────────────────────────────

test("a11y + responsive: módulo y contenido públicos", async ({ page }) => {
  await page.goto(`/c/${CLASS_SLUG}`);
  const moduleLink = page.locator(`a[href^="/c/${CLASS_SLUG}/"]`).first();
  const count = await moduleLink.count();
  test.skip(count === 0, "La clase no tiene módulos publicados");

  await moduleLink.click();
  await page.waitForLoadState("networkidle");
  await page.setViewportSize(DESKTOP);
  await runAxe(page, "módulo público desktop");
  await page.setViewportSize(MOBILE);
  await checkNoHorizontalOverflow(page, "módulo público @375px");
  await reportSmallTapTargets(page, "módulo público @375px");
});
