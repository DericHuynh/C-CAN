---
type: fixed
date: 2026-08-02
---

ICCPlus viewer: the point/action bar is docked at the bottom of the screen (matching the original viewer's bottom bar) instead of rendering at the top, and viewer mode is now full-width so rows reach the author's 4-column breakpoint on wide screens. The example import is verified end-to-end: `shared/cyoa-example-render.spec.tsx` renders the viewer against `examples/project.json` and pins that the document's background/border/radius/fonts/margins reach the DOM (the agent shell's `.bg-card !important` no longer overrides the CYOA background in dark mode), and `scripts/tmp-verify-viewer.mjs` checks the real browser output (background, image width, bottom bar, requirement labels, column collapse, card spacing).
