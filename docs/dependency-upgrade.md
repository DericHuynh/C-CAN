# September 2026 dependency upgrade

All direct dependencies and Vite catalogs were checked against the npm registry's
latest releases; compatible transitive dependencies were refreshed too. The toolchain
is pnpm 12.4.1, React 19.3, React Router 8.3.1, Vite 8.3, Vite Plus 0.3.1,
Agent Native Core 0.178.1 and Toolkit 0.19.7. The Node engine range reflects
isomorphic-dompurify 4's requirements: `^22.22.2 || ^24.15.0 || >=26.0.0`.

The DeepSeek context-window patch is rebased onto Core 0.178.1. The same pinned
patch now retains/retries failed collaborative update batches and reports their
status to the live-edit toolbar. Yjs 13.6.32 and y-protocols 1.0.7 are explicit
browser dependencies for the field editor. Framework-required
`nf3` and Assistant UI constraints remain aligned with Core. Two narrow peer
exceptions permit the already-used TypeScript 7 compiler with Core's pinned
i18next packages; typechecking, translation tests and browser checks cover them.
The scaffold metadata in package.json records the original template provenance.

Targeted overrides also update vulnerable transitive Anthropic SDK, Tiptap,
PDF.js and UUID versions. SheetJS 0.20.3 is vendored from its official release
CDN because npm still serves 0.18.5; see [vendor provenance](../vendor/README.md).
The dependency audit reports no known vulnerabilities with these overrides.

## Existing SQLite installations

Core now uses PostgreSQL schemas and removes the SQLite/libSQL runtime driver.
Local development uses PGlite; production requires persistent PostgreSQL.
Do not point the new runtime at an old `file:` or `libsql:` URL, or assume a new
empty local database has imported your projects.

Stop writers to the old database and preserve the database, uploads, and original
signing/encryption secrets. To make a separate local copy:

```bash
pnpm db:import-sqlite --source data/app.db --target data/pglite-upgraded
```

The target directory must not exist. The source is opened read-only inside a
consistent snapshot. The command initializes the new framework/app schema,
copies compatible rows in dependency order, converts boolean/timestamp values,
and verifies archival row counts. The copy runs in one transaction; errors roll
back the entire copy. A failed attempt leaves an initialized but unimported target;
retry with another new directory after resolving the reported incompatibility.

Every source table and column also survives in a private `legacy_sqlite` schema,
including retired columns and old migration journals. Old tool-deduplication
cache entries are archived only: their keys can exceed PostgreSQL index limits,
and pre-upgrade in-flight tool calls must not be revived. The new framework's
migration journals are kept instead of overwriting them with SQLite versions.
The `sqlite-import.json` manifest contains table/row counts and archived-only
columns, never record values. Review it for retired data before switching.

After checking the copy, set `DATABASE_URL=pglite:./data/pglite-upgraded` in the
local environment and restart. Keep the original secret values and upload paths;
copying database rows does not copy files or rotate encryption keys. Preserve the
SQLite source as a rollback copy. Changes made after switching belong to PGlite.

For hosted PostgreSQL, run `pnpm db:migrate` in the release environment before
starting request workers. It applies both the framework and C-CAN migrations.
The SQLite import command deliberately accepts only a fresh local destination;
it cannot overwrite an existing hosted database.

## Other compatibility changes

- Cropper.js 2 uses custom elements and asynchronous canvas export. The viewer's
  adapter retains source-pixel scaling, aspect ratios, positioning, rotation,
  reset, CORS-enabled image loading and cleanup. See the
  [upstream migration guide](https://fengyuanchen.github.io/cropperjs/migration.html).
- The database stores `is_seed` as its existing integer format; actions continue
  exposing a boolean. Persistence regression tests now use PGlite's PostgreSQL
  engine, matching the framework.
- `pnpm check` explicitly invokes `pnpm run doctor`, avoiding pnpm's own command
  with the same name.

Verification: frozen-lockfile installation, typecheck, tests, Doctor, production
build, and desktop/mobile browser checks. Missing deployment secrets/database URLs
are configuration diagnostics, not proof of deployment readiness.
