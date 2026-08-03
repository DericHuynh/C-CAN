---
type: added
date: 2026-08-02
---

Editor: right-click context menus on every rows-tree branch. Right-clicking a row offers "Add row above / below", a choice offers "Add choice above / below", and an addon offers "Add addon above / below" — the new item is inserted at the cursor position, selected, and opened in the detail pane (row inserts also jump the pager to the page that contains the new row). The menu is a cursor-positioned portal (clamped to the viewport), closes on outside click, a second right-click, or Escape, and nested nodes stop propagation so right-clicking a choice doesn't also open the row's menu.

The inserts reuse the existing `add-row` / `add-choice` actions (both already accepted an `index`) and `update-choice` for addons (the new addon is spliced into the choice's `addons` array at the target position). The `useUpdateChoice` hook's result type was corrected to include the returned `choice`, which the addon insert uses to select the new addon.

Verification (throwaway copies only): `tmp-verify-contextmenu.mjs` — 7 checks (row/choice/addon menus with the right items, Escape closes, "add row above" inserts at the right index and selects the new row, "add addon below" increments the addon count). Full regression: `tmp-verify-tree` 24/24, `tmp-verify-pagination` 11/11, `tmp-verify-master-detail` 10/10, 523 unit tests.
