# C-CAN / ICC-Plus viewer comparison

Compared the local `ICC-Plus-Svelte/ICCPlus_Viewer` implementation with C-CAN's
renderer, selection engine, browser build storage, and JSON/ZIP import path.
This records the corrected behavior and verification coverage; it is not a
claim of pixel-identical rendering for every possible author stylesheet.

## Corrected differences

| Area | Behavior now covered |
| --- | --- |
| JSON import | Shared UI/action validation, BOM handling, useful rejection of non-document JSON, null-safe known collections, preserved extension fields, non-mutating and repeatable legacy migration. |
| Legacy projects | Private style flags inferred where needed; nested OR requirements migrated in choices, selectable-addon scores, and image variants; old radius migration runs once. |
| ZIP import | Prefer `project.json`, resolve assets relative to nested project directories, reject ambiguous JSON entries, support AVIF, and inline referenced image resources. |
| Media persistence | Deduplicate/externalize images in rows, choices, addons, variants, point icons, backgrounds, borders, private styles, design groups, backpack and loading-screen settings. Embedded sound effects also use blob storage. |
| Selection and points | Enforce nonnegative currencies for both spending and removing spent grants. Preserve forced/one-time selections at row limits. Respect excluded row counts, automatic-choice requirements, linked effects, configured words, and cleanup after displaced selections. |
| Multiple selection | Support negative counts through zero, locked decrement behavior, parent/addon counters, and independently gated scores per selected copy. Save/load preserves those gates. |
| Layout and styling | Apply side/bottom templates, authored image and image-box widths, addon widths/alignment/style, shared row templates, natural card height, disabled borders, transparent backgrounds, and half-width rows. Preserve ICCPlus choice CSS classes. |
| Results and groups | Use the displaying row's layout and title settings while keeping mutations attached to the source choice. Show selected addons in results and honor read-only/deselection settings. |
| Effects | Resolve image resources for borders/backgrounds; load author fonts; play externalized audio; avoid replaying existing music/scroll/fade effects on unrelated selections. Honor fade durations. |
| Reader settings | Project-scoped browser preferences for responsive columns, breakpoint, templates, half rows, autosave, preloading, result deselection, PNG splitting, music controls, crop position and backpack width. Changing preferences preserves play state and the author document. |
| Player image choices | Local file/URL selection, crop, aspect ratio, rotation, scale and quality using the same Cropper major version as ICCPlus. Images can be edited and are included in saved builds. Late uploads cannot restore deselected choices. |
| Backpack export | PNG download uses full-resolution images, exports the full scrollable content, splits tall images or scales one file, and reports failures. The dialog honors its configured width and its own responsive dimensions. |
| Build storage | Autosave uses minutes and the latest committed selection. Manual/autosave storage failures are surfaced while retaining the current build for download. |

New reader controls, image editing labels, and errors are translated in all
11 shipped locales. Existing UI labels outside this change retain their
previous localization coverage.

## Verification

- All 750 tests in 28 test files pass. The regression suite covers import/migration, engine behavior, hook
  interactions, rendering, image persistence, ZIP resolution and preferences.
- TypeScript checking and formatting cover the changed implementation.
- `agent-native script roundtrip-check` passes against the real 17 MB
  `examples/project.json`: no removed original keys, changed original values,
  or changed array lengths.
- `agent-native script e2e-import-check` passes: 27 rows, 150 choices and 108
  image resources; zero embedded image payloads, inline image references or
  dangling image references in the stored document.
- Chromium checks exercise the import UI, unaffordable choices, counter
  spending limits, addon parent selection, information rows, templates,
  half-width rows, reader preferences, local image cropping/rotation/editing,
  PNG download, desktop/mobile width, and runtime errors. Temporary imported
  test projects are deleted afterward. The exported PNG and crop dialog were
  visually inspected.

The original Svelte viewer was compared at source level, not run as a second
browser session. External YouTube playback and arbitrary third-party font or
image hosts were not exhaustively exercised. Remote images still depend on
availability and cross-origin permissions for canvas cropping/export; failures
are reported in the player.

## Format boundaries

C-CAN imports legacy ICCPlus project documents, then translates their images
into its resource collection. Exported C-CAN projects retain that resource-ID
format and are not promised to reopen in the original ICCPlus editor (the
repository's existing compatibility contract).

ICCPlus build codes remain accepted. C-CAN adds optional per-copy score-gate
snapshots (`/SA#index:0|1:count`) when necessary to preserve the saved score
state; those extensions are for C-CAN's loader.
