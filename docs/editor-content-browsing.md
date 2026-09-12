# Editor content browsing

Rows, points, groups, images, requirements, variables and words share search,
filter and sort controls. Search matches names, IDs and prose, including nested
choice/addon text in rows and replacement text in words. Quotes match exact
phrases; `-word` excludes a term; `tag:name` matches a tag. Unquoted words tolerate
missing characters and small typos. Numeric terms stay exact. Sorting/filtering
changes the displayed list, never document ordering or mutation indexes.

Image pickers in row, choice, addon and variant editors show thumbnails and full
previews. Requirement target pickers show parent sections, prose, images and
requirement counts, and can filter by section/group and content type. These
pickers build their indexes only while open. Pickers and the Images grid use
`VirtualList`, mounting only viewport rows plus overscan. Embedded previews (up to 8 KiB including the data URL) are preferred to decoding
every full image. Encoding tries original pixels first and reduces resolution only
when needed to fit the budget; original dimensions reserve the same viewer layout.
Generate / upgrade previews refreshes old 24×24 previews, retaining usable old
previews if the source is temporarily unavailable.

Create image accepts a URL or uploaded file, optional name and tags. An omitted
name creates an anonymous resource. For existing rows, choices and addons,
`add-image.target` creates the resource and attaches it in one CAS document save.
It validates the target and expected prior image before and after media upload.
New unsaved items and image variants receive the resource ID in their draft;
saving the containing editor persists the reference. Media still goes through
blob externalization and preview generation. Creating a resource is persistent,
even if a containing draft is later cancelled.

New image resources record created/updated dates, including source imports.
Legacy images without dates remain undated: date filters exclude them and added
sorting falls back to document order. Dates are not fabricated during import.

The visual editor plays choices on click; top-right edit, move up/down and delete buttons stay visible.
Double-clicking text edits inline, cancelling a pending gameplay click. Counters,
selectable addons and the player menu work directly in the visual editor.
Viewer screenshot review lives in the bottom-right menu. `ViewerNavigator` stays
mounted without a visible header to service agent navigation, observations and
capture requests; removing its UI must not remove that bridge.
