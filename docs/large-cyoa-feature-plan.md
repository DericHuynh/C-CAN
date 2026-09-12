# Feature plan for large interactive CYOAs

Status: roadmap with a first implementation of linked document planning. Content → Plan now provides a searchable row/choice/addon outline, rich-text/source drafting, editorial and image status, author/mechanics/art notes, source links, save/recovery, explicit text application, conflict checks, and contextual editor/viewer/image links. It does not import Word files or implement the full roadmap below.

The second author reference is a Word outline with IDs, requirements, costs, prose, conditional addons, unknown image status, and candidate source links. The implemented Plan workspace keeps these together around the corresponding CYOA entity. Only the selected prose editor and a bounded outline page are mounted. The project route still loads the full document; scoped frontend document fetching and deeply nested author-defined folders remain future work. The planning action supports bounded outline reads and single-entry drafts for agent use.

## Design scale

The supplied screenshot reports 2,206,229 characters, 2,966 choices, 2,873 images, and 371 rows. Use those counts as the baseline for a Sleeper's Dream-sized project. The actual project document, dependency structure, and total asset bytes were not supplied, so this plan does not assume their contents or claim measured performance on that project.

The primary authoring questions are:

1. What am I building, and what remains unfinished?
2. Where is the content or rule I need to change?
3. What depends on it, and what will this change affect?
4. Can I make and review a large change without losing work?
5. Does the intended player experience still work?

Prioritize organization and writing first, then dependency inspection and controlled project-wide changes. All proposed AI assistance should be optional; the editor must support these workflows without a provider key.

## What the current project provides

| Foundation                                              | Gap at this scale                                                                                                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paginated Rows tree, text/ID/addon search, entity forms | Pagination bounds rendered rows, but the editor still receives the full document. There is no durable writing plan or saved cross-project-content query. |
| `get-project-summary`                                   | Omits bodies, but returns every row and choice and only extracts top-level requirement IDs. It is not a complete dependency index.                       |
| Groups, categories, design groups                       | These have existing domain meanings. None should be repurposed as an authoring folder or completion status.                                              |
| Bulk add actions and `patch-app-document`               | Whole-array replacements require carrying unchanged content and do not offer an author-facing impact preview.                                            |
| Resource history and review registrations               | Useful integration points, but not evidence of per-edit undo, entity-level review anchors, or safe concurrent merges.                                    |
| Collaboration plugin                                    | Its source explicitly notes that the form editor has no collaborative client and that action/collaboration writes can overwrite each other.              |
| Image resources and blob uploads                        | Asset planning still needs usage indexes, real size metadata, thumbnails, and review queues.                                                             |
| Project statistics                                      | Counts do not express completion or readiness. Current image ranking treats remote references as zero bytes; string length is not a useful size metric.  |

Relevant source: `app/hooks/use-projects.ts`, `actions/get-project-summary.ts`, `actions/_project-store.ts`, `actions/patch-app-document.ts`, `server/plugins/project-resources.ts`, `server/plugins/collab.ts`, and `app/components/projects/ProjectStatsPanel.tsx`.

## 1. A plan connected to the actual CYOA

Add a **Plan** tab to the existing Project section first, with a direct link and command-palette destination. Use the existing master/detail layout: an authoring outline and work list on the left, the selected brief or content on the right. Keep the agent sidebar optional. Avoid adding a permanently visible fourth pane.

Planning features:

- **Authoring sections:** nested folders such as Origins, Powers, Companions, and Endings. These are illustrative names, not assumptions about the example. Folder organization is independent of player-facing row order and gameplay groups.
- **Content briefs:** create an idea before creating a playable choice. Give it a purpose, notes, acceptance checklist, intended section, priority, and optional links to existing content. Converting a brief to a row or choice preserves its notes and checklist.
- **Writing status:** Idea, Draft, Needs review, Ready, and Deferred. Treat Blocked as a separate flag with a reason and links to prerequisites. A status change alone does not remove or enable player content.
- **Separate planning and gameplay dependencies:** “Finish the companion brief before proofreading this ending” is a task dependency; “Select a companion to unlock this ending” is a player requirement. Label and store them separately.
- **Milestones:** assemble a release scope from briefs and existing entities; show unresolved work, review progress, and outstanding checks. Shared notes and checklists belong to the project; private bookmarks and saved views belong to the user.
- **Saved work lists:** “unwritten descriptions,” “ready for proofreading,” “missing art,” “changed since last release,” and “blocked work in this section.” Show counts and snippets, with a direct jump to the exact entity.

Example workflow: create a brief for a new companion, link the affected ending, write its choice in place, mark it ready for review, and include it in a milestone. The content stays linked throughout; authors do not maintain a separate spreadsheet of fragile titles.

First-release acceptance: an author can plan a section, turn a brief into a choice, leave and return to the same work list, and see the same state through chat actions. Importing or rearranging rows does not erase planning associations.

## 2. Fast navigation and focused writing

- **Search the whole project:** rows, choices, selectable addons, currencies, variables, words, requirements, and images. Combine text search with type, section, writing status, tags, and “used by” filters. Return bounded results with breadcrumbs, match snippets, IDs, and revision information.
- **Stable entity links:** links reopen the exact entity, field or accordion, and parent context. Recent items, bookmarks, and Back preserve the work list and scroll position.
- **Writing view:** give long descriptions a spacious text editor with find-in-text, formatting controls, local preview, word/character counts, and linked brief/checklist. Keep rules and styling in collapsible inspectors. Preserve existing rich text and unknown document fields.
- **Recoverable drafts:** preserve unfinished edits when changing tabs or entities. Show distinct Unsaved, Saving, Saved, Failed, and Conflict states. Restore drafts after interruption; do not claim success before the server accepts the revision.
- **Compare relevant content:** pin a small number of choices for side-by-side comparison, rather than opening dozens of editor panels. Show wording, costs, requirements, and differences.
- **Glossary and terminology checks:** connect world terms to the existing Words collection where applicable; flag inconsistent naming without automatically rewriting prose.

First-release acceptance: searching an addon ID returns its parent context and opens that addon. A long draft survives navigation and a simulated failed save. Typing and filtering do not wait on loading unrelated descriptions or images.

## 3. Dependency inspection and understandable diagnostics

Build one typed reference index shared by editor navigation, analysis, and agent reads. Include nested AND/OR requirements, global requirement expansion, selectable addons, point thresholds, groups, image variants, variables, and activate/deactivate effects. Support reverse references as well as forward references.

The primary interface is an inspector for the current entity:

- **Requires / Excludes / Changes / Used by**, each with clickable references.
- **Explain availability:** given a saved player state, explain which condition passes or fails, including the path through nested or global requirements.
- **Impact preview:** before renaming, moving, removing, or retargeting an entity, list affected content and distinguish structured links from plain-text mentions.
- **Project checks:** missing targets, dangling image references, contradictory conditions that can be proved, suspicious cycles, and effects that target removed content. Every finding includes a location, evidence, severity, and a proposed next step.

A graph is an optional local neighborhood view, initially one or two hops around a selection. A single diagram containing 3,000 choices should not be the main navigation surface.

Cycles are not automatically bugs. Static analysis cannot prove arbitrary dynamic content unreachable. Distinguish confirmed errors, warnings, and unresolved cases; availability explanations and regression checks must use the actual viewer semantics rather than an independent approximation.

Acceptance: deleting a currency previews scores on choices and addons, including backpack content. An OR requirement is explained as an OR condition. Unknown or dynamic behavior is reported as unresolved rather than “broken.”

## 4. Controlled bulk changes and useful history

- Select explicit entities or a frozen search result, then edit shared fields in bulk. Show mixed values clearly and preserve fields the author did not choose to change.
- Preview find/replace in prose with match counts, context, and scope. Keep structured ID renaming and reference retargeting as separate operations; do not use raw text replacement to rewrite graph references.
- Stage agent-generated changes as a reviewable change set with a purpose, exact target IDs, expected revision, changed fields, and before/after examples.
- Provide a readable diff, checkpoint, apply operation, and revision-aware reversal. Support applying a reviewed subset when the remaining operations are independent.
- Record edits from UI, chat, and other authorized action callers in the same history. The current agent-tool ledger alone is not a complete edit history.

Acceptance: previewing “adjust these 80 point costs” identifies the exact 80 choices. Applying the change is atomic, rejects an obsolete preview, and leaves unrelated descriptions, styles, and scores intact. Reversal does not overwrite newer edits.

## 5. Saved playtests and release readiness

- Save named builds or scenarios with selections, counter values, variables, rolls or random seed, and the document revision.
- Add expectations: a choice should be available/unavailable, a currency should have a specified total, or a result should appear.
- Run scenarios after relevant changes and show failures beside their affected entities. Explain the first meaningful difference from the baseline.
- Track test coverage by section and mechanic. Keep editorial readiness, validation findings, and scenario results as separate indicators.
- Freeze a release revision so a published viewer can remain stable while the next milestone is edited. Make release inclusion an explicit operation, not an accidental consequence of a Draft label.

Start with deterministic scenario replay. Exhaustive path exploration is not a prerequisite and should not be advertised as complete for a project with arbitrary interacting requirements and effects.

## 6. Asset planning at thousands of images

Show thumbnails, usage counts, referenced entities, source/attribution, dimensions, and byte size when known. Represent unavailable metadata as Unknown rather than zero. Distinguish unique resources from placements and storage size from initial viewer download size.

Provide missing-art, duplicate-asset, unused-resource, and oversized-image work lists. Replacing a resource previews every affected placement. Load visible thumbnails first; store derived thumbnails and uploaded files in configured blob storage and retain handles in SQL.

“Unused” should require a complete typed reference scan, including variants and settings. Do not automatically delete assets based on an incomplete scan or a transient remote URL failure.

## Technical foundation and integration

Keep the ICCPlus App JSON as the authoritative playable document in `projects`. Add provider-agnostic SQL tables for planning records, milestones, saved scenarios, and a rebuildable content/reference index. Planning metadata should not enter gameplay collections. Offer an explicit authoring backup containing planning metadata in addition to the existing playable-document export.

Establish stable identity for imported addons before attaching permanent notes and backlinks to them. Use existing IDs where present; define and test a migration for missing IDs. Array indexes alone are not durable identities. Define how planning links follow duplication and how deleted targets become visible orphaned work instead of silently disappearing.

Add an explicit revision and compare-and-swap at the shared save boundary. Every writer—including collaboration and restoration—must respect it. This is a prerequisite for trusting saved drafts, indexes, bulk previews, and concurrent editing. A collaboration server registration by itself does not solve lost updates.

The first content-query implementation can traverse a server-loaded document to establish the contract. It still needs measurement: smaller responses do not eliminate full-document parsing and serialization. Then add revision-keyed indexes, scoped entity reads, and cache invalidation; never expose stale results as current. Index rebuilds must support imports, restores, and whole-document patches.

Use a small action surface. Proposed contracts, to confirm during implementation:

| Capability                     | Action approach                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Search and filtered work lists | One paginated content-query action with typed filters and bounded snippets; extend structure-summary reads without breaking current consumers. |
| Focused content reads          | Scoped entity/field reads; keep full project/export reads available for intentional document operations.                                       |
| Planning records               | CRUD-style planning actions with field patches, not one action per status, checkbox, or label.                                                 |
| Dependency checks              | One analysis action scoped by entity/section/project and check types, with paginated findings and progress.                                    |
| Bulk changes                   | Stage, inspect, and apply a change set against an expected revision; reuse existing entity mutation validation.                                |
| Saved scenarios                | CRUD plus run, using the existing viewer engine and shared action transport.                                                                   |

Use existing history, review, notifications, and background-run integration points where their installed contracts fit. Keep new external-agent edits behind `ask_app`; opt read tools into the existing catalog deliberately. All records and derived queries inherit project access checks.

Application state should carry IDs and navigation only: project, entity, section, selected work list, milestone, and active inspector. AI context should contain the relevant brief, a bounded set of entities, dependency summaries, and outstanding decisions; fetch full text on demand. Do not routinely send millions of characters or thousands of image references to the model.

Every implemented feature must include the UI, shared actions, navigation state, and agent instructions. Add no app-data `/api/*` routes. Large generated reports, exports, and replay artifacts belong in blob storage with SQL references.

## Delivery order

| Stage                | Deliverable                                                                                                | Exit condition                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Foundation           | Representative scale fixture, revision protection, scoped read/query contracts                             | Two writers cannot silently overwrite each other; timings and payload sizes are recorded. |
| First usable release | Plan tab, briefs/sections/statuses, saved work lists, stable entity navigation, recoverable writing drafts | Plan → write → review a section without losing context or edits; UI/chat parity verified. |
| Second release       | Typed dependency index, availability explanations, actionable checks                                       | Representative nested, addon, group, and global requirements produce correct results.     |
| Third release        | Reviewed bulk changes, meaningful diffs, checkpoints/reversal                                              | A large edit is previewable, atomic, revision-checked, and recoverable.                   |
| Fourth release       | Saved scenarios, release milestones/snapshots, asset review queues                                         | Authors can evaluate a release against named tests and outstanding work.                  |

Begin the minimal asset inventory and “missing art” filter in the first usable release if art tracking is part of the planning workflow; advanced asset cleanup can follow later.

## Proposed scale checks

These are acceptance targets to validate on documented hardware, not existing performance claims or implementation time estimates.

- Baseline fixture: approximately 400 rows, 3,000 choices, 3,000 image resources, and at least 2.2 million text characters, with representative nested requirements and addons. Add a stress tier at roughly twice that scale and a single unusually large row.
- Warm search: p95 below 250 ms; opening a cached entity below 150 ms; no keystroke-triggered full-document render. Record cold-start time, save time, heap use, result bytes, and main-thread stalls separately.
- List results contain bounded summaries; opening one description does not download all descriptions or original images. Keep both row lists and unusually large choice lists bounded.
- Kill/reload during writing and fail a save: the unsaved draft remains recoverable and the UI does not report it as saved.
- Concurrent UI/agent edits, stale bulk previews, undo after subsequent edits, and stale-index reads get explicit, tested outcomes.
- Import/export and migrations retain unknown document fields and existing engine behavior. Run the existing example roundtrip/import checks when touching normalization or persisted document structure.
- Judge progress by completed briefs, reviewed content, resolved findings, and passing scenarios. The screenshot's 449-hour heuristic is not an implementation estimate or a reliable completion forecast.
