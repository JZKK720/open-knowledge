---
"@inkeep/open-knowledge-app": patch
---

Fix a bug where the same file could open in two tabs at once. Clicking a sidebar file that is already open in another tab now focuses that existing tab instead of opening a duplicate — including when a blank "New Tab" placeholder is the active tab (the active placeholder is consumed). The same focus-in-place behavior applies to folder and asset tabs. Tabs restored from a saved session that already contain two views of one file are left untouched.
