// Lista controles interactivos menores a 24px (duro) y 44px (deseable) a 375px.
import { chromium } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.AULA_E2E_EMAIL ?? "test.profe@gmail.com";
const PASSWORD = process.env.AULA_E2E_PASSWORD ?? "profe";
const SLUG = process.env.AULA_E2E_CLASS_SLUG ?? "geografia-de-colombia";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();

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
  `/c/${SLUG}`,
  `/c/${SLUG}/regiones-naturales`,
  `/c/${SLUG}/regiones-naturales/quiz-regiones-naturales`,
  "/dashboard",
  classLink,
  `${classLink}/estudiantes`,
  `${classLink}/intentos`,
];

for (const route of routes) {
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  const rows = await page.evaluate(() => {
    const out = [];
    document
      .querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role='button']")
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const min = Math.min(r.width, r.height);
        if (min < 24) {
          const text = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
          out.push(`HARD ${Math.round(r.width)}×${Math.round(r.height)} <${el.tagName.toLowerCase()}> "${text}"`);
        }
      });
    return out.slice(0, 15);
  });
  console.log(`\n=== ${route}`);
  rows.forEach((r) => console.log("  ", r));
  if (rows.length === 0) console.log("   ok (todo ≥24px)");
}
await browser.close();
