---
type: changed
date: 2026-08-02
---

Editor performance and pagination rework. Opening or switching the detail pane used to take 2-3 seconds on the big example (181 rows / 1,188 choices / 1,132 images); it now takes ~150ms. Two root causes:

- **Hidden select items**: Radix renders every `SelectItem` of a closed `SelectContent` into a hidden `DocumentFragment` (it keeps them registered). The row/choice editors mount several such selects — the image picker (1,132 items) plus every requirement's choice picker (1,188 items each) — so opening an editor created ~3,000+ hidden items per mount. The new `LazySelect` only renders options while the dropdown is open (the trigger label comes from explicit `SelectValue` children), and large pickers get a search box inside the dropdown. The shared `ImageResourceSelect`, the row/choice/addon/variant image fields and the requirement pickers all use it. Closed selects now mount nothing.
- **Windowed lists**: the `VirtualList` windowing and the rows tree's IntersectionObserver lazy-rendering are gone. Per the earlier direction, every editor list is now **paginated**: a page renders fully (deterministic heights, no scroll-linked mounting), and Prev/Next + a range label move between pages. The rows tree pages 20 rows at a time (row badges show global numbers; drag-and-drop reorders within the page using global indexes via `rowOffset`), the images grid pages 27 cards (3 columns), and point types, groups, requirements, variables, words, sound effects, design groups, backpack rows, the ID list and the group-form row/choice checklists all use the shared `PaginatedList`. The pager's range label can be customized (images show "1–27 of 1132"). `VirtualList` was deleted.

Pages stay put across edits — a save/refetch no longer bounces you back to page 1 (the page only resets when a filter changes, and is clamped to the valid range otherwise). Choice collapse state is now actually wired (the chevron previously read the row's collapsed state), and it survives paging.

Verification (against throwaway copies only): `tmp-verify-tree.mjs` is now 24 checks (paging mounts a different row set, drags with DB-equality undo checks), `tmp-verify-master-detail.mjs` 10 checks, and the new `tmp-verify-pagination.mjs` 11 checks (pager ranges, global row numbers, sub-400ms row/choice selection, lazy+searchable dropdowns that mount zero options when closed, 3-column paginated images grid).
