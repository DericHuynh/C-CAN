---
type: added
date: 2026-08-02
---

Authoring actions rework — building a CYOA section went from ~330 tiny calls to a handful. Motivated by the MLP CYOA build run that hit the repetition guard (8+ identical `add-row`/`add-choice` calls) and took 2m24s.

- **`add-row` / `add-choice` now create fully-formed** — both accept an optional `fields` object (title, text, image, template, objectWidth, scores, groups, requireds, imageVariants, styling, row-kind flags, …), so create-then-update becomes one call.
- **`add-rows` / `add-choices` (new, bulk)** — create many rows or choices in a single call (`rows: [{ index?, fields? }]` / `choices: [{ index?, fields? }]`), the efficient path for scaffolding a whole section.
- **`get-project-summary` (new, read-only)** — lightweight structure read with no embedded images or bodies: per-row/choice id, index, title, counts, `requiredIds`, `scoreIds`, `groupIds`, plus point-type and group id/name lists. Plan wiring without loading the full document.
- **`list-project-changes` (new, read-only)** — recent agent tool calls that mutated a project (action + timestamp + result summary) from the framework tool ledger: "what changed since X", no more hand-recounting row ids.
- **`patch-app-document` (new)** — wholesale-replace any top-level app field (`rows`, `images`, `pointTypes`, …) in one call. The sanctioned write path for large rewrites (pass complete arrays; keep `styling` objects of rows you want preserved). `run-code` remains read-only by design — these actions are the mutation surface.

All are plain `defineAction`s in `actions/`, so they auto-register across chat/UI/HTTP/CLI/MCP/A2A and appear in the model's "Available Actions" prompt and `tool-search`; the `AGENTS.md` actions table is updated. Verified with `scripts/tmp-verify-actions.mjs` (7 checks: fully-formed single create, bulk rows/choices, wholesale patch, summary shape, ledger query) against a throwaway copy; dev server restarted to register the new actions.
