/**
 * Recreate the viewer-check@local.test user via the sign-up form.
 */
import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";

const BASE = "http://localhost:8080";
const EMAIL = "viewer-check@local.test";
const PASSWORD = "Testpass123!";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

await page.goto(`${BASE}/_agent-native/sign-in`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);

// Ensure the signup tab is active.
const signupTab = page.locator('button[data-tab="signup"]');
if ((await signupTab.count()) > 0) {
  await signupTab.first().click();
  await page.waitForTimeout(400);
}

await page.locator("#s-email").fill(EMAIL);
const pwInputs = page.locator("#signup-form input[type='password']");
await pwInputs.nth(0).fill(PASSWORD);
if ((await pwInputs.count()) > 1) await pwInputs.nth(1).fill(PASSWORD);

await page.locator('button[type="submit"]:has-text("Create account")').first().click();
await page.waitForTimeout(3000);

const url = page.url();
const signedIn = !url.includes("sign-in");
console.log("after submit url:", url, "signedIn:", signedIn);
if (!signedIn) {
  const body = await page.locator("body").innerText().catch(() => "");
  console.log("page snippet:", body.replace(/\n+/g, " ").slice(0, 300));
}
await browser.close();
process.exit(signedIn ? 0 : 1);
