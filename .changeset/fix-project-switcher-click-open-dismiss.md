---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
"@inkeep/open-knowledge-desktop": patch
---

Fix the sidebar project switcher not opening, and not dismissing on outside click, in the macOS desktop app. Radix's DropdownMenu opens on `pointerdown`, but the desktop renderer does not receive real `pointerdown` events (only `mousedown`/`click`), so clicking the trigger did nothing; and because the menu was modal, clicking outside could not dismiss it either. The trigger now also opens from the `click` event on the desktop host (mirroring the editor's "Open with AI" menu), and the menu is non-modal so outside-click dismissal works and the rest of the UI stays interactive while it's open — matching the Cloud/Sync popover. Browsers are unaffected.
