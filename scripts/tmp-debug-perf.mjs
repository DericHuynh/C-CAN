import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";
import { createClient } from "../node_modules/@libsql/client/lib-esm/node.js";

const BASE = "http://localhost:8080";
const db = createClient({ url: "file:data/app.db" });
const COPY_ID = `dbg-${Date.now()}`;
const real = await db.execute("SELECT * FROM projects WHERE id = ?", ["6b720717-6aa2-4554-a575-463f7f5e97a7"]);
const row = real.rows[0];
const cols = Object.keys(row);
await db.execute(`INSERT INTO projects (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => (c === "id" ? COPY_ID : row[c])));

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: "dark" });
const page = await context.newPage();

await page.goto(`${BASE}/_agent-native/sign-in`, { waitUntil: "networkidle" });
await page.locator('button[data-tab="login"]').click();
await page.locator("#l-email").fill("viewer-check@local.test");
await page.locator('button[type="submit"]:has-text("Sign in")').click();
await page.waitForTimeout(1200);
const pw = page.locator('input[type="password"]:visible');
if ((await pw.count()) > 0) {
  await pw.first().fill("Testpass123!");
  await page.locator('button[type="submit"]:visible').first().click();
  await page.waitForTimeout(2500);
}

await page.goto(`${BASE}/projects/${COPY_ID}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("text=Add row", { timeout: 60000 });
await page.waitForTimeout(1500);

const t0 = Date.now();
await page.locator("div.group.relative.flex.pl-8").first().click();
await page.waitForSelector('input[id="choice-title"]', { timeout: 10000 });
await page.waitForTimeout(500);
console.log(`mount: ${Date.now() - t0}ms`);

const dom = await page.evaluate(() => {
  const detail = document.querySelector(".agent-native-app-main .grid")?.children[1];
  const countEls = (sel) => detail?.querySelectorAll(sel).length ?? 0;
  return {
    inputs: countEls("input"),
    buttons: countEls("button"),
    selects: countEls("[role='combobox']"),
    // Radix SelectContent items are in a portal, not inside the detail pane:
    portalItems: document.querySelectorAll("[data-radix-select-viewport] [role='option']").length,
    totalDetailElements: detail?.querySelectorAll("*").length ?? 0,
  };
});
console.log(JSON.stringify(dom, null, 1));
await db.execute("DELETE FROM projects WHERE id = ?", [COPY_ID]);
await browser.close();
