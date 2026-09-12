# C-CAN development

Read `AGENTS.md` for domain/agent behavior, [architecture](docs/architecture.md)
for module boundaries, and [production operations](docs/production.md) for runtime
configuration. Historical changelog/audit files explain prior decisions; the
architecture document is the current source map.

## Stack and entry points

The application uses Agent Native Core 0.178.1, Toolkit 0.19.7, React 19.3, React Router 8.3
framework mode, Vite, Tailwind and Nitro. Keep the pinned framework patch and
lockfile together. Use Node 24.15+ (or 22.22.2+) and pnpm 12.4.1.
See [dependency upgrade notes](docs/dependency-upgrade.md) for the SQLite-to-PGlite migration. Consult the installed Core documentation before changing a
framework integration; public documentation may describe a later API.

Routes render an SSR shell and obtain normal app data through client action
hooks. Keep public metadata/SEO loaders separate from ordinary project reads.
The framework owns the chat runtime, authentication, action transport and SQL
change synchronization. Compose its public APIs rather than copying internals.

Vite scans all browser app modules, including lazy routes and editor panels,
before serving dependencies. The optimizer also includes Toolkit's lazy chat
and UI subpaths. Keep this coverage when adding pages: late dependency discovery
can rebuild shared chunks and reload the document during navigation. Verify
first visits with a fresh Vite cache, not only an already-warmed dev server.
Place lazy panel loading boundaries inside their tab controls so navigation
remains available while content loads.

Keep the signed-in session gate stable across public/private routes. Changing
the gate's component tree remounts the shell and can discard a menu or navigation
interaction in progress. Project modes use route links, including the currently
selected mode, so another click can cancel a slow pending mode change.

## Where to make a change

| Concern                             | Start here                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| URL or page composition             | `app/routes/`, `app/features/projects/ProjectPage.tsx`                                 |
| Editor tab                          | `app/features/editor/EditorPanels.tsx`, `editor-tabs.ts`, then the relevant panel      |
| Viewer layout                       | `app/features/viewer/CyoaViewer.tsx`, `RowView.tsx`, `ChoiceView.tsx`, `AddonView.tsx` |
| Points/requirements rendering       | Viewer `Scores.tsx`, `Requirements.tsx`; use the shared engine for semantics           |
| Player state/build lifecycle        | `app/features/viewer/use-cyoa.ts`                                                      |
| Audio lifecycle                     | `app/features/viewer/useViewerAudio.ts`                                                |
| UI data access                      | `app/features/projects/use-projects.ts`                                                |
| API operation                       | Existing `actions/<verb>-<resource>.ts`                                                |
| Authorized document persistence     | `server/projects/repository.ts`                                                        |
| List/search SQL and response shapes | `server/projects/queries.ts`, `presentation.ts`                                        |
| Import/migration/gameplay rules     | `shared/cyoa.ts`, `shared/cyoa-engine.ts`                                              |
| Blob/image/provider handling        | `server/storage/`, `server/media/`, `server/integrations/`                             |
| Startup/framework registration      | `server/plugins/`                                                                      |

Reuse existing actions before adding one. Action names and input/result shapes
are public contracts across UI, chat and external clients. Ordinary data belongs
in actions, not duplicate REST routes. Route-only uploads and binary responses
remain under `server/routes/`.

## Making a document mutation

1. Validate input with the action's schema and pass the action's caller context
   into `getProjectOrThrow(projectId, ctx, "editor")`.
2. Apply the requested domain change to the normalized document.
3. Call `saveProject(projectId, app, row.json)` with that read's stored JSON.
   Optional metadata is persisted in the same conditional update.
4. Publish post-save feedback/events only after successful persistence.

The repository externalizes embedded media before writing SQL. Preserve unknown
ICCPlus fields. If remote processing takes time, read the latest document, merge
only the intended results, and save against that latest read. A conflict requires
fresh context and reconciliation, never an automatic retry with a newer baseline.

Actions must not import SQL tables/connections. Repository functions are internal
server APIs; callers perform the documented access check. Startup plugins
compose services; services must not import plugins or action entry points.

## Client contracts and code loading

Use Core's `useActionQuery("name")` and `useActionMutation("name")` through the
project hooks. `.generated/action-types.d.ts` infers result and parameter types
from action definitions. Do not replace that inference with a loose generic
result or import action runtime code into the browser. Stable project result
shapes live in `shared/project-contracts.ts` and are built by the server projection.

Keep viewer gameplay independent of authoring panels. Visual editing passes
callbacks and the types in `viewer/types.ts` to the same renderer. Heavy editor
panels and project modes use lazy imports with a visible loading boundary.
Keep selection and tab/mode state in canonical URLs so browser and agent
navigation continue to agree.

## Checks

```bash
pnpm check
pnpm build
pnpm script roundtrip-check
```

`pnpm check` runs typechecking, all unit/regression tests and Doctor. The types
include actions and tests explicitly; type generation must not be the only reason
an action gets checked. Architecture tests reject forbidden imports and cycles.
Concurrency tests use a disposable in-memory PGlite connection, not `data/app.db`.

For import or storage changes, also run `pnpm script e2e-import-check` against
local/isolated data. Browser verification should create a disposable project
through actions and delete it afterward. Existing helper scripts that take
`--project-id` must receive a disposable copy, never an author's real project.

Format changed files with `pnpm exec vp fmt <paths>`. Keep generated types, large
example JSON, runtime data, secrets and build artifacts out of formatting runs.
The CI workflow performs source checks and a production build without deployment
or paid AI calls. Provider authentication and hosting still need staging checks.

### Script discovery and maintenance CLIs

Agent Native imports modules in `scripts/` while discovering tools. These files
must export a callable entry point; importing them must not execute a workflow,
mutate data, or close the shared database. `tests/script-discovery.spec.ts`
checks that discovery is safe.

Standalone migration/import entry points live in `tools/cli/` and run only through
`pnpm db:migrate` and `pnpm db:import-sqlite`. Historical manual audit helpers live
in `tools/manual/`, outside discovery. They are not application tools.
