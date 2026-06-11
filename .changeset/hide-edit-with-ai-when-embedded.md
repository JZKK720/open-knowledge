---
"@inkeep/open-knowledge": patch
---

Hide the "Edit with AI" button in the WYSIWYG bubble menu when Open Knowledge is embedded inside an agent host (Cursor, Codex, Claude Desktop). The button opens the header's "Open with AI" menu, but that menu is already hidden in embedded hosts — so clicking the bubble button there did nothing. The button (and its Cmd+Shift+I shortcut) now hide in lockstep with the header menu, matching the rest of the embedded-host chrome.
