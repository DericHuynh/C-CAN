---
type: changed
date: 2026-08-02
---

Editor lists and the rows tree now scroll in a bounded area instead of the whole page. Each tab's master column is a fixed-height internal scroll container (`calc(100dvh - 240px)`) with the count/Add header sticky at its top, so the top navigation and the sticky detail pane stay in view on every tab. The master column is also ~twice as wide (up to 720px, matching the images grid), so rows/choices/addons have room for their thumbnails and badges.

The rows tree is now click-to-edit instead of pencil-per-branch: clicking any row, choice or addon selects it and opens its editor in the detail pane, and the edit buttons are gone (rows keep Add + Delete, choices/addons keep Delete). Dragging is limited to the grip dots on the left of each branch — clicking elsewhere no longer starts a drag, and the grip is the only draggable element.

Verification (against throwaway copies only): `tmp-verify-tree.mjs` is now 24 checks (grip-handle drags for rows/choices/addons with DB-equality undo checks, no edit buttons, lazy windowing against the bounded master scroll) and `tmp-verify-master-detail.mjs` 10 checks (click-to-select, full-width route, save persists).
