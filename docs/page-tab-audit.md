# Page and tab audit — September 12, 2026

The audit used Chromium at 1440px and 390px widths, an isolated PGlite database,
and disposable accounts/projects. The user's local project database was not
used for test writes.

## Fixes

- Registered `/settings/*` so the upgraded Core's Settings links, including
  `/settings/agent/resources` and `/settings/agent/automations`, resolve to the
  Settings page. Updated Team navigation and agent-visible route classification.
- Removed the obsolete Agent page compatibility wrapper; use Core's supported
  `AgentTabsPage` directly. Migrated deprecated MCP/agent-tool configuration to
  the current grouped options and central app identity.
- Removed executable maintenance helpers from automatic script discovery.
  Migration/import CLIs now live in `tools/cli/`, historical manual helpers in
  `tools/manual/`. Importing the old helpers could run migrations, create audit
  content, and close the live database. Removed the obsolete browser helper
  containing a machine-specific dependency path and embedded login.
- Fixed demo seeding on fresh PostgreSQL/PGlite tables without timestamp defaults.
- Backpack Delete now opens a confirmation. Reordering follows displayed order
  and writes indices; deleting reindexes survivors. Success messages and dialog
  dismissal wait for a successful save, and pending writes disable controls.
- JSON preview/copy/download now follow the current saved project query instead
  of retaining the first export response indefinitely.
- Keyed the editor provider by project ID so forms and player state cannot carry
  over into a different project.
- Word/variable creation trims IDs and rejects duplicates. Existing IDs and
  category types remain stable during ordinary edits to avoid breaking references.
  Deleting selected items closes their editors.
- Sidebar preference hydration no longer writes the default over stored state
  before reading the user's preference.

## Browser coverage

156 page/tab observations completed with no browser exceptions, failed tab
clicks, or horizontal overflow of the page/main container. All 21 editor tabs
were traversed on desktop and mobile. Desktop editor tab changes caused zero
full-document reloads.

| Surface                     | Coverage                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| Project editor              | Content, Design, Viewer and Project groups; all 21 tabs            |
| Viewer / visual editor      | Desktop and mobile rendering and mode links                        |
| Projects                    | List and links; missing-project error state                        |
| Explorer / published player | Listing, release details and playable snapshot                     |
| Settings                    | All 12 tabs, nested agent paths, MCP host instructions, Team alias |
| Agent                       | All 12 tabs and MCP host instructions                              |
| Database                    | Table Editor and SQL Editor; mobile shell                          |
| Observability               | Overview, Conversations, Evals, Experiments, Feedback              |
| Extensions                  | List, creation entry and missing-extension state                   |
| Chat                        | Home and provider setup entry                                      |

Backpack move/delete were checked against freshly read saved documents. An
external action updated the open JSON tab without remounting it. All eight
style-template buttons were verified after loading on desktop and mobile. Signed-out
release details/play loaded successfully; fullscreen hid the player toolbar, and
the bottom-right Menu → Exit fullscreen restored it.

These are navigation, rendering and selected mutation checks. Provider-backed
chat generation, external OAuth connections, remote MCP/A2A execution and
agent-generated extension contents require configured services and were not
executed. Empty histories/analytics are not substitutes for populated-data tests.

## Automated validation

- 896 tests passed across 55 files, including new editor, script-discovery and
  fresh-database seeding regressions.
- Typecheck passed.
- Agent Native Doctor: ten guards, no findings.
- Production build passed. Existing deployment requirements still apply:
  a configured signing secret and persistent remote database.

## Second pass: editing and saved-state behavior

A further interaction audit on September 12 found and fixed:

- **Custom CSS:** opening the editor no longer applies the story's CSS to the
  editing controls. Failed Clear requests retain the draft; text typed while a
  Clear request is pending also survives its completion.
- **Saved settings:** untouched metadata, viewer settings and styling now follow
  saved updates. Locally edited fields survive refetches. Saving the viewer title
  sends just that field instead of an unnecessary full config copy.
- **Color fidelity:** saving an unrelated viewer setting preserves eight-digit
  hex and other existing CSS colors. RGB pickers preserve existing hex opacity;
  all viewer colors now share the full-value text controls used by Design.
- **Ratings:** drafts are isolated by publication and account, and rating inputs
  are disabled while saving. Switching between unrated releases cannot carry a
  draft ballot into the next release.
- **Explorer:** malformed URL fields no longer reset valid search, tag or content
  filters. Clear also clears search text that has not been submitted. Agent
  navigation context uses the same filter parser, including the current page.
- **Categories:** removing a category clears assignments in its corresponding
  collections in the same action save. Reusing the slot cannot unexpectedly
  regroup old items. Other category types with the same number are preserved.
- **Sound effects and groups:** duplicate sound-effect IDs are rejected; existing
  IDs stay stable during edits. Deleting a selected group closes its form.

Repeated all 156 desktop/mobile page and tab observations: no browser errors,
failed navigation checks or page/main horizontal overflow. Additional browser
checks verified CSS isolation, a simulated failed save, local drafts combined
with remote updates, preserved color alpha, group/category deletion, malformed
Explorer URLs and clearing unsubmitted search text. A second account saved a
mobile ballot with overall **0** and writing **5**; overall remained independent.

Validation: **905 tests across 56 files passed**, plus the final 11 editor
regression tests after tightening Clear's pending-request behavior. Typecheck,
Doctor and the production build passed. The external-service limitations above
still apply.
