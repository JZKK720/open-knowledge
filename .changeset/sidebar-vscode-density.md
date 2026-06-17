---
"@inkeep/open-knowledge": minor
---

Sidebar density overhaul, modelled on VS Code / Cursor. Per-level indent drops from ~20px to ~10px, row height tightens from 30px to 24px, and the file icon shrinks from 16px to 14px, so longer filenames stay readable and more rows fit on screen at the same width. Indent guide lines are now visible at rest (not only on hover) so the tighter indent stays traceable. The pinned ancestor header that appears when you scroll into a deep subtree picks up a subtle elevation tint and a hairline divider so it reads as separate from the scrolling content. Long folder names now truncate at the end (`open-knowl…`) to match files, instead of in the middle (`open-…wledge`). The JSON/MDX extension badge still renders unchanged.

Updates `@pierre/trees` to `1.0.0-beta.4`; the file tree's reveal-on-activate now uses Pierre's native `scrollToPath` (replacing the previous hand-rolled scroll math).
