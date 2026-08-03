# ICCPlus CYOA Studio — Agent Guide

Agent-native port of the ICCPlus Interactive CYOA Creator. Projects are CYOA
documents stored in SQL (one row per project in `projects`; the full ICCPlus
`App` JSON lives in the `json` column). The chat is the primary surface; the
Projects UI (`/projects`) is a durable screen for building and playing CYOAs,
and every operation is an action shared by chat, UI, HTTP, MCP, A2A, and CLI.

## Core Rules

- Store large file/blob payloads in configured file/blob storage, not SQL: no
  base64, `data:` URLs, images, video/audio, PDFs, ZIPs, screenshots,
  thumbnails, or replay chunks in app tables, `application_state`, `settings`,
  or `resources`; persist URLs, ids, or handles instead. CYOA documents may
  reference external image URLs — never embed image bytes.
- Never hardcode API keys, tokens, webhook URLs, signing secrets, private
  Builder/internal data, customer data, or credential-looking literals. Use
  secrets/OAuth/runtime configuration and obvious placeholders in examples.
- Follow the root framework contract: data in SQL, actions first, application
  state for navigation/selection, and shared agent chat for AI work.
- Scale effort to the task. A small, well-specified change is a short read, the
  edit, and the app's existing checks (`pnpm typecheck`, formatter, existing
  tests) — not a codebase survey, unrequested tests, or browser automation.
- Use actions for app operations and keep frontend/API parity.
- Do not add `/api/*` routes for app data. If you are about to create a file
  under `server/routes/api/`, or middleware to guard one, stop and write a
  `defineAction` instead. The only exceptions are uploads, streaming, inbound
  webhooks, OAuth callbacks, public unauthenticated URLs, and non-JSON
  responses — not auth, settings, search, or CRUD.
- Treat the chat as the default UI. When the user asks for a capability, prefer
  adding or improving the action surface first, then add a page, table, form,
  or widget only when the user needs to inspect, compare, approve, or share
  durable objects.
- Keep the action surface small and orthogonal: every action is a tool in the
  model's context window, so prefer one CRUD-style `update` (patch of fields)
  over many per-field actions, mark UI-only or programmatic actions
  `agentTool: false` to hide them from the model (distinct from
  `toolCallable: false`, which only gates the extension iframe), and delete or
  hide actions the UI no longer uses. See the `actions` skill.
- Keep database code provider-agnostic and additive.
- Use `view-screen` or application state when the active page/selection is
  unclear.
- For new features, update UI, actions, skills/instructions, and application
  state when applicable.

## CYOA Domain Model

- **Project** — one row in `projects`: `id`, `title`, `description`, `json`
  (the serialized `App` document), `createdAt`, `updatedAt`, `isSeed`.
- **App document** (`shared/types.ts`, helpers in `shared/cyoa.ts`) — the
  ICCPlus format. Key collections:
  - `rows: Row[]` — each row has `id`, `index`, `title`, `titleText`, `image`,
    `objectWidth`, `allowedChoices`, `requireds`, and `objects: Choice[]`.
  - `Choice` — `id`, `index`, `title`, `text`, `image`, `scores: Score[]`,
    `groups: string[]`, `requireds`. `Score.id` references a point type.
    `Score.value` is applied to the total as `total -= value` (the original
    ICCPlus viewer's convention): a positive value is a cost, a negative
    value is a gain.
  - `pointTypes: PointType[]` — the currencies (`name`, `startingSum`,
    `initValue`, `beforeText`/`afterText` labels).
  - `groups: Group[]` — namespaces that tag choices so requirements
    (`selFromGroups`), discounts, and activate/deactivate-other effects can
    target them together. Like the original ICCPlus viewer, groups do NOT
    auto-deselect members — exclusivity is expressed with "not selected"
    (`required: false`) requirements, enforced by the viewer's
    missing-requirement cascade.
  - `globalRequirements: GlobalRequirement[]` — named `requireds` sets.
  - `backpack` — the result/backpack rows shown after play.
  - `images: ImageResource[]` — the image-resource collection. Choices, rows,
    addons and point types reference images **by id** (like choices/rows
    reference each other). An `ImageResource` has `id`, `name`, `image` (data
    URL or remote URL), `imageIsURL`, `sourceTooltip`. The viewer resolves ids
    via `resolveImageRef()`; un-resolvable strings render as-is (legacy
    inline images keep working).
  - `Choice.imageVariants: ImageVariant[]` — requirement-gated image
    switching (`imageSwitchingIsOn`): the highest-priority (`priority`,
    lower wins) variant whose `requireds` are met replaces the base image.
    Requirements may target choices, **selectable addons**, points, groups or
    global requirements.
  - `viewerConfig.title` — the in-viewer title (distinct from the `projects`
    metadata `title`).
- **Normalization** — `normalizeApp()` (in `shared/cyoa.ts`) deep-merges any
  parsed document with the defaults so partial/older ICCPlus files always load,
  then runs `migrateApp()` — the same legacy-document migrations the original
  editor's `initializeApp()` applies on load (legacy `orRequired` →
  `orRequireds`, old width shapes, multiply/divide arrays, `sfxId` split, color
  objects → hex, old border-radius ×10, …). Keep the format forward-compatible
  (extra keys are preserved). Verify changes against the 17 MB example with
  `pnpm script roundtrip-check` and `pnpm script e2e-import-check`. The example's
  aggregate shape is pinned by `shared/cyoa-example.spec.ts` (generated — run
  `pnpm script generate-example-tests` after changing `examples/project.json`);
  `pnpm script aggregate-json-stats` prints a context-safe summary that skips
  embedded image payloads.
- **ACL import translation** — `aclImportImages()` (in `shared/cyoa.ts`) is the
  compatibility layer that rewrites legacy ICCPlus documents into the
  image-resource system on import (called by `import-project-json` after
  `normalizeApp`): inline image strings on choices/rows/addons/point types and
  image variants become `images` resources, deduplicated by payload, and the
  entity references are rewritten to resource ids. It is idempotent (already-
  translated documents are untouched). **Import must accept old ICCPlus files;
  re-export uses the new id-based format and is NOT expected to load in the
  original ICCPlus editor.**

## Actions

All CYOA operations go through `defineAction`s in `actions/`. Action name =
file name. Reads use `http: { method: "GET" }`; mutations POST. Keep this table
in sync when actions change.

| Action                                                                               | Purpose                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list-projects`                                                                      | Summaries of all projects (rows/choices/point types counts)                                                                                                                   |
| `get-project`                                                                        | Full project: metadata, `summary`, parsed `app` document                                                                                                                      |
| `get-project-summary`                                                                | **Lightweight** structure read (no images/bodies): rows → choices with ids, titles, counts, `requiredIds`, groups + point types — for planning wiring without loading the doc |
| `list-project-changes`                                                               | Recent agent tool calls that mutated a project (action + timestamp + result summary) — "what changed since X"                                                                 |
| `create-project`                                                                     | New project from the default document                                                                                                                                         |
| `update-project`                                                                     | Patch list metadata (`title`, `description`)                                                                                                                                  |
| `delete-project`                                                                     | Remove a project                                                                                                                                                              |
| `duplicate-project`                                                                  | Clone a project ("(Copy)" suffix, fresh timestamps)                                                                                                                           |
| `import-project-json`                                                                | Import an ICCPlus JSON document (string or object)                                                                                                                            |
| `export-project-json`                                                                | Return the parsed document for download/copy                                                                                                                                  |
| `add-row` / `update-row` / `delete-row` / `move-row`                                 | Row CRUD + ordering; `add-row` accepts optional `fields` (title, requireds, styling, …) to create fully-formed                                                                |
| `add-rows`                                                                           | **Bulk** create many rows in one call (`rows: [{ index?, fields? }]`)                                                                                                         |
| `add-choice` / `update-choice` / `delete-choice` / `move-choice`                     | Choice CRUD + ordering; `add-choice` accepts optional `fields` (title, text, scores, requireds, …); `move-choice` also reparents across rows (`rowId` is the target row)      |
| `add-choices`                                                                        | **Bulk** create many choices in one row (`choices: [{ index?, fields? }]`)                                                                                                    |
| `add-score` / `delete-score`                                                         | Attach/remove a point score on a choice                                                                                                                                       |
| `move-addon` / `delete-addon`                                                        | Move an addon (by array index) between choices or reorder within one (rewrites `parentId`); remove an addon from a choice                                                     |
| `add-point-type` / `update-point-type` / `delete-point-type`                         | Currency CRUD; delete also strips referencing scores                                                                                                                          |
| `add-group` / `update-group` / `delete-group`                                        | Group CRUD                                                                                                                                                                    |
| `add-global-requirement` / `update-global-requirement` / `delete-global-requirement` | Global requirement CRUD                                                                                                                                                       |
| `patch-app-document`                                                                 | Wholesale-replace any top-level app field (`rows`, `images`, …) in one call — the sanctioned way to rewrite a big section without hundreds of mutations                       |
| `update-project-settings`                                                            | Viewer title, description, and top-level app defaults                                                                                                                         |

## Application State

- `navigation` should describe the current view and selected entity ids
  (e.g. `projects/{id}` editor, `projects/{id}/play` viewer). The chat view is
  `chat` at `/`.
- `navigate` may be used to move the UI when the app supports it.
- `view-screen` is the first tool to call when the user's visible context
  matters.

## Model Providers

The agent runs on whichever provider key is configured, with **per-user keys
winning over deployment env vars**. DeepSeek is registered through the
framework's standard extension points in `server/plugins/deepseek.ts`:

> **Context window**: the framework's model catalog (`@agent-native/core`
> `getContextWindowForModel`) defaults unknown models to 128k. This repo
> patches the installed package via `patches/` + `pnpm-workspace.yaml`
> `patchedDependencies` so `deepseek-*` resolves to a 1M window (what the
> Context X-Ray meter reports). Re-apply after a clean install with
> `pnpm install`; keep the patch in sync when upgrading `@agent-native/core`.

- `registerAgentEngine()` — engine entry (`deepseek`, OpenAI-compatible
  endpoint, `deepseek-chat` / `deepseek-reasoner`), so it appears in the
  settings engine picker and agent runtime.
- `registerRequiredSecret()` — standard secrets flow: users enter their key
  in Settings → Secrets (user-scoped, encrypted), with a DeepSeek API
  validator powering the Test button. The framework's own
  `/_agent-native/secrets/*` routes handle write/test/delete — do not add
  custom key actions or routes.

The deployment-level `DEEPSEEK_API_KEY` env var is a shared default; a user's
saved key overrides it. When no key is configured, requests fail with a clear
missing-credentials error; never invent, log, or reuse keys. Key values are
never returned by any route — only last-4 metadata.

## Framework Docs Lookup

- Before implementing or explaining non-trivial Agent Native behavior, use the
  `agent-native-docs` skill and the built-in `docs-search` action/tool to read
  the version-matched framework docs bundled with `@agent-native/core`.
- Use the built-in `source-search` action/tool, or search
  `node_modules/@agent-native/core/corpus`, when you need current core or
  first-party template implementation examples.
- Prefer those installed docs over memory or public docs when package APIs,
  generated-app conventions, workspaces, actions, or agent surfaces are involved.
- Before building common workspace or agent UI, read `agent-native-toolkit` to
  inventory existing public kits and installed package seams.
- Read `customizing-agent-native` before overriding the chat shell or shared UI.
  Keep Core thread/runtime behavior and use the supported ladder: configure →
  compose → eject the smallest presentation unit → propose a shared seam.
  Preview before `--apply` and commit `agent-native.ejections.json`.

## Skills

Read the relevant root skill before implementation: `adding-a-feature`,
`actions`, `agent-native-docs`, `agent-native-toolkit`,
`customizing-agent-native`, `storing-data`, `real-time-sync`, `security`,
`delegate-to-agent`, `frontend-design`, `shadcn-ui`, `self-modifying-code`,
and `cyoa-authoring` (domain-specific authoring guidance).
