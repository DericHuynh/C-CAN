import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/home/deric/git/C-CAN/node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.js");

const BASE = "http://localhost:8080";
const PROJECT_ID = process.argv[2] || "503b0648-41e4-466b-82bc-ecffd4e7b3ae";
const PASSWORD = "Testpass123!";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
const context = await browser.newContext({ colorScheme: "dark" });
const page = await context.newPage();

await page.goto(`${BASE}/_agent-native/sign-in`, { waitUntil: "networkidle" });
await page.locator('button[data-tab="login"]').click();
await page.locator("#l-email").fill("viewer-check@local.test");
await page.locator('button[type="submit"]:has-text("Sign in")').click();
await page.waitForTimeout(1200);
const pw = page.locator('input[type="password"]:visible');
if ((await pw.count()) > 0) {
  await pw.first().fill(PASSWORD);
  await page.locator('button[type="submit"]:visible').first().click();
  await page.waitForTimeout(2500);
}

await page.setViewportSize({ width: 1400, height: 2200 });
await page.goto(`${BASE}/projects/${PROJECT_ID}?mode=viewer`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4500);

const data = await page.evaluate(() => {
  // unlock a row so requirements show
  for (const c of document.querySelectorAll("[data-cyoa-choice]")) {
    if (c.getAttribute("data-cyoa-choice") === "choice-kvl2") (c as HTMLElement).click();
  }
  // wait handled by caller sleep
  const out: unknown[] = [];
  const sections = document.querySelectorAll(".cyoa-viewer section");
  for (const s of Array.from(sections).slice(0, 4)) {
    const badges = Array.from(s.querySelectorAll("[data-cyoa-choice] > div span"))
      .filter((el) => el.textContent && el.textContent.trim())
      .map((el) => el.textContent.trim().slice(0, 120));
    out.push({ badges: badges.slice(0, 8) });
  }
  return { sections: out };
});
console.log("REQ_BADGES:", JSON.stringify(data, null, 1));
await browser.close();
console.log("done");
