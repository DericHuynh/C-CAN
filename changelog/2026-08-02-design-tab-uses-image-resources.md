---
type: fixed
date: 2026-08-02
---

Design tab now references images by resource id like every other entity: the page / row / choice / addon / backpack background fields are image-resource selects (with a custom URL/data fallback) instead of raw "Image URL" text inputs. The ACL import translation covers the styling background keys too, so legacy ICCPlus documents get their backgrounds rewritten to resources (deduplicated, idempotent) and the viewer resolves the ids back to payloads when rendering the page, row and backpack backgrounds. Verified end-to-end: importing a legacy document with styling backgrounds produces resource ids (deduped), the design tab shows them in the selects, and the viewer renders the resolved payloads (no ids leaking into `background-image`).
