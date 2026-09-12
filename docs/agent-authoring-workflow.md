# Agent authoring workflow

`build-project` is the entry point for a transactional build, validation and viewer capture.
It covers scaffolding, adding sections, choice sets and choices with addons without
requiring discovery of a long chain of individual CRUD tools.

```json
{
  "title": "Dream paths",
  "operations": [
    { "op": "create", "kind": "point", "alias": "dream", "fields": { "name": "Dream" } },
    { "op": "create", "kind": "row", "alias": "intro", "fields": { "title": "Introduction" } },
    {
      "op": "create",
      "kind": "choice",
      "id": "sleep",
      "parent": "$intro",
      "fields": {
        "title": "Sleep",
        "scores": [{ "id": "$dream", "value": -5 }]
      }
    },
    {
      "op": "create",
      "kind": "addon",
      "id": "dawn",
      "parent": "sleep",
      "fields": {
        "title": "A quiet dawn",
        "text": "The first light spreads over the hills."
      }
    }
  ],
  "preview": { "addonId": "dawn", "buildCode": "" }
}
```

Read existing projects with `inspect-project` using `projection: prose`, `mechanics`,
`dependencies`, or `reference`. Results include stable IDs, complete navigation targets,
revision and explicit pagination. Prose slices are never replacement documents. References
accept exact IDs, unique titles and `$aliases`; duplicate names require an ID.

For edits, pass `projectId` and the inspected `expectedRevision`. Each operation accepts
`expected` field values for optimistic concurrency. Parent/child entities and their references
can be created together in any order. Nested entity arrays cannot be replaced through a batch
update. `update-addon` patches one addon without replacing siblings; `add-addons` validates
all parents and saves once. Existing positional editor calls remain compatible.

A batch writes one project document only after validation. Its result includes `committed`,
a compact manifest, alias map, checked references and remaining warnings. `dryRun` writes
nothing. New projects and clones are private and owned by the requesting user/organization.
Project history records a compact human summary, not the input document.

Preview opens the viewer in the requesting browser tab, resolves all parents and checks the
saved document revision before requesting pixels. A supplied build code is an isolated test
state; the empty string means fresh start. Normal saved player slots remain separate.
The capture reports visible targets and viewport DOM checks for overflow, failed/pending
images, narrow layout and locked targets. Contrast/readability require reviewing the image;
DOM checks are not a visual quality verdict. A text-only model must not claim to see pixels.

If `committed` is true but preview fails, retry `preview-project` only. If capture is pending,
resume `capture-viewer` with its `requestId` and `browserTabId`. If there is no connected tab,
the viewer stays on chat, the document is stale or the target is hidden, the result says so.
A transport failure is ambiguous: inspect current IDs and revision before retrying a write.
Semantic IDs make accidentally repeated creation reject rather than silently duplicate.

`clone-project` supports full copies, selected sections with known dependencies, global
styling, and core mechanics. The source is never modified. Core-mechanics copies deliberately
exclude advanced activation/function effects; inspect their notes and validation.

Validation checks known point/group/row/choice/addon/global-requirement references, simple
contradictions and positive dependency cycles. Currency bounds assume independent linear
selections and ignore exclusivity/order; nonlinear cases report no bound. Supplied build codes
can check multiple ending states using the same requirement engine as the viewer. These
checks do not establish exhaustive reachability, especially for arbitrary ICCPlus extensions.
