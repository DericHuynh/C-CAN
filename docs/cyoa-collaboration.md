# CYOA collaboration

Implemented against Agent Native Core 0.178.1 and Toolkit 0.19.7. The integration
combines the framework's [Yjs transport and structured-document actions](https://www.agent-native.com/docs/real-time-collaboration/).

## Live editing

Existing content fields publish edits immediately to the project's shared Y.Doc.
Strings use Y.Text, including text nested inside addons and requirements. Objects
use field maps; collections retain stable entity IDs. Deterministic seed updates
prevent two simultaneous first opens from duplicating the initial text. After local typing, selections
in active text inputs stay attached to shared characters across remote updates.

`useSavedField` binds editor controls to explicit entity/field paths. Rows,
choices, points, groups, images, requirements, words, variables, sound effects,
design groups, settings, styles and inline prose share this path. Authoring viewer
adapters render the draft with structural sharing; public releases use their
published snapshots. Opening a read-only viewer does not initiate autosaves. Reopening as an editor
resumes pending drafts recovered from the collaboration store.

Local edits to existing fields autosave through `save-live-project-fields` after
300 ms of quiet, with a 1-second maximum batching delay while typing. Inline blur/Escape exits immediately once text is shared. Network and
SQL work run in the background; neither gates local rendering or Yjs delivery.
Saves serialize, retain newer keystrokes during an in-flight request, and return
compact field results instead of downloading the whole project. A quiet-period
refresh reconciles revision, summary and normalization after typing settles.
Navigation flushes pending field saves; Core flushes its Yjs batch on pagehide.

The action checks editor access, validates targets and value types, and applies
one atomic baseline-checked batch through the project repository. Disjoint edits
merge; conflicting agent snapshots remain available for explicit review. A late
response cannot replace newer cached peer fields. Identity changes, new records,
category type changes and incomplete/unsupported compound input still use the
explicit Add/Save action. The footer offers Close because live edits already
persist; Shift+S applies all remaining form fields.

## Transport and persistence

`LiveProjectFields` shares Core's ref-counted connection with `ProjectPresence`.
There is one Y.Doc and awareness connection per project/tab. Core coalesces local
updates at approximately 80 ms and sends them over its resource-scoped SSE/poll
transport. Remote delivery depends on network and hosting latency; it is not a
promise of zero network delay.

The pinned Core patch retains failed Yjs batches, retries with capped backoff,
and emits a small update-status browser event for the toolbar. The UI reports
pending changes and offers Retry save for failed action persistence. A confirmed
Yjs write preserves the shared draft independently of the full project snapshot.
Closing/reloading while disconnected is not guaranteed offline persistence.

The room contains only fields being edited, not the complete imported App JSON.
Acknowledgements reuse the same shared text rather than creating another text
copy on every autosave. Binary data URLs and fields larger than 256 KiB remain
local until their normal explicit action; media continues through blob storage.

## Presence and access

The registered `project` resource governs `cyoa:<id>` collaboration rooms. Reads
and awareness require viewer access, writes require editor access. `autoSeed:
false` prevents automatically copying full projects/media into collaboration
storage. Core presence and collaborator-avatar navigation work across tabs and
modes. Agent actions continue using granular project writes and resource-scoped
save events; snapshots already observed in the live stream are acknowledged
without replacing the live text. Clean external agent replacements are applied
by Core's elected reconcile leader before further typing. `get-project` returns
a lightweight `canEdit` capability; read-only peers publish
`canFlushDocument: false` and cannot become the leader. Overlapping agent content
is reconciled by the existing draft-conflict UI.

## Verification

Tests cover simultaneous first-keystroke merging, nested addon text, retained
keystrokes during saves, stable storage across repeated acknowledgements, valid
numeric drafts, media exclusion, atomic field batches, stale baselines, deleted
targets and editor permissions. Existing editor, viewer and collaboration tests
remain part of the full check.

An isolated PGlite browser check with two separate accounts verifies live form
and viewer updates before pressing Save, background autosave, failed-request
recovery, explicit saves, and inline editing that stays open while broadcasting.
No user project is used as a test fixture. Fully offline editing, remote cursor
labels, shared rich-text formatting and collaborative undo are not claimed.

Final validation: 938 tests passed across 61 files (four workers), plus TypeScript
checks. The final browser pass also verified simultaneous typing after an agent
replacement and read-only viewers receiving updates without issuing writes.
