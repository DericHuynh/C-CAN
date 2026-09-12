# ICCPlus CYOA Studio

Agent-native port of the **ICCPlus Interactive CYOA Creator** — an interactive
Choose Your Own Adventure authoring tool. Built on the Builder.io Agent-Native
framework: the chat, the editor UI, and the agent all share one SQL database
and one action surface, so you can build a CYOA by clicking **and** by talking
to the agent.

The original Svelte 5 apps live in the sibling `ICCPlus/` (creator) and
`ICCPlus_Viewer/` (viewer) directories. This app imports legacy ICCPlus documents and stores images as referenced resources
(`shared/types.ts`). Exports use this app’s resource-id format.

## Features

- **Chat-first agent** (`/`) — ask the agent to build or edit a CYOA; every
  durable change goes through the same actions the UI uses.
- **Project library** (`/projects`) — create, duplicate, import (ICCPlus JSON),
  export, and delete CYOA projects.
- **Editor** (`/projects/:id/editor`) — tabs for Rows (with choices and scores),
  Point types, Groups, Global Requirements, Settings, and a raw JSON view.
- **Image sourcing (e621 / Derpibooru)** — the agent searches images by tag
  (`search-image-source`) and imports them with automatic attribution
  (`add-image-from-source`): the post's title, description, full tag list and
  source URL are copied onto the image resource. Image resources carry
  `description`, `tags` and `source` fields. Optional per-user credentials
  (Settings → Secrets) enable NSFW content — required on Derpibooru, which
  hides higher ratings from anonymous visitors.
- **Project modes** — `/projects/:id/editor`, `/projects/:id/visual-editor`,
  and `/projects/:id/viewer`. Old `?mode=` links redirect to these routes;
  saved builds and reader preferences are retained. Pages use their own toolbar,
  with notifications immediately before Share on project pages.
- **Viewer** (`/projects/:id/viewer`) — playable CYOA: point bar, requirement
  gating, group-based requirements, per-row selection limits, and a result
  (backpack) panel.
- Orthogonal `defineAction`s shared by the agent, UI, HTTP, MCP, and CLI.
- Local SQLite (`data/app.db`) with a seeded demo project on first boot.

## ICCPlus interchange (project.json)

Legacy ICCPlus documents can be imported. Exports preserve this app’s image-resource
references and are not expected to open in the original ICCPlus editor:

- **Import** (`/projects` → Import CYOA JSON) accepts pasted JSON, a
  `project.json` file, or a `.zip` export (the zip's `images/…` are inlined as
  data URLs temporarily for upload to blob storage; only URLs are persisted).
- **Export** (editor → Project → JSON → Download .json) writes a document
  for reimport into this app. Image URLs must remain accessible.
- **`normalizeApp()`** (`shared/cyoa.ts`) deep-merges any parsed document with
  the app defaults **and** runs the same legacy-document migrations the
  original `initializeApp()` performs on load (legacy `orRequired` →
  `orRequireds`, old `width`/`defaultWidth` shapes, multiply/divide arrays,
  `fadeTransitionTime` → in/out pair, `sfxId` split, color-object → hex,
  old border-radius ×10, backpack tagging, point `initValue`, …). Older
  ICCPlus files can therefore load with their legacy settings.

Interchange is verified against the real-world 17 MB example
(`examples/project.json`) with two scripts:

```bash
pnpm script roundtrip-check      # normalize + re-serialize: zero data loss
pnpm script e2e-import-check     # through the DB actions, import → export → verify
```

## Develop locally

```bash
pnpm install
pnpm dev
```

Then open the URL printed by the dev server (normally http://localhost:8080)
and create a local account on the sign-in page. CYOA editing and playing work
without an AI key; connect a provider when you want to use chat. Production
deploys need persistent database and blob storage.

## Scripts

```bash
pnpm dev        # dev server (hot reload)
pnpm build      # production build
pnpm start      # run the production build
pnpm typecheck  # TypeScript checks
pnpm test       # unit and regression tests (no app server or provider key required)
pnpm exec vp fmt --check  # formatting checks
pnpm action <name> '{"arg":"value"}'  # call an action from the CLI
```

## Model provider

The in-app agent runs on whichever provider key is configured, using the
framework's standard flows:

- **Engine registration** — `server/plugins/deepseek.ts` registers DeepSeek
  through `registerAgentEngine()` (the framework's provider extension point),
  so it appears in the settings engine picker and the agent runtime with
  `deepseek-chat` / `deepseek-reasoner`.
- **Keys** — entered through the framework's standard secrets flow
  (`registerRequiredSecret`): **Settings → Secrets → DeepSeek API Key**.
  Keys are stored encrypted (AES-256-GCM) in the app secrets table, scoped to
  the signed-in user, and validated with a real DeepSeek call by the Test
  button. A user's saved key overrides the deployment-level `DEEPSEEK_API_KEY`
  env var for that user; the env var is the shared default for users without
  their own key.

Alternative (pure framework, no customization): DeepSeek is OpenAI-compatible,
so you can also set `OPENAI_API_KEY` + `OPENAI_BASE_URL=https://api.deepseek.com`
and pick the OpenAI provider — the settings card's advanced endpoint field
covers this. Provider priority when multiple keys exist: Builder gateway >Anthropic > OpenAI > Google > … > DeepSeek (DeepSeek wins when
`DEEPSEEK_API_KEY` is the only key present).

Per-user secrets are encrypted at rest — set `SECRETS_ENCRYPTION_KEY` (or
`BETTER_AUTH_SECRET`) in production or the secrets vault will hard-fail on
write. When no key is configured the agent reports a missing-credentials
error instead of crashing.

## Agent guidance

`AGENTS.md` is the always-on instruction file for the in-app agent; the
`.agents/skills/cyoa-authoring/` skill adds domain-specific authoring guidance
(workflows, point balance, requirements, pitfalls). Custom delegatable agent
personas live in `agents/*.md` (e.g. `agents/cyoa-author.md`, invoked with
`@CYOA Author`).

## Framework integrations

Every integration below is built on the standard Agent-Native seams — no
custom `/api/*` routes.

### External agents: MCP server + A2A

The app is both an **MCP server** (`POST /_agent-native/mcp`, Streamable
HTTP) and an **A2A agent** (`/.well-known/agent-card.json` +
`POST /_agent-native/a2a`), mounted automatically by the agent-chat plugin.
The external tool catalog is curated in `server/plugins/agent-chat.ts`
(`connectorCatalog` + `externalAgents`): read-only actions
(`list-projects`, `get-project`, `get-project-summary`,
`list-project-changes`, `export-project-json`) are directly callable by
authenticated hosts; edits stay behind `ask_app` so external agents hand
real authoring back to this app's agent.

```bash
claude mcp add --transport http agent-native \
  https://your-app.example.com/_agent-native/mcp
```

Mint tokens with the `connect` CLI (personal or `--service-token` for CI):
`npx @agent-native/core@latest connect <app-url>`.

### HTTP API (headless actions)

Every `defineAction` is already an HTTP endpoint — no separate API to
build:

```bash
curl -sS -X POST \
  https://your-app.example.com/_agent-native/actions/list-projects \
  -H "Authorization: Bearer $AGENT_NATIVE_TOKEN"
```

GET actions take query params (`get-project?id=…`); errors return
`{ "error": string }` with standard status codes. Useful for CI, cron, or
batch-importing ICCPlus JSON files via `import-project-json`.

### Chat data widgets

`list-projects` and `get-project-summary` declare `chatUI: core.data-table`,
so their results render as native tables in agent chat (action results carry
additive `columns`/`rows` keys — existing consumers are unchanged).

### Notifications

Actions can ring the in-app bell via `notify()` (inbox + optional
email/Slack/webhook via `NOTIFICATIONS_*` env). `import-project-json` and
`duplicate-project` notify on success. The bell renders in the global header
(`NotificationsBell`).

### Proof-of-done guard

`server/plugins/agent-chat.ts` registers a `finalResponseGuard`: when you ask
for durable work and the model claims it is done, the answer is only accepted
if a mutating project action actually ran this turn. This is the
version-matched equivalent of the framework's in-loop `Processor` seam, which
is only configurable at `runAgentLoop` call sites.

### Sandboxed extensions

User/agent-authored extension mini-apps are enabled (`extensionTools: true` on
both the agent-chat and core-routes plugins); the app ships the `/extensions`
routes. Extensions call the same actions the agent uses.

### MCP clients (extra agent tools)

`mcp.config.json` intentionally has no deployment-wide filesystem server.
Use Settings to connect scoped MCP tools; keep the database and upload
directory behind project actions. Browser/computer-use servers (Playwright,
Chrome DevTools, Computer Use) are built-in local-dev toggles in Settings.
Project `@` mentions use the bounded, access-checked `search-projects` action.

### Sharing & publishing (G2)

`projects` is registered as a shareable resource (`server/plugins/project-resources.ts`),
so the framework's share actions work on CYOA projects: `share-resource`,
`unshare-resource`, `list-resource-shares`, `set-resource-visibility` (private /
org / public). A Share button on each project card and in the editor header
opens the share dialog (visible to others as a playable viewer link).

### History / undo / restore (G1)

`projects` is registered as a versioned resource, so `create-resource-version`,
`list-resource-versions`, `get-resource-version`, and `restore-resource-version`
snapshot and restore the authored document (json + title + description). The
agent can snapshot before significant edits and roll back on request.
Editor → Project → History exposes checkpoints and confirmed restore. The UI
saves a backup before restoring. Restores validate the snapshot and use the
normal conditional save/blob boundary. Invited roles reuse Core sharing.

### Comments / review (G7)

`projects` is registered as a reviewable resource — the framework's
`create-review-comment` / `send-review-thread-to-agent` / review-status actions
work on projects (agent- or human-targeted feedback on a CYOA). Editor →
Project → Review supports anchored comments, replies, resolution, and
**Queue for agent**. Use **Ask agent** to have the agent address that queue;
queuing a comment does not start a model run by itself.

### Image sourcing (e621/Derpibooru)

`search-image-source` searches e621 or Derpibooru by tag query
(space-separated tags; metatags like `rating:safe`, `species:canine`,
`order:random`; Derpibooru ratings are translated to its bare-word syntax)
and returns candidates with post id, direct image URL, title, description,
tags and source. `add-image-from-source` imports a chosen post id with
**automatic attribution** — title→resource name, plus tags, description and
source URL. Both actions respect the site APIs' rate limits and fail with
clear messages on 401/403/429/501/503 responses.

NSFW access is opt-in per user via Settings → Secrets:

- `E621_USERNAME` + `E621_API_KEY` (e621 — Basic auth; e621 serves explicit
  content anonymously but the key raises limits)
- `DERPIBOORU_API_KEY` (Derpibooru — `key` query param; **required** for
  explicit content, which Derpibooru hides from anonymous visitors)

Each secret has a Test button backed by a real API call. Image resources can
also carry `description`, `tags` and `source` from any source (paste them in
the editor's Images tab or pass them to `add-image`).

### Blob storage for images (G6)

`server/plugins/file-upload.ts` registers a local-disk blob provider
(`data/uploads/`, served at `/_agent-native/uploads/<key>` — override with
`FILE_UPLOADS_DIR`). Importing a legacy project.json or adding an image with a
data-URL payload stores the bytes as a blob and keeps a URL reference
(`imageIsURL: true`) in the document, so base64 payloads never sit in SQL.
The project.json interchange format is unchanged — import and export still
work with the original ICCPlus editor. Import progress is reported through
the framework's runs tray (`startRun`/`updateRunProgress`/`completeRun`).

### Recurring jobs (G3)

`jobs/*.md` are scheduled agent prompts (cron frontmatter) that run when the
app is deployed with a provider key; local dev keeps them disabled by
default. None are shipped — add one only when you want scheduled agent work.

### Evals (G4)

Agent regression tests live in `evals/*.eval.ts` and run with
`pnpm script eval-cyoa` (requires a configured provider key).

### Real-time collaboration (G8)

Core database sync keeps action-saved changes visible across tabs. Live Yjs
editing/presence is deferred until the forms and agent actions participate in
one coordinated document lifecycle. The unused collab plugin was removed:
it exposed a second whole-document writer without a connected editor client.

### Messaging (G9)

`server/plugins/messaging.ts` mounts the integrations plugin (Slack, email,
Telegram, WhatsApp, Discord, Teams inbound adapters — same actions/tools as
web chat). Each platform needs its own credentials under Settings →
Integrations before messages flow.

### Provider APIs & workspace (G10/G12)

The agent already has the provider-API tool surface (`provider-api-request` /
`provider-api-docs` / `provider-api-catalog`) plus `web-request`/`web-search`
for external services. This is a standalone app, so the multi-app workspace
(Dispatch) does not apply — sibling agent-native apps can still delegate work
here over A2A (`/.well-known/agent-card.json`, read-only actions plus
`ask_app`-gated editing).

### Onboarding (G11)

Onboarding is mounted by the framework's default plugin set (the app does not
override it) — the standard LLM/database/auth setup checklist applies.

### Custom agents

`agents/*.md` defines delegatable personas — see `agents/cyoa-author.md`
(`@CYOA Author`) for a domain-specialized authoring agent.

### Voice input

Dictation in the composer works out of the box (Builder Gemini, or BYOK
`GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY`, with browser Web Speech
fallback).

### Durable background runs (Netlify)

Long agent turns move to a 15-minute Netlify background function when
deployed (`durableBackgroundRuns: true`; needs `A2A_SECRET` set; falls back
to inline turns with a circuit-breaker otherwise).

### Toolkit

The app adopts `@agent-native/toolkit`: `ToolkitProvider` with the app's
`designSystem`, local `@/components/ui/*` adapters, `@agent-native/toolkit`
styles, and `app-shell` header/command surfaces (see `customizing-agent-native`
and `agent-native-toolkit` skills before customizing further).

### Integration audit and checks

See [the Agent Native integration audit](docs/agent-native-integration-audit.md)
for the complete installed documentation catalog, wiring, changes, and
provider/deployment prerequisites. `view-screen` now hydrates selected CYOA
context through `get-project-context`; visual selection is in the URL and
survives reload and agent navigation. Project edits have resource audit labels;
`list-project-changes` uses Core audit scoping instead of the execution ledger.
The progress tray sits beside notifications and is hidden when idle.

Run `pnpm typecheck`, `pnpm test`, `pnpm guard:i18n-catalogs`, and `pnpm doctor`.
All nine Doctor guards pass. The audit documents two narrow deployment-setting
exceptions; no guards are disabled globally. Copies of shared projects are
private and belong to the person making the copy, in their active organization.

For an isolated verification copy, run
`pnpm script make-project-copy --id <source-project-id>`; the CLI resolves the
current user (set `AGENT_USER_EMAIL` if ambiguous). It returns only the new
ID/title. The older wrapper accepts `node scripts/tmp-make-copy.mjs --source-id
<project-id>`. Browser verification helpers now take `--project-id <copy-id>`
instead of the `PROJECT_ID` environment variable.

Viewer feedback is available in Viewer and Visual editor. Use the chapter picker,
previous/next buttons, or search to jump without changing your selections. Links
preserve row, choice, and addon targets. **Review this view** previews the current
viewer screenshot and lets you ask the agent for feedback. Choose a model with
vision support in chat for picture review; text-only models can still inspect the
visible IDs and navigation state. Agents use `navigate`, then `view-screen` with
`{ "screenshot": true }`; `capture-viewer` supports retrying pending captures.
