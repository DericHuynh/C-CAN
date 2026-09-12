# Publishing and the ICYOA Explorer

Open a saved project and choose **Publish**. Set a public title, creator name,
description, up to twelve tags, SFW/NSFW classification and an optional cover
from the project's saved images. **Publish publicly** creates the first release;
**Update release** replaces its snapshot at the same link and increments its
release number. Only the source project's owner can manage publication.

The private project keeps its sharing settings. Editing or saving it does not
update the released game. Planning drafts and notes are removed recursively from
public content; gameplay mechanics, authored media and other playable document
fields remain available to readers. Save editor changes before publishing.
Referenced media still needs durable hosting. A release is a snapshot of the
playable document, not a portable archive of externally hosted media.

The sidebar's **ICYOA Explorer** supports title, creator, tag and description
search with spelling tolerance, intersection of selected tags, SFW/NSFW/all
content filters, and relevance/newest/updated/rating sorts. Filters and pages
live in the URL, so links and browser navigation preserve them. SFW is the default.
A content label is supplied by the publisher; it is not automated moderation.

`/explorer/:id` contains details and reader ratings. `/play/:id` presents the
released game without the authoring shell, with a browser fullscreen button. Fullscreen hides the player header; choose
**Exit fullscreen** from the bottom-right options menu to leave it. There is no
Jump to Section toolbar. Browsers without the Fullscreen API still get the standalone
page. Section/choice/addon query targets work without changing the player's build.
Saved build slots use the published route, separately from project editor previews.

Ratings are one editable ballot per authenticated account and release. All scores
are integers from 0 to 5. Overall is required and entered independently; writing,
gameplay and presentation are optional. Overall is never inferred from category
scores. The displayed overall average combines readers' **overall** votes only.
Each category includes an average, vote count and distribution from zero through
five. Zero counts as a vote; omitted categories do not. Authors cannot rate their
own releases. Updating a release preserves its ratings; users can edit or remove
their ballot. No voter identities are included in public responses.

**Withdraw release** removes it from discovery and disables future player reads.
Republishing reuses the link and retains its ratings. Source deletion also revokes
public reads. As with any public web content, withdrawal cannot recall previously
loaded/downloaded content, cached media, or screenshots. Snapshot/ballot rows are
retained when a release is withdrawn or its source is deleted; operational data
retention can remove these after the desired recovery period.

## Architecture and agent integration

Six domain actions serve both UI and agent: `list-publications`, `get-publication`,
`get-publication-status`, `publish-project`, `unpublish-project`, `rate-publication`.
Read-only discovery/player actions permit anonymous readers. Publishing, withdrawal,
and ballots require authentication and enforce their identity rules in the service
as well as at HTTP dispatch. The publication action has native agent approval;
the UI's explicit submission owns ordinary publication intent.

`navigate` accepts `publicationId` with `view: play` or `view: explorer` and optional
row/choice/addon ids. Targets are checked against the released document. Navigation
state includes Explorer filters or the selected release; `view-screen` hydrates
fresh published metadata. Existing private-project screenshot receipts retain their
project access rules; public players do not impersonate private viewer sessions.

Metadata lives in `cyoa_publications`; `cyoa_publication_ratings` has a unique
publication/account ballot and database score constraints. Named migrations append
to the app migration sequence. These records are separate from the authoring JSON.
No existing project is published automatically and no remote index is scraped.

Discovery projects metadata only, filters public/content status in SQL and ranks
fuzzy matches in process. Rating summaries are computed in SQL; list paths do not
load documents or individual ballots. At very large catalog sizes, replace the
metadata scan with a dedicated search index while preserving filter/rating semantics.
Per-account ballots limit duplicate votes from one identity; they are not a complete
anti-abuse or multi-account moderation service.

UI copy uses the app catalogs. Primary labels are localized; new descriptive/help
copy currently uses the existing English fallback convention in other locales.

## Verification (2026-09-11)

The full suite passes 838 tests across 45 files, including snapshot isolation,
owner-only release management, SFW filtering, fuzzy matching, zero/omitted rating
semantics, ballot replacement and withdrawal/deletion access. TypeScript and all
nine Doctor guards pass. Client, SSR and Node/Nitro production bundles build;
the existing large-shared-chunk and missing-production-auth-configuration warnings
remain deployment concerns described in the operations guide.

An isolated temporary SQLite/upload installation was checked in Chromium with
separate owner, reader and anonymous contexts: publication through the UI, draft
isolation, SFW/NSFW filters, fuzzy/tag search, playable section targets, actual
Fullscreen API entry/exit, independent category/overall voting and vote updates,
anonymous vote rejection, mobile overflow and release withdrawal all passed.
No external catalog or existing user project was published by verification.
