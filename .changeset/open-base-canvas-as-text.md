---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
"@inkeep/open-knowledge-desktop": patch
---

Open `.base` and `.canvas` files (Obsidian Bases / Canvas) directly in the read-only text viewer. Previously, clicking a `[[file.base]]` or `[[file.canvas]]` wiki-link opened a chooser pane; clicking "Open file" from the chooser then replaced the editor view with a raw `415` JSON error envelope from the API. Now both file types open immediately in the built-in text viewer (`.canvas` with JSON syntax highlighting) — no chooser, no broken "Open file". The "Open file" affordance for all other downloadable types (`.docx`, `.zip`, etc.) is also hardened: it now routes through the sanctioned asset-dispatch path (OS-handoff on desktop, new tab on web) instead of a same-frame navigation to the asset API.
