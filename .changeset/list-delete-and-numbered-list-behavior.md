---
"@inkeep/open-knowledge-core": patch
---

Lists now follow GFM-style delete and creation behavior. Backspace on the empty line left after exiting a list (or on an empty nested item) merges back into the list instead of spawning a stray empty bullet or toggling the bullet on and off. Typing an ordered marker like `1. ` directly below a bullet list now starts a real numbered list rather than being absorbed into the bullet list as an empty item.

The unified `list` node (one node type for bullet and ordered, distinguished by the `ordered` attr) had two mismatches: the list keymap was bound to the upstream `bulletList`/`orderedList` wrapper names instead of `list`, so its Backspace/Delete handling never fired; and the list-creation input rules joined any adjacent list of the same node type regardless of kind. Both are now pointed at this schema.
