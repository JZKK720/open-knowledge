---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
"@inkeep/open-knowledge-desktop": patch
---

Give the "Relaunch" update notice immediate feedback. Clicking Relaunch now swaps the card in place to "Relaunching to install the update…" and removes the button the instant the click lands, instead of sitting unchanged while the app shuts down running servers before quitting. If the relaunch fails, the card is restored so it can be retried.
