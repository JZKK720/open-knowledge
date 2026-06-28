---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-server": patch
---

Run the git preflight at the project-setup boundary so a broken or PATH-invisible git surfaces recoverable install/upgrade guidance instead of a raw error.

Creating a project, opening a folder, cloning from GitHub, and `ok init` now verify git is usable before invoking it, and run against the exact git the preflight validated (the resolved path for in-process git, or an enriched PATH for the spawned clone). When git is missing or unusable they report platform-specific install guidance; `ok init` exits 78 (EX_CONFIG) on a git-preflight failure, matching `ok start`.

These setup paths now require git 2.31 or newer — the same floor `ok start` and the desktop app already enforce at launch.
