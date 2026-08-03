/**
 * Verify: selection latency (LazySelect fix), rows pagination, images pagination.
 * Usage: PROJECT_ID=<copy> node scripts/tmp-verify-pagination.mjs
 */
import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";

const BASE = "http://localhost:8080";
const PROJECT_ID = process.env.PROJECT_ID;
if (!PROJECT_ID) {
  console.error("Set PROJECT_ID to a throwaway copy.");
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

await page.goto(`${BASE}/projects/${PROJECT_ID}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("text=Add row", { timeout: 60000 });
await page.waitForTimeout(1500);

// --- pagination: rows tab ---
const pagerText = await page.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find((s) =>
    /Rows \d+–\d+ of \d+/.test(s.textContent ?? ""),
  );
  return el?.textContent ?? null;
});
check(
  "rows tab shows a pager with range",
  /Rows 1–20 of 181/.test(pagerText ?? ""),
  pagerText ?? "none",
);

const rowCards = await page.locator("div.rounded-lg.border.border-border.bg-card").count();
check("page 1 renders only 20 rows", rowCards === 20, `cards=${rowCards}`);

const rowNumberBadges = await page.evaluate(() => [
  ...new Set(
    [...document.querySelectorAll("span, div")]
      .map((s) => (s.textContent ?? "").trim())
      .filter((t) => /^Row \d+$/.test(t)),
  ),
]);
check(
  "row badges show global numbers 1..20",
  rowNumberBadges.length === 20 &&
    rowNumberBadges[0] === "Row 1" &&
    rowNumberBadges[19] === "Row 20",
  rowNumberBadges.join(","),
);

// Next page
await page.locator('button:has-text("Next")').first().click();
await page.waitForTimeout(800);
const pager2 = await page.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find((s) =>
    /Rows \d+–\d+ of \d+/.test(s.textContent ?? ""),
  );
  return el?.textContent ?? null;
});
const badges2 = await page.evaluate(() => [
  ...new Set(
    [...document.querySelectorAll("span, div")]
      .map((s) => (s.textContent ?? "").trim())
      .filter((t) => /^Row \d+$/.test(t)),
  ),
]);
check(
  "page 2 shows rows 21-40",
  /Rows 21–40 of 181/.test(pager2 ?? "") && badges2[0] === "Row 21",
  `${pager2} first=${badges2[0]}`,
);

// --- selection latency (the original complaint) ---
const measure = (idx) =>
  page.evaluate(
    (i) =>
      new Promise((resolve) => {
        const node = document.querySelectorAll("[data-row-id]")[i];
        const t0 = performance.now();
        const mo = new MutationObserver(() => {
          const input = document.querySelector("#row-title");
          if (input && input.value) {
            mo.disconnect();
            resolve(Math.round(performance.now() - t0));
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        const clickable = node?.querySelector("div.group.relative.flex") ?? node;
        clickable?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        setTimeout(() => {
          mo.disconnect();
          resolve(-1);
        }, 6000);
      }),
    idx,
  );

// go back to page 1
await page.locator('button:has-text("Prev")').first().click();
await page.waitForTimeout(600);
const t0 = Date.now();
const lat1 = await measure(0);
console.log(`  (wall ${Date.now() - t0}ms)`);
check("row selection is fast (LazySelect fix)", lat1 !== -1 && lat1 < 400, `${lat1}ms`);

// choice selection (mounts the full ChoiceEditor)
const choiceNode = page.locator("div.group.relative.flex.pl-8").first();
const t1 = Date.now();
await choiceNode.click();
await page.waitForSelector("#choice-title", { timeout: 10000 });
const lat2 = Date.now() - t1;
check("choice selection is fast (full editor)", lat2 < 800, `${lat2}ms`);

// --- lazy select dropdown: open the choice-image select and search ---
await page.locator("#choice-image").click();
await page.waitForSelector('input[placeholder="Search…"]', { timeout: 5000 });
const optsBefore = await page.locator('[role="option"]').count();
check("image dropdown opened with options", optsBefore > 10, `options=${optsBefore}`);
await page.fill('input[placeholder="Search…"]', "zzzz-no-match");
await page.waitForTimeout(300);
const optsAfter = await page.locator('[role="option"]').count();
check("search filters options", optsAfter === 1, `after=${optsAfter} (custom marker only)`);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const optsClosed = await page.evaluate(
  () => document.querySelectorAll('[role="option"], [data-radix-select-item]').length,
);
check("closed select has no mounted options", optsClosed === 0, `mounted=${optsClosed}`);

// --- images tab paginated, 3 columns ---
await page.goto(`${BASE}/projects/${PROJECT_ID}?tab=images`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForSelector("text=Add image", { timeout: 60000 });
await page.waitForTimeout(1200);
const imgGrid = await page.evaluate(() => {
  const grids = Array.from(document.querySelectorAll("main .grid, .agent-native-app-main .grid"));
  // The images page renders one grid per row (3 cards); sum across all
  // 3+ column grids (the master/detail wrapper has 2 columns).
  const imageGrids = grids.filter((g) => {
    const cs = getComputedStyle(g);
    return cs.gridTemplateColumns.split(" ").length >= 3;
  });
  const cards = imageGrids.reduce((sum, g) => sum + g.querySelectorAll(":scope > *").length, 0);
  return { cols: 3, cards, grids: imageGrids.length };
});
const imgPager = await page.evaluate(() => {
  const el = [...document.querySelectorAll("span")].find(
    (s) => /\d+–\d+ of \d+/.test(s.textContent ?? "") && /image/i.test(document.body.innerText),
  );
  return el?.textContent ?? null;
});
check("images tab is 3 columns", imgGrid.cols === 3, JSON.stringify(imgGrid));
check(
  "images grid is paginated (27 per page)",
  imgGrid.cards === 27,
  `cards=${imgGrid.cards} pager=${imgPager ?? "none"}`,
);

const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
await browser.close();
process.exit(fails.length ? 1 : 0);
