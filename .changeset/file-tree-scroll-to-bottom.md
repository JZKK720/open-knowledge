---
'@inkeep/open-knowledge-app': patch
---

Fix the file-tree sidebar not scrolling all the way to the bottom. The virtualized tree positioned rows on a 24px grid while they rendered at 26px, so the accumulated per-row gap was subtracted from the scroll range and the last rows became unreachable (worse the taller or more deeply nested the tree). The virtualizer row height is now derived from a single source of truth, so it can no longer drift from the rendered row height.
