---
"@inkeep/open-knowledge-desktop": patch
---

Parallel desktop instances now carry their instance name in the macOS menu-bar app name (`OpenKnowledge (work)`) and editor window titles, so multiple instances running side by side are distinguishable. The label is derived from the launch's per-instance `userData` directory — set by the parallel-instance launcher (`--user-data-dir ~/.ok/instances/<name>`) or dev `OK_INSTANCE` — so it requires no extra flags and is a no-op for the default install.
