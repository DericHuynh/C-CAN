import { parseArgs } from "node:util";
/**
 * Verify right-click context menus on row/choice/addon tree nodes.
 * Usage: node scripts/tmp-verify-contextmenu.mjs --project-id <copy>
 */
import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";
import { createClient } from "../node_modules/@libsql/client/lib-esm/node.js";

const BASE = "http://localhost:8080";
const { values } = parseArgs({ options: { "project-id": { type: "string" } } });
const PROJECT_ID = values["project-id"];
if (!PROJECT_ID) {
  console.error("Pass --project-id for a throwaway copy.");
  process.exit(1);
}
const EMAIL = "viewer-check@local.test";
const PASSWORD = "Testpass123!";

const db = createClient({ url: "file:data/app.db" });
const docRows = async () => {
  const r = await db.execute("SELECT json FROM projects WHERE id = ?", [PROJECT_ID]);
  return JSON.parse(r.rows[0].json).rows ?? [];
};

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  colorScheme: "dark",
});
const page = await context.newPage();

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

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
await page.waitForTimeout(1500);

const rowNode = (idx) =>
  page.locator("div.rounded-lg.border.border-border.bg-card").nth(idx).locator("> div").first();
const menuButtons = () => page.locator("div.fixed.z-\\[300\\] button");

const before = await docRows();

// --- row context menu ---
await rowNode(0).click({ button: "right" });
await page.waitForSelector("text=Add row above", { timeout: 5000 });
const rowItems = await menuButtons().allInnerTexts();
check(
  "row context menu offers above/below",
  rowItems.join("|") === "Add row above|Add row below",
  rowItems.join("|"),
);

// Close with Escape.
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("menu closes on Escape", (await menuButtons().count()) === 0, "");

// Right-click row 2 and add above.
const rowsBeforeAdd = (await docRows()).map((r) => r.id);
await rowNode(1).click({ button: "right" });
await page.waitForSelector("text=Add row above", { timeout: 5000 });
await menuButtons().filter({ hasText: "Add row above" }).click();
await page.waitForTimeout(1200);
const rowsAfterAdd = (await docRows()).map((r) => r.id);
const inserted =
  rowsAfterAdd.length === rowsBeforeAdd.length + 1 &&
  rowsAfterAdd[0] === rowsBeforeAdd[0] &&
  rowsAfterAdd[2] === rowsBeforeAdd[1] &&
  !rowsBeforeAdd.includes(rowsAfterAdd[1]);
check(
  "add row above inserts before the target",
  inserted,
  `${rowsAfterAdd.length} rows, new=${rowsAfterAdd[1]?.slice(0, 12)}`,
);
// New row selected in the detail pane.
const rowTitle = await page.locator("#row-title").count();
check("new row selected in detail pane", rowTitle === 1, "");

// --- choice context menu ---
await page.locator("div.group.relative.flex.pl-8").first().click({ button: "right" });
await page.waitForSelector("text=Add choice above", { timeout: 5000 });
const choiceItems = await menuButtons().allInnerTexts();
check(
  "choice context menu offers above/below",
  choiceItems.join("|") === "Add choice above|Add choice below",
  choiceItems.join("|"),
);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// --- addon context menu ---
const addonContainers = page.locator("div.mt-1.space-y-1.pl-8");
let addonContainer = null;
for (let i = 0; i < (await addonContainers.count()); i++) {
  const c = addonContainers.nth(i);
  if ((await c.locator("div.group.relative.flex.pl-16").count()) >= 1) {
    addonContainer = c;
    break;
  }
}
if (addonContainer) {
  await addonContainer.locator("div.group.relative.flex.pl-16").first().click({ button: "right" });
  await page.waitForSelector("text=Add addon above", { timeout: 5000 });
  const addonItems = await menuButtons().allInnerTexts();
  check(
    "addon context menu offers above/below",
    addonItems.join("|") === "Add addon above|Add addon below",
    addonItems.join("|"),
  );
  await menuButtons().filter({ hasText: "Add addon below" }).click();
  await page.waitForTimeout(1200);
  const rowsNow = await docRows();
  const addonCounts = rowsNow.flatMap((r) => (r.objects ?? []).map((c) => (c.addons ?? []).length));
  const beforeAddonCounts = before.flatMap((r) =>
    (r.objects ?? []).map((c) => (c.addons ?? []).length),
  );
  const totalBefore = beforeAddonCounts.reduce((s, n) => s + n, 0);
  const totalNow = addonCounts.reduce((s, n) => s + n, 0);
  check(
    "add addon below increments addon count",
    totalNow === totalBefore + 1,
    `${totalBefore} -> ${totalNow}`,
  );
} else {
  check("addon context menu (no addon on page 1)", false, "no addon node mounted on page 1");
}

const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
await browser.close();
process.exit(fails.length ? 1 : 0);
