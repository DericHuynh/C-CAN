/**
 * Headless browser verification of the editor rework:
 *  - two-level nav (group buttons + per-group tab triggers, ?tab= deep links)
 *  - RowTree renders rows -> choices -> addons with tiny thumbnails and
 *    right-side edit/delete actions
 *  - drag & drop: row reorder, choice reparent across rows (addon nodes
 *    present; addon drag exercised when the browser supports it)
 *
 * Mutations are undone through the same drag gestures and the project JSON is
 * compared against a pre-test snapshot in data/app.db, so a clean run leaves
 * the project byte-identical (modulo row/choice `index` fields, which are
 * re-derived identically by the actions).
 *
 * Usage: node scripts/tmp-verify-tree.mjs
 */
import { chromium } from "../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";
import { createClient } from "../node_modules/@libsql/client/lib-esm/node.js";

const BASE = "http://localhost:8080";
// Run against a throwaway copy (see tmp-make-copy.mjs) — these tests mutate
// and undo project data, so never point them at a real project.
const PROJECT_ID = process.env.PROJECT_ID;
if (!PROJECT_ID) {
  console.error("Set PROJECT_ID to a throwaway copy (node scripts/tmp-make-copy.mjs).");
  process.exit(1);
}
const EMAIL = "viewer-check@local.test";
const PASSWORD = "Testpass123!";

const db = createClient({ url: "file:data/app.db" });

/** Snapshot of the document structure we care about. */
async function snapshotDoc() {
  const r = await db.execute("SELECT json FROM projects WHERE id = ?", [PROJECT_ID]);
  const app = JSON.parse(r.rows[0].json);
  return {
    rowsOrder: (app.rows ?? []).map((row) => row.id),
    choicesByRow: (app.rows ?? []).map((row) => (row.objects ?? []).map((c) => c.id)),
    addonsFingerprint: (app.rows ?? []).map((row) =>
      (row.objects ?? []).map((c) => JSON.stringify(c.addons ?? [])),
    ),
  };
}
function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

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

// Sign in through the real UI.
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

const before = await snapshotDoc();

// Resolve the ids/titles we drag by reading the doc once.
const docSnapshotRows = await (async () => {
  const r = await db.execute("SELECT json FROM projects WHERE id = ?", [PROJECT_ID]);
  return JSON.parse(r.rows[0].json).rows ?? [];
})();
const rowIdxByTitle = (title) =>
  docSnapshotRows.findIndex((row) => (row.title ?? "").trim() === title.trim());
const findChoiceId = (title) => {
  for (const row of docSnapshotRows) {
    const c = (row.objects ?? []).find((c) => (c.title ?? "").trim() === title.trim());
    if (c) return c.id;
  }
  return null;
};
const youRunIdx = rowIdxByTitle("You Run…");
const donTCareId = findChoiceId("You Don’t Care");
const lostId = findChoiceId("You’re Lost");
const targetRowId = docSnapshotRows[2].id; // third row ("  ", empty title)

try {
  // ---------------------------------------------------------------- nav ----
  await page.goto(`${BASE}/projects/${PROJECT_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("text=Add row", { timeout: 60000 });
  await page.waitForTimeout(1500);

  const groupButtons = page.locator('[aria-label="Editor section"] button');
  check(
    "four group buttons render",
    (await groupButtons.count()) === 4,
    `count=${await groupButtons.count()}`,
  );
  const contentLabel = (await groupButtons.first().innerText()).replace(/\s+/g, " ").trim();
  check(
    "Content group shows row/choice counts",
    /Content · 181 rows · 1188 choices/.test(contentLabel),
    contentLabel,
  );

  const tabCount = await page.locator('[role="tab"]').count();
  check("Content group shows 7 tab triggers", tabCount === 7, `count=${tabCount}`);
  check(
    "Rows tab is active initially",
    (await page.locator('[role="tab"][aria-selected="true"]').innerText()) === "Rows",
  );

  await groupButtons.filter({ hasText: "Design" }).click();
  await page.waitForTimeout(600);
  const designTabs = await page.locator('[role="tab"]').allInnerTexts();
  check("Design group shows 6 tab triggers", designTabs.length === 6, designTabs.join(","));
  check(
    "switching group reselects first tab of that group",
    (await page.locator('[role="tab"][aria-selected="true"]').innerText()) === "Design Groups",
  );
  check("Rows trigger is gone in Design group", !designTabs.some((t) => t === "Rows"));

  // Deep link: ?tab=json opens the JSON tab directly (Project group).
  await page.goto(`${BASE}/projects/${PROJECT_ID}?tab=json`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForSelector('[role="tab"]', { timeout: 60000 });
  await page.waitForTimeout(1000);
  const projectGroupOn = await page
    .locator('[aria-label="Editor section"] button[data-state="on"]')
    .innerText();
  const activeTabText = await page.locator('[role="tab"][aria-selected="true"]').innerText();
  check(
    "deep link ?tab=json activates Project group + JSON tab",
    /Project/.test(projectGroupOn) && activeTabText === "JSON",
    `group=${projectGroupOn.trim()} tab=${activeTabText}`,
  );

  // ------------------------------------------------------------ tree -------
  await page.goto(`${BASE}/projects/${PROJECT_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("text=Add row", { timeout: 60000 });
  await page.waitForTimeout(1500);

  const rowCard = (idx) => page.locator("div.rounded-lg.border.border-border.bg-card").nth(idx);
  const rowNode = (idx) => rowCard(idx).locator("> div").first();
  const firstRowText = (await rowNode(0).innerText()).replace(/\s+/g, " ").trim();
  check(
    "tree renders Row 1 badge + title",
    /Row 1/.test(firstRowText) && /So tired/.test(firstRowText),
    firstRowText.slice(0, 90),
  );

  const thumbInfo = await rowNode(0).evaluate((el) => {
    const img = el.querySelector("img");
    return {
      hasImg: Boolean(img),
      className: img ? img.className : "",
      w: img ? img.getBoundingClientRect().width : 0,
      h: img ? img.getBoundingClientRect().height : 0,
    };
  });
  check(
    "row thumbnail is a small cropped icon (size-16 = 64px)",
    thumbInfo.hasImg &&
      /size-16/.test(thumbInfo.className) &&
      thumbInfo.w <= 128 &&
      thumbInfo.h <= 128,
    `w=${thumbInfo.w} h=${thumbInfo.h} class=${thumbInfo.className.slice(0, 60)}`,
  );

  const actionCount = await rowNode(0)
    .locator('button[title="Delete"], button[title="Add choice"]')
    .count();
  const editCount = await page.locator('button[title="Edit"]').count();
  check(
    "row branch has right-side add/delete actions",
    actionCount === 2,
    `actions=${actionCount}`,
  );
  check("no edit buttons in the tree (click selects)", editCount === 0, `editButtons=${editCount}`);

  const dragHandles = await page.locator("[data-drag-handle]").count();
  check("tree branches have grip drag handles", dragHandles > 0, `handles=${dragHandles}`);

  // Choices + addons render per page: page 1 mounts its rows' branches fully
  // (far fewer than the full 1188/1252 up front), and paging mounts a
  // different set — no windowing or scroll-driven mounting.
  const choiceNodeCount = await page.locator("div.group.relative.flex.pl-8").count();
  const addonBadges = await page.locator("text=Addon").count();
  check(
    "page mounts a bounded set of choices (not all 1188)",
    choiceNodeCount > 0 && choiceNodeCount < 600,
    `choiceNodes=${choiceNodeCount}`,
  );
  check("addon branches render (Addon badges)", addonBadges > 0, `addonBadges=${addonBadges}`);

  // Pagination replaces windowing: Next shows a different page of rows.
  const master = page.locator("[data-master-scroll]");
  await page.locator('button:has-text("Next")').first().click();
  await page.waitForTimeout(900);
  const page2Badges = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll("span, div")]
        .map((s) => (s.textContent ?? "").trim())
        .filter((t) => /^Row \d+$/.test(t)),
    ),
  ]);
  await page.locator('button:has-text("Prev")').first().click();
  await page.waitForTimeout(800);
  check(
    "paging mounts a different row set (window -> page)",
    page2Badges.includes("Row 21"),
    `page2Badges=${page2Badges.slice(0, 4).join(",")}…`,
  );

  // ----------------------------------------------------- drag: row reorder --
  const row2Title = (await rowNode(1).innerText()).replace(/\s+/g, " ").trim();
  check("second row is 'You Run…'", /You Run/.test(row2Title), row2Title.slice(0, 80));

  // Dispatch native drag events straight at the handlers. This is immune to
  // the layout drift that plagues mouse-simulated drags on the lazy tree
  // (mid-drag windowing re-renders shift the drop point): the payload comes
  // from the dataTransfer and the position is computed from the event's own
  // coordinates at dispatch time.
  async function manualDrag(source, target, targetPos) {
    // dragstart must fire on the grip handle (only it is draggable now); the
    // drop targets are the tree nodes themselves.
    const sh = await source.locator("[data-drag-handle]").evaluateHandle((el) => el);
    const th = await target.evaluateHandle((el) => el);
    await page.evaluate(
      ([src, tgt, px, py]) => {
        const tr = tgt.getBoundingClientRect();
        const dt = new DataTransfer();
        const fire = (el, type) =>
          el.dispatchEvent(
            new DragEvent(type, {
              bubbles: true,
              cancelable: true,
              dataTransfer: dt,
              clientX: tr.x + px,
              clientY: tr.y + py,
            }),
          );
        fire(src, "dragstart");
        fire(tgt, "dragenter");
        fire(tgt, "dragover");
        fire(tgt, "drop");
        fire(src, "dragend");
      },
      [sh, th, targetPos.x ?? 150, targetPos.y ?? 4],
    );
    await page.waitForTimeout(1800);
  }

  // Drag row 2 before row 1 (drop on the top edge of row 1's node).
  await manualDrag(rowNode(1), rowNode(0), { x: 150, y: 4 });
  const afterReorder = await snapshotDoc();
  const reorderApplied =
    afterReorder.rowsOrder[0] !== before.rowsOrder[0] &&
    afterReorder.rowsOrder[1] === before.rowsOrder[0];
  check(
    "row drag reordered rows (row 2 now first)",
    reorderApplied,
    `first=${afterReorder.rowsOrder[0]}`,
  );

  // Undo: drag the (now first) row back "after" the second row -> index 1.
  const rowNodeHeight = await rowNode(1).evaluate((el) => el.getBoundingClientRect().height);
  await manualDrag(rowNode(0), rowNode(1), { x: 150, y: Math.max(8, rowNodeHeight - 4) });
  const afterUndo = await snapshotDoc();
  check(
    "row drag undone (original order restored)",
    same(afterUndo.rowsOrder, before.rowsOrder),
    "",
  );

  // -------------------------------------------------- drag: choice reparent --
  // Move "You Don’t Care" (row 2, index 0) onto the third row header (append).
  // Row indices are recomputed from the DB so the test survives earlier drags.
  const curRows = (await snapshotDoc()).rowsOrder;
  const youRunIdxNow = curRows.findIndex((id) => id === docSnapshotRows[youRunIdx].id);
  const targetRowIdxNow = curRows.findIndex((id) => id === targetRowId);
  const choiceNodeIn = (rowIdx, title) =>
    rowCard(rowIdx).locator("div.group.relative.flex").filter({ hasText: title }).first();
  const targetRowHeight = await rowNode(targetRowIdxNow).evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  await manualDrag(choiceNodeIn(youRunIdxNow, "You Don’t Care"), rowNode(targetRowIdxNow), {
    x: 150,
    y: Math.round(targetRowHeight / 2),
  });
  const afterChoiceMove = await snapshotDoc();
  const targetRowChoices = afterChoiceMove.choicesByRow[targetRowIdxNow];
  const moved =
    targetRowChoices.includes(donTCareId) &&
    !afterChoiceMove.choicesByRow[youRunIdxNow].includes(donTCareId);
  check(
    "choice drag reparents choice to target row",
    moved,
    `targetRow=${targetRowChoices.join(",")}`,
  );

  // Undo: drag it back before the first choice ("You’re Lost") of the source row.
  const backIdx = (await snapshotDoc()).rowsOrder.findIndex(
    (id) => id === docSnapshotRows[youRunIdx].id,
  );
  await manualDrag(
    choiceNodeIn(targetRowIdxNow, "You Don’t Care"),
    choiceNodeIn(backIdx, "You’re Lost"),
    {
      x: 150,
      y: 4,
    },
  );
  const afterChoiceUndo = await snapshotDoc();
  const restored =
    same(afterChoiceUndo.choicesByRow, before.choicesByRow) &&
    same(afterChoiceUndo.rowsOrder, before.rowsOrder);
  check("choice drag undone (choice back at original index)", restored, "");

  // -------------------------------------------------- drag: addon move -------
  // Find the first choice that has >=2 addons and reorder within it, then undo.
  // With pagination the addon containers live on specific pages, so page
  // through until one with >=2 addon nodes is mounted.
  const addonContainers = page.locator("div.mt-1.space-y-1.pl-8");
  const addonNode = (container, idx) => container.locator("div.group.relative.flex.pl-16").nth(idx);
  const findAddonContainer = async () => {
    const count = await addonContainers.count();
    for (let i = 0; i < count; i++) {
      const c = addonContainers.nth(i);
      if ((await c.locator("div.group.relative.flex.pl-16").count()) >= 2) return c;
    }
    return null;
  };
  let addonContainer = await findAddonContainer();
  let pagesTried = 0;
  while (!addonContainer && pagesTried < 12) {
    const next = page.locator('button:has-text("Next")').first();
    if (!(await next.isEnabled().catch(() => false))) break;
    await next.click();
    await page.waitForTimeout(700);
    pagesTried += 1;
    addonContainer = await findAddonContainer();
  }
  if (!addonContainer) {
    // Back to page 1 for the remaining checks.
    const prev = page.locator('button:has-text("Prev")').first();
    while (await prev.isEnabled().catch(() => false)) {
      await prev.click();
      await page.waitForTimeout(400);
    }
  }
  if (addonContainer) {
    const addonCountBefore = await addonContainer.locator("div.group.relative.flex.pl-16").count();
    // Bring the deep addon container into the middle of the viewport — an
    // HTML5 drag is cancelled if the page scrolls mid-drag.
    await addonContainer.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(600);
    addonContainer = await findAddonContainer();
    if (addonContainer) {
      const addonB = addonNode(addonContainer, 1);
      const addonBHeight = await addonB.evaluate((el) => el.getBoundingClientRect().height);
      // Drag addon A after addon B: [A, B, ...] -> [B, A, ...].
      await manualDrag(addonNode(addonContainer, 0), addonB, {
        x: 150,
        y: Math.max(8, addonBHeight - 4),
      });
      const afterAddonDrag = await snapshotDoc();
      const addonMoved = !same(afterAddonDrag.addonsFingerprint, before.addonsFingerprint);
      check("addon drag reorders addons", addonMoved, `count=${addonCountBefore}`);

      // Undo: drag addon A (now at index 1) back before addon B (index 0).
      // Re-resolve the container after the drag (positions shift on re-render).
      await page.waitForTimeout(900);
      addonContainer = await findAddonContainer();
      if (addonContainer) {
        await addonContainer.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(500);
        addonContainer = await findAddonContainer();
      }
      if (addonContainer) {
        const a2 = addonNode(addonContainer, 1);
        await manualDrag(a2, addonNode(addonContainer, 0), {
          x: 150,
          y: 4,
        });
        const afterAddonUndo = await snapshotDoc();
        check(
          "addon drag undone (fingerprint matches)",
          same(afterAddonUndo.addonsFingerprint, before.addonsFingerprint),
          "",
        );
      } else {
        check("addon drag undone (fingerprint matches)", false, "container vanished after drag");
      }
    } else {
      check(
        "addon drag exercised (choice with >=2 addons)",
        false,
        "container vanished after scroll",
      );
    }
  } else {
    check(
      "addon drag exercised (choice with >=2 addons)",
      false,
      "no such choice found after scrolling",
    );
  }

  // Final: the whole document structure (rows, choice membership AND addon
  // payloads) must match the pre-test snapshot after all undo drags.
  const final = await snapshotDoc();
  check(
    "all drags undone — document structurally identical to pre-test",
    same(final.rowsOrder, before.rowsOrder) &&
      same(final.choicesByRow, before.choicesByRow) &&
      same(final.addonsFingerprint, before.addonsFingerprint),
    "",
  );

  await page.screenshot({ path: "scripts/tmp-verify-tree.png" });
} catch (err) {
  console.error("ERROR:", err.message);
  await page.screenshot({ path: "scripts/tmp-verify-tree.png" });
  results.push({ name: "script completed without error", pass: false, detail: err.message });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
