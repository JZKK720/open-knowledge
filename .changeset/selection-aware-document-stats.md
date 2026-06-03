---
"@inkeep/open-knowledge-app": patch
---

feat(open-knowledge): editor footer counts scope to the selection

The footer word / character / token counts now reflect the current text
selection. When you select a passage in either edit mode, the counts switch to
that passage and gain a "Selected" indicator; collapsing the selection reverts
to the whole-document counts. Selection counts use the same visible-text
semantics as the document counter (markdown syntax stripped), so the same
passage counts identically whether selected in WYSIWYG or source mode.
