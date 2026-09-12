# Maintenance tools

`cli/` contains standalone database maintenance entry points. Run them with
`pnpm db:migrate` or `pnpm db:import-sqlite`; they own their process and database
lifecycle. They must stay outside Agent Native's automatically discovered
`scripts/` directory.

`manual/` preserves historical, explicitly invoked audit helpers. They are not
registered agent tools. Check their fixture IDs and use a disposable database
before running them. The obsolete browser helper with a machine-specific
Playwright path and embedded login has been removed.

Callable agent/CLI workflows belong in `scripts/` and export a function without
running it during module import. The discovery regression tests enforce this
boundary.
