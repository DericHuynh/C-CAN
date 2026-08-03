---
type: fixed
date: 2026-08-02
---

Project editor: row and choice image previews now resolve through the image-resource system (they showed nothing after imports started referencing resources by id), and the row, addon and point-type image fields are image-id selects (with a custom URL/data fallback) instead of free-text "Image URL" inputs — matching the choice editor. Every editor list is now virtualized with a dependency-free windowing component (`VirtualList`): rows and their nested choices, the image-resource grid, point types, groups, global requirements, variables, words, sound effects, design groups, backpack rows, the id list, and the group dialog's row/choice pickers.

Two follow-ups from testing against the imported example: the virtualizer now picks a genuinely-scrollable ancestor (an auto-height `overflow:auto` wrapper used to look like the viewport, which mounted every row at once) and live-switches to the element that actually scrolls; and editor thumbnails decode progressively (`LazyImage`) — images are base64 data URLs, so decoding hundreds up front froze the page, and opening the choice dialog flushed the queue. Also fixed a linked-activation bug in the engine: random/multi `activateOtherChoice` targets without an explicit `/ON#` count were recorded but never activated (and never released), which also made the `activatedRandomMul` test flaky.

One more virtualizer bug found after the above: items were laid out at estimate-sized offsets forever — the measurement bump keyed off the React setter (whose identity never changes), so the offsets memo never recomputed with the measured heights and row cards overlapped into a pile (with their choices/images hidden underneath) until an unrelated interaction forced a recompute. The bump now keys off a version counter, so rows, choices, images and badges lay out correctly on first paint and re-window cleanly on scroll.
