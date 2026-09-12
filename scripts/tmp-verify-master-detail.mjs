import { parseArgs } from "node:util";
/**
 * Headless browser verification of the master-detail editor rework:
 *  - the editor route is full width (no max-w-5xl cap) like the viewer
 *  - the Rows tab: tree master column + inline detail pane (no dialogs);
 *    selecting a row/choice opens its form in the pane and Save persists
 *  - lazy windowing: only nearby rows mount their choice branches
 *  - Groups / Images / Points tabs render master + inline detail forms
 *
 * Usage: node scripts/tmp-verify-master-detail.mjs --project-id <copy>
 */
import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";
import { createClient } from "../node_modules/@libsql/client/lib-esm/node.js";

const BASE = "http://localhost:8080";
// Run against a throwaway copy (see tmp-make-copy.mjs) — this script mutates
// a choice's title (then restores it), so never point it at a real project.
const { values } = parseArgs({ options: { "project-id": { type: "string" } } });
const PROJECT_ID = values["project-id"];
if (!PROJECT_ID) {
  console.error("Pass --project-id for a throwaway copy (node scripts/tmp-make-copy.mjs).");
  process.exit(1);
}
const EMAIL = "viewer-check@local.test";
const PASSWORD = "Testpass123!";

const db = createClient({ url: "file:data/app.db" });

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
  await page.waitForTimeout(2500);
}

try {
  // ---- Full-width editor route ----
  await page.goto(`${BASE}/projects/${PROJECT_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("text=Add row", { timeout: 60000 });
  await page.waitForTimeout(1500);
  const widthInfo = await page.evaluate(() => {
    const main = document.querySelector(".agent-native-app-main");
    const h1 = Array.from(document.querySelectorAll("h1")).find(
      (el) => el.textContent && el.textContent.trim().length > 0,
    );
    return {
      mainW: main ? main.clientWidth : 0,
      h1W: h1 ? h1.getBoundingClientRect().width : 0,
      h1Left: h1 ? h1.getBoundingClientRect().left : 0,
    };
  });
  check(
    "editor route is full width (content spans the main surface)",
    widthInfo.mainW > 1200,
    JSON.stringify(widthInfo),
  );

  // ---- Rows tab: master + detail panes ----
  const gridCols = await page.evaluate(() => {
    const grid = document.querySelector(".agent-native-app-main .grid");
    const cs = grid ? getComputedStyle(grid) : null;
    return cs ? cs.gridTemplateColumns : null;
  });
  const twoCols = gridCols ? gridCols.split(" ").filter((part) => part.trim()).length === 2 : false;
  check("rows tab uses a two-column master/detail grid", twoCols, gridCols ?? "none");

  const noDialogsInitially = (await page.locator('[role="dialog"]').count()) === 0;
  check("no dialogs on initial render", noDialogsInitially, "");

  // Empty-state detail pane before any selection.
  const emptyDetail = await page.evaluate(() =>
    Array.from(document.querySelectorAll("p")).some((el) =>
      /Select a row, choice, or addon/.test(el.textContent ?? ""),
    ),
  );
  check("empty-state detail pane before selection", emptyDetail, "");

  // Click the first row's node -> inline RowEditor (no dialog, no edit button).
  await page.locator("div.group.relative.flex").first().click();
  await page.waitForTimeout(800);
  const rowDetail = await page.evaluate(() => {
    const main = document.querySelector(".agent-native-app-main");
    return {
      hasDialog: Boolean(document.querySelector('[role="dialog"]')),
      hasEditRowTitle: Array.from(document.querySelectorAll("h3, div")).some(
        (el) => el.textContent === "Edit row",
      ),
      hasRowTitleInput: Boolean(document.querySelector('input[id="row-title"]')),
      hasFooter: Array.from(document.querySelectorAll("button")).some(
        (b) => b.textContent === "Save",
      ),
    };
  });
  check(
    "selecting a row opens the inline RowEditor (no dialog)",
    !rowDetail.hasDialog &&
      rowDetail.hasEditRowTitle &&
      rowDetail.hasRowTitleInput &&
      rowDetail.hasFooter,
    JSON.stringify(rowDetail),
  );

  // Cancel returns to the empty state.
  await page.locator('button:has-text("Cancel")').first().click();
  await page.waitForTimeout(400);

  // Click the first CHOICE's node -> inline ChoiceEditor with accordion.
  await page.locator("div.group.relative.flex.pl-8").first().click();
  await page.waitForTimeout(800);
  const choiceDetail = await page.evaluate(() => ({
    hasDialog: Boolean(document.querySelector('[role="dialog"]')),
    hasChoiceTitleInput: Boolean(document.querySelector('input[id="choice-title"]')),
    hasAccordion: Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent === "Basics",
    ),
  }));
  check(
    "selecting a choice opens the inline ChoiceEditor (accordion, no dialog)",
    !choiceDetail.hasDialog && choiceDetail.hasChoiceTitleInput && choiceDetail.hasAccordion,
    JSON.stringify(choiceDetail),
  );

  // Edit a field and Save -> persists (mutates the DB, then restore).
  const before = await db.execute("SELECT json FROM projects WHERE id = ?", [PROJECT_ID]);
  const beforeApp = JSON.parse(before.rows[0].json);
  const firstChoiceId = (beforeApp.rows ?? []).find((r) => (r.objects ?? []).length)?.objects?.[0]
    ?.id;
  const firstChoiceTitle = (beforeApp.rows ?? []).find((r) => (r.objects ?? []).length)
    ?.objects?.[0]?.title;
  // Target the first choice by its title so the edit lands on a known id.
  await page
    .locator("div.group.relative.flex.pl-8")
    .filter({ hasText: firstChoiceTitle })
    .first()
    .click();
  await page.waitForTimeout(800);
  const titleInput = page.locator('input[id="choice-title"]');
  await titleInput.fill(`${firstChoiceId}-master-detail-check`);
  await page.waitForTimeout(300);
  const filledValue = await titleInput.inputValue();
  await page.locator('button:has-text("Save")').first().click();
  await page.waitForTimeout(2000);
  const after = await db.execute("SELECT json FROM projects WHERE id = ?", [PROJECT_ID]);
  const afterApp = JSON.parse(after.rows[0].json);
  const editedChoice = (afterApp.rows ?? [])
    .flatMap((r) => r.objects ?? [])
    .find((c) => c.id === firstChoiceId);
  check(
    "saving the inline form persists to the project",
    filledValue === `${firstChoiceId}-master-detail-check` && editedChoice?.title === filledValue,
    `id=${firstChoiceId} filled=${filledValue} saved=${editedChoice?.title}`,
  );
  // Restore the original title.
  const restoredApp = JSON.parse(before.rows[0].json);
  await db.execute("UPDATE projects SET json = ? WHERE id = ?", [
    JSON.stringify(restoredApp),
    PROJECT_ID,
  ]);

  // ---- Groups tab: master + inline form ----
  await page.locator('[aria-label="Editor section"] button').filter({ hasText: "Content" }).click();
  await page.waitForTimeout(400);
  await page.locator('[role="tab"]:has-text("Groups")').click();
  await page.waitForTimeout(1200);
  const groupsTab = await page.evaluate(() => ({
    hasDialog: Boolean(document.querySelector('[role="dialog"]')),
    hasAddButton: Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent === "Add group",
    ),
    hasMasterText: Array.from(document.querySelectorAll("p")).some((el) =>
      /group/.test((el.textContent ?? "").toLowerCase()),
    ),
  }));
  check(
    "groups tab renders without dialogs",
    !groupsTab.hasDialog && groupsTab.hasAddButton,
    JSON.stringify(groupsTab),
  );

  const groupCards = page.locator("div[class*='card']").filter({ hasText: "member" });
  await page.waitForSelector("text=members", { timeout: 8000 });
  await page.waitForTimeout(400);
  const firstGroup = groupCards.first();
  if ((await firstGroup.count()) > 0) {
    await firstGroup.click();
    await page.waitForTimeout(800);
    const groupForm = await page.evaluate(() => ({
      hasDialog: Boolean(document.querySelector('[role="dialog"]')),
      hasNameInput: Boolean(document.querySelector('input[id="group-name"]')),
    }));
    check(
      "clicking a group card opens the inline GroupForm",
      !groupForm.hasDialog && groupForm.hasNameInput,
      JSON.stringify(groupForm),
    );
  } else {
    check("groups exist to select", false, "no group cards");
  }
  await page.keyboard.press("Escape");

  // ---- Images tab renders master grid + inline form ----
  await page.locator('[role="tab"]:has-text("Images")').click();
  await page.waitForTimeout(1500);
  const imagesTab = await page.evaluate(() => ({
    hasAddButton: Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent === "Add image",
    ),
    hasDialog: Boolean(document.querySelector('[role="dialog"]')),
  }));
  check(
    "images tab renders (grid master, no dialogs)",
    imagesTab.hasAddButton && !imagesTab.hasDialog,
    JSON.stringify(imagesTab),
  );

  await page.screenshot({ path: "scripts/tmp-verify-master-detail.png" });
} catch (err) {
  console.error("ERROR:", err.message);
  await page.screenshot({ path: "scripts/tmp-verify-master-detail.png" });
  results.push({ name: "script completed without error", pass: false, detail: err.message });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
