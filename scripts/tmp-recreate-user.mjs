/**
 * Recreate the viewer-check@local.test user that the verify scripts sign in
 * as (it was missing from the DB after resets). Uses the real sign-up UI so
 * the password hash is produced by the framework's own auth.
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
await page.waitForTimeout(1000);

// Use the sign-up tab if present; otherwise fall back to the login form's
// sign-up mode.
const signupTab = page.locator('button[data-tab="signup"]');
if ((await signupTab.count()) > 0) {
  await signupTab.first().click();
  await page.waitForTimeout(400);
}

const emailInput = page.locator("#l-email, input[name='email'], input[type='email']:visible").first();
const pwInput = page.locator("#l-password, input[name='password'], input[type='password']:visible").first();
await emailInput.fill(EMAIL);
await pwInput.fill(PASSWORD);

const submit = page.locator('button[type="submit"]:visible').first();
await submit.click();
await page.waitForTimeout(2500);

const url = page.url();
const signedIn = !url.includes("sign-in");
console.log("after submit url:", url, "signedIn:", signedIn);
if (!signedIn) {
  // Maybe it actually logged in to the old account (if it existed) — check for
  // any error text on the page.
  const body = await page.locator("body").innerText().catch(() => "");
  console.log("page snippet:", body.replace(/\n+/g, " ").slice(0, 200));
}
await browser.close();
process.exit(signedIn ? 0 : 1);
