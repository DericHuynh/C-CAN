/**
 * Screenshots of the paginated editor for visual confirmation.
 * Usage: PROJECT_ID=<copy> node scripts/tmp-screenshot.mjs
 */
import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";

const BASE = "http://localhost:8080";
const PROJECT_ID = process.env.PROJECT_ID;
const EMAIL = "viewer-check@local.test";
const PASSWORD = "Testpass123!";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: "dark" });
const page = await context.newPage();

await page.goto(`${BASE}/_agent-native/sign-in`, { waitUntil: "networkidle" });
await page.locator('button[data-tab="login"]').click();
await page.locator("#l-email").fill(EMAIL);
await page.locator('button[type="submit"]:has-text("Sign in")').click();
await page.waitForTimeout(1200);
const pw = page.locator('input[type="password"]:visible');
if ((await pw.count()) > 0) {
  await pw.first().fill(PASSWORD);
  await page.locator('button[type="submit"]:visible').first().click();
}
await page.waitForTimeout(1500);

await page.goto(`${BASE}/projects/${PROJECT_ID}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("text=Add row", { timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "scripts/tmp-tree-paginated.png" });

// Open a row, then the lazy image dropdown.
await page.locator("div.group.relative.flex").first().click();
await page.waitForSelector("#row-title", { timeout: 10000 });
await page.locator("#row-image").click();
await page.waitForSelector('input[placeholder="Search…"]', { timeout: 5000 });
await page.screenshot({ path: "scripts/tmp-lazy-select-open.png" });
await page.keyboard.press("Escape");

await page.goto(`${BASE}/projects/${PROJECT_ID}?tab=images`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("text=Add image", { timeout: 60000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "scripts/tmp-images-paginated.png" });

await browser.close();
console.log("screenshots saved");
