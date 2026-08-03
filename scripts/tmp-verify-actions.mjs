/**
 * Verify the new/upgraded authoring actions against a throwaway copy.
 * Run: node scripts/tmp-verify-actions.mjs (creates its own copy, cleans up)
 */
import { createClient } from "@libsql/client";
import { execSync } from "node:child_process";

const db = createClient({ url: "file:data/app.db" });
const REAL_ID = "503b0648-41e4-466b-82bc-ecffd4e7b3ae";
const COPY_ID = `verify-actions-${Date.now()}`;

const real = await db.execute("SELECT * FROM projects WHERE id = ?", [REAL_ID]);
const row = real.rows[0];
const cols = Object.keys(row);
await db.execute("DELETE FROM projects WHERE id = ?", [COPY_ID]);
await db.execute(
  `INSERT INTO projects (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
  cols.map((c) => (c === "id" ? COPY_ID : row[c])),
);

const runAction = async (name, input) => {
  const mod = await import(`../actions/${name}.ts`);
  return mod.default.run(input);
};

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// 1. get-project-summary: compact structure, no images/text bodies.
const summary = await runAction("get-project-summary", { projectId: COPY_ID });
const firstRow = summary.rows[0];
check(
  "get-project-summary returns compact rows",
  Array.isArray(summary.rows) &&
    summary.rows.length > 0 &&
    firstRow.id &&
    typeof firstRow.choiceCount === "number" &&
    Array.isArray(firstRow.choices),
  `rows=${summary.rows?.length} first=${firstRow?.title?.slice(0, 30) ?? "(untitled)"} choices=${firstRow?.choices?.length}`,
);
const hasNoBodies = !JSON.stringify(summary).includes("data:image");
check("summary has no embedded images", hasNoBodies, "");

// 2. add-row with fields (fully formed in one call).
const addedRow = await runAction("add-row", {
  projectId: COPY_ID,
  index: 0,
  fields: {
    title: "Test Row A",
    titleText: "Created fully-formed",
    requireds: [{ type: "id", reqId: summary.rows[0].choices[0].id, required: true }],
    styling: { rowMargin: 5 },
  },
});
check(
  "add-row creates with fields in one call",
  addedRow.row.title === "Test Row A" &&
    addedRow.row.requireds?.[0]?.reqId === summary.rows[0].choices[0].id &&
    addedRow.row.styling?.rowMargin === 5,
  `title=${addedRow.row.title} reqs=${addedRow.row.requireds?.length} styling=${addedRow.row.styling?.rowMargin}`,
);

// 3. add-rows bulk.
const bulkRows = await runAction("add-rows", {
  projectId: COPY_ID,
  rows: [
    { fields: { title: "Bulk Row 1", objectWidth: "col-md-6" } },
    { fields: { title: "Bulk Row 2" } },
    { fields: { title: "Bulk Row 3" } },
  ],
});
check(
  "add-rows bulk creates N rows with fields",
  bulkRows.rows.length === 3 &&
    bulkRows.rows.map((r) => r.title).join(",") === "Bulk Row 1,Bulk Row 2,Bulk Row 3" &&
    bulkRows.rows[0].objectWidth === "col-md-6" &&
    bulkRows.rows.every((r) => r.id),
  `titles=${bulkRows.rows.map((r) => r.title).join(",")}`,
);

// 4. add-choices bulk into the first bulk row.
const bulkChoices = await runAction("add-choices", {
  projectId: COPY_ID,
  rowId: bulkRows.rows[0].id,
  choices: [
    {
      fields: {
        title: "Choice One",
        text: "First",
        scores: [{ id: summary.pointTypes[0]?.id ?? "pt", value: -1 }],
      },
    },
    { fields: { title: "Choice Two", groups: summary.groups[0] ? [summary.groups[0].id] : [] } },
    { fields: { title: "Choice Three" } },
  ],
});
check(
  "add-choices bulk creates N choices with fields",
  bulkChoices.choices.length === 3 &&
    bulkChoices.choices[0].title === "Choice One" &&
    bulkChoices.choices[0].text === "First" &&
    bulkChoices.choices[0].scores?.length === 1,
  `titles=${bulkChoices.choices.map((c) => c.title).join(",")} scores=${bulkChoices.choices[0].scores?.length}`,
);

// 5. patch-app-document: wholesale replace of the rows array.
const keepRows = (await runAction("get-project-summary", { projectId: COPY_ID })).rows;
const rebuilt = keepRows
  .slice(0, 5)
  .map((r) => ({ id: r.id, index: r.index, title: `${r.title} (kept)`, objects: [] }));
await runAction("patch-app-document", { projectId: COPY_ID, patch: { rows: rebuilt } });
const after = await runAction("get-project-summary", { projectId: COPY_ID });
check(
  "patch-app-document replaces rows wholesale",
  after.rows.length === 5 &&
    after.rows[0].title.endsWith("(kept)") &&
    after.rows[0].choices.length === 0,
  `rows=${after.rows.length} first=${after.rows[0].title.slice(0, 40)}`,
);

// 6. list-project-changes: the ledger is written by the AGENT runtime, so
// seed a fake entry to validate the query path end-to-end.
await db.execute(
  "INSERT INTO agent_tool_ledger (thread_id, tool_key, result_summary, completed_at) VALUES (?, ?, ?, ?)",
  [
    "test-thread",
    `add-row:{"projectId":"${COPY_ID}","fields":{"title":"Ledger Probe"}}`,
    '{"row":{"id":"probe"}}',
    Date.now(),
  ],
);
const changes = await runAction("list-project-changes", { projectId: COPY_ID, limit: 20 });
// Only the seeded entry is visible — the other calls above ran the action's
// `run` directly and never went through the agent runtime's ledger.
const foundProbe = changes.changes.some(
  (c) => c.action === "add-row" && c.summary.includes("probe"),
);
check(
  "list-project-changes reads the tool ledger",
  foundProbe,
  `entries=${changes.changeCount} actions=${[...new Set(changes.changes.map((c) => c.action))].join(",")}`,
);
await db.execute("DELETE FROM agent_tool_ledger WHERE thread_id = ?", ["test-thread"]);

await db.execute("DELETE FROM projects WHERE id = ?", [COPY_ID]);
const fails = results.filter((r) => !r.pass);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
