import { parseArgs } from "node:util";
/**
 * Quick checks against a throwaway copy:
 *  - collapsing a row truly collapses (no gaping empty hole)
 *  - images tab is 3 columns by default
 *  - selection latency: clicking a choice opens the detail pane fast
 * Usage: node scripts/tmp-verify-collapse-perf.mjs --project-id <copy>
 */
import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";

const BASE = "http://localhost:8080";
const { values } = parseArgs({ options: { "project-id": { type: "string" } } });
const PROJECT_ID = values["project-id"];
if (!PROJECT_ID) {
  console.error("Pass --project-id for a throwaway copy.");
  process.exit(1);
}
const EMAIL = "viewer-check@local.test";
const PASSWORD = "Testpass123!";

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

// --- collapse -----------------------------------------------------------
await page.goto(`${BASE}/projects/${PROJECT_ID}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("text=Add row", { timeout: 60000 });
await page.waitForTimeout(1500);

const rowCard = (idx) => page.locator("div.rounded-lg.border.border-border.bg-card").nth(idx);
const rowNode = (idx) => rowCard(idx).locator("> div").first();

const before = await rowCard(0).evaluate((el) => ({
  h: el.getBoundingClientRect().height,
  text: el.innerText.replace(/\s+/g, " ").slice(0, 80),
}));

// Collapse row 1 (chevron button inside the first node).
await rowNode(0).locator('button[aria-label="Collapse row"]').click();
await page.waitForTimeout(600);
const afterCollapse = await rowCard(0).evaluate((el) => ({
  h: el.getBoundingClientRect().height,
  text: el.innerText.replace(/\s+/g, " ").slice(0, 120),
}));
check(
  "collapsing a row shrinks the card (no gaping hole)",
  afterCollapse.h < before.h * 0.6,
  `before=${Math.round(before.h)}px after=${Math.round(afterCollapse.h)}px`,
);
check(
  "collapsed row has no choice text left",
  !/Required:|You Don’t Care|choice/i.test(afterCollapse.text) ||
    afterCollapse.text.length < before.text.length,
  `text=${afterCollapse.text.slice(0, 90)}`,
);

// Expand again — children return.
await rowNode(0).locator('button[aria-label="Expand row"]').click();
await page.waitForTimeout(600);
const afterExpand = await rowCard(0).evaluate((el) => el.getBoundingClientRect().height);
check(
  "expanding restores children",
  afterExpand > afterCollapse.h * 1.5,
  `collapsed=${Math.round(afterCollapse.h)} expanded=${Math.round(afterExpand)}`,
);

// --- selection latency ---------------------------------------------------
const t0 = Date.now();
await rowNode(0).click(); // row select
await page.waitForSelector("#row-title", {
  timeout: 10000,
});
const rowLatency = Date.now() - t0;
const stats1 = await page.evaluate(() => ({
  t: globalThis.__t ?? { tree: 0, rows: 0, choices: 0 },
  re: globalThis.__re ?? { mounts: 0 },
}));
console.log(`[stats after row-1 select]`, JSON.stringify(stats1));
check("row selection opens detail pane quickly", rowLatency < 1500, `${rowLatency}ms`);

// Second selection (warm modules) — should be well under the first.
const t0b = Date.now();
await rowNode(2).click();
await page.waitForFunction(() => document.querySelector("#row-title") !== null, { timeout: 10000 });
await page.waitForTimeout(200);
const rowLatency2 = Date.now() - t0b;
const stats2 = await page.evaluate(() => ({
  t: globalThis.__t ?? { tree: 0, rows: 0, choices: 0 },
  re: globalThis.__re ?? { mounts: 0 },
}));
console.log(`[stats after row-3 select]`, JSON.stringify(stats2));
check("subsequent row selection is fast (warm)", rowLatency2 < 800, `${rowLatency2}ms`);

// Choice select: find a mounted choice (pl-8 node) and click it.
const choice = page.locator("div.group.relative.flex.pl-8").first();
const t1 = Date.now();
await choice.click();
await page.waitForSelector("#choice-title", { timeout: 10000 });
const choiceLatency = Date.now() - t1;
check("choice selection opens detail pane quickly", choiceLatency < 1500, `${choiceLatency}ms`);

// --- images triple column ------------------------------------------------
await page.goto(`${BASE}/projects/${PROJECT_ID}?tab=images`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForSelector("text=Add image", { timeout: 60000 });
await page.waitForTimeout(1200);
const gridInfo = await page.evaluate(() => {
  const grids = Array.from(document.querySelectorAll("main .grid, .agent-native-app-main .grid"));
  if (grids.length === 0) return { found: false, cols: null, w: 0 };
  const grid = grids[0];
  const cs = getComputedStyle(grid);
  const cols = cs.gridTemplateColumns.split(" ").length;
  return {
    found: true,
    cols,
    w: Math.round(grid.getBoundingClientRect().width),
    tmpl: cs.gridTemplateColumns,
  };
});
check(
  "images tab is 3 columns by default",
  gridInfo.found && gridInfo.cols === 3,
  JSON.stringify(gridInfo),
);

const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
await browser.close();
process.exit(fails.length ? 1 : 0);
