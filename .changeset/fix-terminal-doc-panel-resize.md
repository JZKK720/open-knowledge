---
"@inkeep/open-knowledge": patch
---

Fix the right-docked terminal and the doc panel fighting over space. Six confusing interactions are gone:

1. Dragging the terminal narrower no longer pops the closed doc panel open — the space returns to the editor.
2. With the doc panel closed, the two resize handles no longer overlap at the same pixel seam — a drag aimed at the terminal edge can't land on the (now inert) doc-panel handle and expand the doc panel instead.
3. Closing the doc panel while the terminal is open no longer inflates the terminal; the editor absorbs the width, and the terminal keeps its own size.
4. The terminal column can now be dragged shut: dragging it below half its minimum width snaps it closed and hides it on release, matching the doc panel's drag-to-close affordance. (The hide button still works.)
5. Hiding the terminal no longer resurrects a doc panel you had closed while it was open (and showing the terminal no longer restores a stale doc-panel state either) — the doc panel keeps whatever state it was in.
6. Collapsing the left file sidebar no longer widens the terminal column (measured 480px → 673px before the fix) — the editor absorbs the freed space while the doc panel and terminal hold their pinned widths.

Closed panels are now consistently button-only to reopen: a collapsed doc panel no longer exposes a draggable rail handle (use the toolbar toggle or ⌥⌘B), matching the terminal, whose handle disappears when it is hidden.
