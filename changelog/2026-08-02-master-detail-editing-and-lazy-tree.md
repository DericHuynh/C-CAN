---
type: added
date: 2026-08-02
---

Project editor rework: the editor route is now full width (like the viewer), every collection tab uses a master-detail layout, and the rows tree lazy-renders off-screen branches.

- **Master-detail editing** — the popup dialogs are gone. Each tab shows a master list on the left (rows tree, point types, groups, images, requirements, variables, words, design groups, categories, backpack rows, sound effects) and the editor form inline in a sticky right-hand pane (`MasterDetail` + `EditorPane`). `RowEditorDialog`/`ChoiceEditorDialog` became inline `RowEditor`/`ChoiceEditor` forms; selecting a tree branch opens its full editor in the pane (addon edits open with the Addons section). Delete confirms stay as dialogs.
- **Lazy tree** — the rows tree keeps all row headers mounted (they stay drag targets) but only mounts a row's choices/addons while the row is near the viewport (IntersectionObserver rooted at the real scroll container so the 1600px rootMargin isn't clipped away). Measured heights are cached so the scrollbar doesn't jump when branches unmount off-screen; filtering force-expands matching rows.
- **Robust drag-and-drop** — the tree's drop handlers no longer depend on the drop-indicator React state: the payload is read from the `dataTransfer` and the before/after/inside position is recomputed from the drop event's own coordinates. Fast drags (dragover → drop faster than React renders) can no longer lose the drop, and the drop position can no longer drift when the lazy tree re-renders mid-drag.

Verification now runs against throwaway copies of the project (`scripts/tmp-make-copy.mjs` + `PROJECT_ID`), never the real project: `tmp-verify-tree.mjs` (22 checks: nav, lazy rendering, row/choice/addon drags with DB-equality undo checks) and `tmp-verify-master-detail.mjs` (10 checks: full-width route, inline editors, save persists).
