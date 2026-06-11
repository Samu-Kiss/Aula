// Resumen compacto de violaciones axe por ruta (apoyo F6-19/20).
// Uso: node e2e/axe-summary.mjs
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.AULA_E2E_EMAIL ?? "test.profe@gmail.com";
const PASSWORD = process.env.AULA_E2E_PASSWORD ?? "profe";
const SLUG = process.env.AULA_E2E_CLASS_SLUG ?? "geografia-de-colombia";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();

// login
await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/);

const classLink = await page
  .locator('a[href^="/dashboard/clases/"]:not([href$="/nueva"])')
  .first()
  .getAttribute("href");

const routes = [
  "/",
  "/login",
  `/c/${SLUG}`,
  `/c/${SLUG}/regiones-naturales`,
  `/c/${SLUG}/regiones-naturales/quiz-regiones-naturales`,
  "/dashboard",
  classLink,
  `${classLink}/estudiantes`,
  `${classLink}/calificaciones`,
  `${classLink}/intentos`,
  `${classLink}/configuracion`,
  "/dashboard/clases/nueva",
  "/dashboard/notificaciones",
  "/dashboard/archivo",
];

for (const route of routes) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  const res = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  console.log(`\n=== ${route}`);
  for (const v of res.violations) {
    const targets = v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join(" | ");
    console.log(`  [${v.impact}] ${v.id} ×${v.nodes.length} :: ${targets}`);
  }
  if (res.violations.length === 0) console.log("  ok");
}

await browser.close();
