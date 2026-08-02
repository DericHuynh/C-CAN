# ICCPlus CYOA Studio

Agent-native port of the **ICCPlus Interactive CYOA Creator** — an interactive
Choose Your Own Adventure authoring tool. Built on the Builder.io Agent-Native
framework: the chat, the editor UI, and the agent all share one SQL database
and one action surface, so you can build a CYOA by clicking **and** by talking
to the agent.

The original Svelte 5 apps live in the sibling `ICCPlus/` (creator) and
`ICCPlus_Viewer/` (viewer) directories. This app reuses the exact ICCPlus
document format (`shared/types.ts`, ported verbatim), so projects import and
export as compatible JSON.

## Features

- **Chat-first agent** (`/`) — ask the agent to build or edit a CYOA; every
  durable change goes through the same actions the UI uses.
- **Project library** (`/projects`) — create, duplicate, import (ICCPlus JSON),
  export, and delete CYOA projects.
- **Editor** (`/projects/:id`) — tabs for Rows (with choices and scores),
  Point types, Groups, Global Requirements, Settings, and a raw JSON view.
- **Viewer** (`/projects/:id/play`) — playable CYOA: point bar, requirement
  gating, mutually exclusive groups, per-row selection limits, and a result
  (backpack) panel.
- 28 orthogonal `defineAction`s shared by the agent, UI, HTTP, MCP, and CLI.
- Local SQLite (`data/app.db`) with a seeded demo project on first boot.

## ICCPlus interchange (project.json)

The CYOA document format is the ICCPlus format (`shared/types.ts` is ported
verbatim), so projects move freely between this app and the original ICCPlus
editor:

- **Import** (`/projects` → Import CYOA JSON) accepts pasted JSON, a
  `project.json` file, or a `.zip` export (the zip's `images/…` are inlined as
  data URLs, mirroring the original `loadFromDisk`).
- **Export** (editor → JSON tab → Download .json) writes a document the
  original editor opens directly.
- **`normalizeApp()`** (`shared/cyoa.ts`) deep-merges any parsed document with
  the app defaults **and** runs the same legacy-document migrations the
  original `initializeApp()` performs on load (legacy `orRequired` →
  `orRequireds`, old `width`/`defaultWidth` shapes, multiply/divide arrays,
  `fadeTransitionTime` → in/out pair, `sfxId` split, color-object → hex,
  old border-radius ×10, backpack tagging, point `initValue`, …). Older
  ICCPlus files therefore behave identically in this port, and exports stay
  loadable by the original.

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

Then open http://localhost:8080. On first run in dev the app auto-signs you in
with a local demo account; production deploys need a persistent `DATABASE_URL`.

## Scripts

```bash
pnpm dev        # dev server (hot reload)
pnpm build      # production build
pnpm start      # run the production build
pnpm typecheck  # TypeScript checks
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
(workflows, point balance, requirements, pitfalls).
