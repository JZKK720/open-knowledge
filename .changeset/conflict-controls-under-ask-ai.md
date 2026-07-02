---
"@inkeep/open-knowledge": patch
---

Fix the merge-conflict controls (Exit merge / Undo / Save resolution) being
covered by the floating Ask AI composer, which made conflicts impossible to
confirm without first collapsing the composer. The conflict footer now
publishes its height and the composer anchors above it, so the controls stay
visible and clickable with Ask AI stacked on top of them. The conflict diff
also reserves scroll room under the composer, so the last hunks' Accept and
Reject buttons can always scroll clear.
