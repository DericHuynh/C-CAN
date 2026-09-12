# DX and UX review — 2026-09-11

Reviewed the app in Chromium at 1440 × 1000 and 390 × 844 using a local test account and scratch project. This was a route, layout, empty/error-state, and selected-interaction review, not a full end-to-end test of every framework setting or external integration.

## Page coverage

| Page                                                    | Review and changes                                                                                                                                                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chat `/` and `/chat/:threadId`                          | Reviewed the home and missing-thread state. Replaced starter metadata, hero copy, and suggestions with CYOA authoring guidance. Provider connection is still required to send chat messages.                                                                             |
| Projects `/projects`                                    | Reviewed empty and populated libraries. New-project buttons now show pending state and prevent repeated clicks. Cards wrap their actions on narrow screens; duplicate is disabled while pending. Signed-out library visitors go to sign-in.                              |
| Editor `/projects/:id`                                  | Opened all 19 tabs at both widths. URL changes drive the active tab and section; modes preserve query parameters. A duplicate pointer/focus event is guarded to avoid duplicate history entries. The toolbar wraps, and the master/detail columns share available width. |
| Visual editor `?mode=veditor`                           | Opened at both widths. The mode label now reads “Visual editor”; shared editor save controls remain visible while scrolling long forms.                                                                                                                                  |
| Viewer `?mode=viewer`                                   | Opened at both widths. Mode transitions retain the selected editor tab. Sharing URLs now include the configured application base path.                                                                                                                                   |
| Settings `/settings`                                    | Reviewed General, Account, Connections, Organization, Workspace, and What's new. Navigation state now correctly reports Settings and preserves its URL anchor.                                                                                                           |
| Team `/team`                                            | Confirmed the redirect to the Organization settings section.                                                                                                                                                                                                             |
| Agent `/agent`                                          | Reviewed desktop and mobile resource/operations navigation and the Files empty state. No agent execution or integration credentials were exercised.                                                                                                                      |
| Database `/database`                                    | Reviewed the table browser at both widths. No database records were edited through this administrative page.                                                                                                                                                             |
| Observability `/observability`                          | Reviewed all five tabs. Fixed the tab strip overflowing the phone viewport.                                                                                                                                                                                              |
| Extensions `/extensions`                                | Replaced the redirect to a nonexistent Settings tab with the framework's public extension list component.                                                                                                                                                                |
| Extension `/extensions/:id` and `/extensions/:id/:slug` | Reviewed missing-extension links. The framework eventually renders a useful unavailable state, but its retry policy leaves a nearly blank skeleton for roughly 15–20 seconds. This delay remains a framework follow-up.                                                  |
| Sign-in                                                 | Used the create-account flow; corrected README instructions that incorrectly promised automatic local sign-in.                                                                                                                                                           |

Editor tabs covered: Rows, Points, Groups, Images, Requirements, Variables, Words, Design Groups, Categories, Backpack, Design, Templates, Sound Effects, Viewer Config, Custom CSS, Stats, ID List, Settings, and JSON.

## Shared fixes

- Enabled browser pinch zoom and used dynamic viewport height for the shell.
- Replaced the command palette's no-op Search item with working page destinations.
- Exposed project id, mode, tab, and complete URL to the agent navigation state; added project navigation commands.
- Fixed new groups silently discarding selected row/choice memberships. The UI and `add-group` action now accept the same initial membership fields.
- Kept import controls and dismissal locked while a file is being read or imported; removed a success toast that fired before the server had accepted the import.
- Removed implementation chatter from editor helper text.
- Corrected developer documentation for viewer URLs, group semantics, local sign-in, and image-resource export compatibility.

## Verification

- 662 tests passed across 14 files, including 15 new navigation and group regression cases.
- Typechecking and formatting passed.
- Browser interaction checks passed for new-group membership persistence, mode/query preservation, single-step Back navigation, command palette navigation, new-project creation, and import pending/error feedback.
- Formatting uses lazy plugin loading so reading formatter configuration does not start the application server.
- Unit tests no longer start Nitro, authentication, MCP clients, or the React Router HMR runtime. The full suite now completes in roughly 1–2 seconds without the prior shutdown timeout and unrelated server errors.
- All 19 editor tabs and both preview modes loaded without page errors in the completed mobile pass; neither the page nor main content overflowed horizontally. Observability's five tabs also fit the 390px viewport after the fix.
- One transient development-module fetch failure recovered during hot reload. No production build, paid AI calls, messaging sends, or deployments were performed.

Local screenshots and browser traces are in `/tmp/c-can-ux-audit/`; they are not committed and are not required to run the unit tests.

## Editor workflow follow-up

- New rows and choices open immediately for editing, clear conflicting filters, and reveal the correct page and branch.
- Search includes row/choice/addon ids, titles, and descriptions. Clear-search controls recover from empty results. Row badges and drag destinations keep their document positions while filtering.
- Tree titles are native keyboard-operable buttons. Add/delete controls stay visible, and empty rows offer an explicit Add choice button. Addon selections carry their exact index.
- Shared forms support Ctrl/Command+S, announce busy state, and keep Save visible by sizing desktop forms to the remaining viewport. On narrow screens, opening a form reveals and focuses it; closing it returns focus to its opener.
- Deleting a row, choice, or addon clears dependent stale forms instead of leaving deleted content editable.

Verified with an isolated 24-row project on desktop and at 390px width: creation across page boundaries, row-id/addon search, keyboard editing/saving, visible desktop Save, mobile form reveal, and focus restoration. Scratch projects were deleted after each browser run.
