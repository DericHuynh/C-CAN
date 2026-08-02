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
    `groups: string[]`, `requireds`. `Score.id` references a point type;
    `Score.value` is negative for a cost, positive for a reward.
  - `pointTypes: PointType[]` — the currencies (`name`, `startingSum`,
    `initValue`, `beforeText`/`afterText` labels).
  - `groups: Group[]` — `elements` (choice ids) in the same group are mutually
    exclusive in the viewer.
  - `globalRequirements: GlobalRequirement[]` — named `requireds` sets.
  - `backpack` — the result/backpack rows shown after play.
  - `viewerConfig.title` — the in-viewer title (distinct from the `projects`
    metadata `title`).
- **Normalization** — `normalizeApp()` (in `shared/cyoa.ts`) deep-merges any
  parsed document with the defaults so partial/older ICCPlus files always load,
  then runs `migrateApp()` — the same legacy-document migrations the original
  editor's `initializeApp()` applies on load (legacy `orRequired` →
  `orRequireds`, old width shapes, multiply/divide arrays, `sfxId` split, color
  objects → hex, old border-radius ×10, …). Keep the format forward-compatible
  (extra keys are preserved). Verify changes against the 17 MB example with
  `pnpm script roundtrip-check` and `pnpm script e2e-import-check`.

## Actions

All CYOA operations go through `defineAction`s in `actions/`. Action name =
file name. Reads use `http: { method: "GET" }`; mutations POST. Keep this table
in sync when actions change.

| Action | Purpose |
| --- | --- |
| `list-projects` | Summaries of all projects (rows/choices/point types counts) |
| `get-project` | Full project: metadata, `summary`, parsed `app` document |
| `create-project` | New project from the default document |
| `update-project` | Patch list metadata (`title`, `description`) |
| `delete-project` | Remove a project |
| `duplicate-project` | Clone a project ("(Copy)" suffix, fresh timestamps) |
| `import-project-json` | Import an ICCPlus JSON document (string or object) |
| `export-project-json` | Return the parsed document for download/copy |
| `add-row` / `update-row` / `delete-row` / `move-row` | Row CRUD + ordering |
| `add-choice` / `update-choice` / `delete-choice` / `move-choice` | Choice CRUD + ordering |
| `add-score` / `delete-score` | Attach/remove a point score on a choice |
| `add-point-type` / `update-point-type` / `delete-point-type` | Currency CRUD; delete also strips referencing scores |
| `add-group` / `update-group` / `delete-group` | Group CRUD |
| `add-global-requirement` / `update-global-requirement` / `delete-global-requirement` | Global requirement CRUD |
| `update-project-settings` | Viewer title, description, and top-level app defaults |

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
