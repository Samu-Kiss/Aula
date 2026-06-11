// Sondea qué elementos desbordan el viewport móvil en una ruta dada.
import { chromium } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.AULA_E2E_EMAIL ?? "test.profe@gmail.com";
const PASSWORD = process.env.AULA_E2E_PASSWORD ?? "profe";
const ROUTE = process.argv[2] ?? "/dashboard";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/);

await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle" });
const report = await page.evaluate(() => {
  const vw = window.innerWidth;
  const out = [];
  document.querySelectorAll("*").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.width > vw + 1) {
      out.push(`${Math.round(r.width)}px right=${Math.round(r.right)} <${el.tagName.toLowerCase()} class="${(el.className?.toString() ?? "").slice(0, 90)}">`);
    }
  });
  return { vw, doc: document.documentElement.scrollWidth, out: out.slice(0, 25) };
});
console.log(`viewport=${report.vw} doc=${report.doc}`);
for (const l of report.out) console.log(" ", l);
await browser.close();
