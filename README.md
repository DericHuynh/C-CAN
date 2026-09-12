# ICCPlus CYOA Studio (C-CAN)

An interactive Choose Your Own Adventure authoring and viewing product built on
Agent Native, React 19 and React Router. Authors can edit through forms, a visual
canvas, linked writing drafts or agent chat. Every durable operation uses the
same validated actions and SQL-backed projects.

## Product surfaces

- `/explorer`: discover published ICYOAs with fuzzy search, tags, SFW/NSFW filters
  and independent overall/category ratings.
- `/explorer/:id`: release details and rating distributions.
- `/play/:id`: standalone released game with browser fullscreen.

- `/projects`: create, duplicate, import, export and manage CYOAs.
- `/projects/:id/editor`: content, rules, image resources, planning, design,
  settings, history and review. Panels load on demand.
- `/projects/:id/visual-editor`: edit the playable layout and text directly.
- `/projects/:id/viewer`: play, navigate sections, inspect points, save/load builds,
  customize reader preferences and export backpack images.
- `/`: agent chat with project mentions, bounded content search, target navigation
  and viewer screenshot feedback. Image critique requires a vision-capable model.

Modes use canonical path resources. Legacy `?mode=` links redirect while retaining
selection. Pages own their toolbars; notifications appear beside Share on project
pages. Shared editor forms save with **Shift+S** outside text entry.

The editor works without an AI provider key. Configure providers in Settings when
using chat. Agent edits, external clients and the UI share project access checks;
external-agent writes remain behind the app's `ask_app` delegation surface.

## Local development

Use Node 24 and the pnpm version pinned in `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed URL and create a local account. Configure a stable development
`BETTER_AUTH_SECRET` to retain sessions between server restarts. `.env.example`
documents the available deployment settings without embedding credentials.

Local development defaults to SQLite in `data/app.db` and uploads in
`data/uploads`. New development demo projects are public examples that can be
copied into private projects. Production does not seed demonstration content.

```bash
pnpm typecheck            # regenerate action/route types and check TypeScript
pnpm test                 # regression, architecture and SQLite concurrency tests
pnpm doctor               # framework diagnostics
pnpm check                # typecheck + tests + Doctor
pnpm guard:architecture   # focused dependency and cycle checks
pnpm build                # client, SSR and Nitro production build
pnpm start                # run the production build
```

The GitHub workflow runs the checks, example roundtrip and production build with
a frozen lockfile. It does not deploy or require AI credentials.

## ICCPlus interchange

Import accepts raw ICCPlus JSON, `project.json`, or ZIP exports. Normalization
preserves unknown fields and migrates legacy document shapes. Embedded images,
backgrounds and sound effects move into configured blob storage; project JSON
stores references. Tiny bounded image previews are the documented exception.

Exports use C-CAN's image-resource-ID format and are intended for reimport here;
they are **not promised to reopen in the original ICCPlus editor**. Referenced
image URLs must remain available. ICCPlus build codes are accepted, with a
C-CAN extension for saved per-copy score gates where required.

```bash
pnpm script roundtrip-check
pnpm script e2e-import-check
```

The roundtrip check uses the real large example in `examples/project.json`.
The import check uses actual project actions and removes its scratch project;
run it with a configured local or isolated test database, never as a production
load test. [Viewer parity notes](docs/viewer-parity-audit.md) describe covered
semantics and external-media limitations.

## Agent and collaboration features

- Generated, typed actions serve React hooks, agent tools, HTTP, CLI, MCP and A2A.
- `search-project-content` finds saved rows, choices and addons with short excerpts
  and navigation links; `get-project-context` reads focused mechanics and text.
- `get-project-plan` and `update-planning-entry` preserve editorial drafts separately
  from live prose, with revision/baseline conflict checks.
- Viewer feedback uses actual clipped screenshots and expiring, access-checked
  capture receipts. Text-only models cannot inspect those images.
- Native sharing, checkpoints, review comments, notifications and active runs
  use the framework's existing permission and runtime contracts.
- Opt-in project-created and planning-status events support requested automations.
  No scheduled job or external-service account is configured automatically.
- Image-source actions support e621 and Derpibooru with attribution and scoped
  credentials. Other providers/connections remain available through Settings.
- Core database synchronization refreshes saved changes. Live CRDT form editing
  remains deferred; it must not introduce another uncontrolled document writer.

See the [integration audit](docs/agent-native-integration-audit.md) for the full
catalog, configured seams and deployment-dependent capabilities. DeepSeek's
existing context-catalog patch is tracked in `patches/`; retain it when installing
or upgrading the pinned Core package.

See [Publishing and Explorer](docs/publishing.md) for saved releases, public links,
withdrawal, ratings and agent actions. Owners publish from the project toolbar.

## Architecture and production

[Architecture](docs/architecture.md) describes feature ownership, shared contracts,
server services, dependency rules and the conditional write boundary.
[Development](DEVELOPING.md) explains where to make changes.
[Production operations](docs/production.md) covers persistent SQL/blob storage,
stable auth/encryption secrets, startup, backups and legacy ownership recovery.

Every document writer now saves against the version it read. A conflicting write
fails explicitly, and settings metadata/document changes commit together. This
protects overlapping server edits; it does not claim automatic merging of stale
editor forms or a CRDT collaboration lifecycle.

Production requires an explicitly configured persistent database and durable
uploads. Startup never assigns legacy unowned projects to the first account;
recovery belongs to an administrator who has verified the correct ownership.
