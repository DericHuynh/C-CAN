# Production operations

The supported baseline is a Node deployment of the built React Router/Nitro app,
with persistent SQL and blob storage. Follow the pinned Agent Native version's
deployment documentation for other providers/presets. This repository does not
provision a database, volume, object-storage account, domain or model provider.

## Build and run

Use Node 24.15+ and the pnpm version declared in `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm script roundtrip-check
pnpm build
pnpm db:migrate
pnpm start
```

The Node build runs `.output/server/index.mjs`. Deploy the complete generated
output and retain any external runtime dependencies required by the selected
Nitro preset. CI creates build-only credentials; they are never deployment keys.

## Runtime configuration

Start from `.env.example` for local setup and put real production values in the
deployment's secret/configuration service. Keep secrets out of Git, logs and
project documents.

| Setting                        | Production requirement                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                      | Public HTTPS origin for sign-in, callbacks and absolute links                                                         |
| `DATABASE_URL`                 | Persistent PostgreSQL URL; local PGlite is for development only                   |
| `BETTER_AUTH_SECRET`           | Stable secret retained across releases; Core's supported hosted root-secret configuration is an alternative           |
| `SECRETS_ENCRYPTION_KEY`       | Optional dedicated stable vault key; otherwise use Core's supported auth-secret fallback                              |
| `FILE_UPLOADS_DIR`             | For the shipped local provider, an absolute directory on a persistent mounted volume; local default is `data/uploads` |
| AI and integration credentials | Configure scoped credentials through Settings; ordinary CYOA editing does not need them                               |

Changing encryption/signing keys is a migration/rotation operation, not a routine
release step. Preserve access to the keys needed to decrypt existing secrets and
screenshot receipts. Without a production auth secret, Core keeps access locked. A successful build
can still report this missing runtime configuration; it does not establish that
an installation is ready to accept users.

The shipped upload provider serves stored files through
`/_agent-native/uploads/<key>`. Preserve those URLs when moving storage. For
replicated application instances, use storage available to every instance or
register a shared provider; independent local disks do not share uploaded assets.
Authored images are served as URL-addressable assets, not private project ACL
resources. Screenshot payloads retain their separate encrypted, expiring receipt
checks. Do not advertise private media URLs as access-controlled storage.

## Startup and existing data

Migrations are additive and named; keep their versions/names stable. Back up SQL
and blob storage together before upgrades. Agent Native 0.178.1 requires PostgreSQL;
see [dependency upgrade notes](dependency-upgrade.md) for copying existing SQLite data.
Run `pnpm db:migrate` against the deployment database before starting the new release.

Demo seeding runs only outside production. New development demos are public,
readable examples that users can duplicate into their own private projects.
Existing seeds/projects are not rewritten by this refactor.

Startup no longer assigns every NULL-owner project to the earliest user. Existing
owned projects retain their ownership and shares. If an installation has legacy
unowned private projects, an administrator must identify and verify their rightful
owner and organization, back up the data, and perform a scoped recovery. Never
bulk-claim all unowned documents for whichever account happened to sign up first.
There is deliberately no automatic claim or public recovery endpoint.

## Release verification and recovery

On an isolated staging project, verify sign-in, import, saved editing, history
restore, editor/visual-editor/viewer deep links, build save/load and image access.
Confirm private-project isolation with separate accounts and verify that a stale
document write returns a conflict. Use the app's normal actions; do not overwrite
a real project to run a browser check.

Keep a deployable previous build and a tested SQL/blob backup. A code rollback
does not roll back schema or document data. Use resource checkpoints for ordinary
project restores; use operational backups for installation recovery.

Hosted background runs, scheduled jobs, external MCP clients, third-party media
hosts and live model providers require separate runtime verification. Native
project events use the current in-process bus; they are not a durable outbox or
a cross-instance delivery guarantee. Do not enable automation jobs merely by
deploying the app.
