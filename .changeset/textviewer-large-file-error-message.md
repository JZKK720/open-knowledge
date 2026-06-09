---
"@inkeep/open-knowledge": patch
---

Show a human-readable message when a file is too large for the built-in text editor, instead of a bare "Failed to load file (HTTP 413)".

The built-in text editor caps the file it will load at 1 MB. Opening a larger file (a long GPS track `.gpx`, a big `.csv`, a verbose `.log`) previously surfaced only the raw status code. It now explains that the file exceeds the 1 MB limit and points to the "Open file" action to open it in another app. Other load failures map to plain-language messages too; unexpected statuses keep the code appended so they stay diagnosable.
