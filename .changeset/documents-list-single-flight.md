---
"@inkeep/open-knowledge": patch
---

Coalesce the redundant `GET /api/documents` requests fired on load. Several consumers independently fetch the same full listing — the page-list context (asset/folder/file paths), the empty-editor state (entry count for the onboarding branch), and the wiki-link suggestion source (referenced assets) — so on boot and on every file-change push the server ran the same `ready`-gated disk walk two or three times concurrently. These now share a single in-flight request and one JSON parse. It is single-flight, not a result cache: the slot is released as soon as the request settles, so consumers that refetch on a file-change push still get current data. The sidebar file tree keeps its own `depth=1` lazy fetch (a different URL) unchanged.
