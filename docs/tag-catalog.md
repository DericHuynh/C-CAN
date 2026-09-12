# Shared e621 tag catalog

Image creation/editing, publication metadata and Explorer use `TagInput`. It
supports keyboard autocomplete, removable selected tags and manual custom names.
Names use lowercase and underscores, with Unicode compatibility normalization;
legacy publication tags are normalized for matching without rewriting releases.
The UI shows a bounded suggestion list while searching, not a full tag cloud.

`search-tags` is a public read action backed by a persistent global SQL catalog.
Only metadata fetched from e621 enters `e621_tags`: provider ID, name, category,
post count and refresh timestamp. Project tags are never copied into the global
catalog. Queries are hashed in the refresh cache. Core raw database tools deny
these unscoped internal tables; use the catalog actions instead.

A lookup refreshes its prefix from e621 at most once per day. Identical requests
share work; each process limits upstream traffic to one request per second with
a bounded queue. Failures use stored suggestions and a one-minute retry delay.
Typing a custom tag remains possible during an outage. Suggestions populate the
catalog on demand. `sync-tag-catalog` provides a 320-tag cursor import for
prewarming: pass returned `nextCursor` as `afterId` until null. This does not claim
that the whole e621 taxonomy has already been mirrored. Both actions fetch only
provider metadata and expose no arbitrary global catalog writes.

Explorer URL parameters use repeated `tag` for AND inclusion and repeated
`excludeTag` for exclusion of any matching tag. Filters apply before rating sort
and pagination, survive reload/history navigation, and remain when changing the
content rating. Adding a tag to one field removes it from the opposite field.
Agent navigation observations include both lists.

The upstream contract follows e621's [tag search implementation](https://github.com/e621ng/e621ng/blob/master/app/models/tag.rb)
and [tags controller](https://github.com/e621ng/e621ng/blob/master/app/controllers/tags_controller.rb).
Source attribution is shown in the autocomplete UI. No e621 credentials are
required for this public metadata catalog.
