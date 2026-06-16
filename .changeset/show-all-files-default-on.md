---
"@inkeep/open-knowledge": patch
---

Show all files in the sidebar by default. The file tree now lists every file in the project on first open — not just markdown and linked content — so the sidebar reflects what's actually on disk without an extra step. Files excluded by `.gitignore` / `.okignore` are included; turn the "Show all files" toggle off (folder right-click menu, sidebar empty-space menu, or the View menu on desktop) to scope the tree back to indexed/linked content. The choice is remembered per machine, per project.

This builds on the recent progressive, lazy file-tree loading (depth-1 on-demand expansion plus a streaming disk walk), so defaulting to "all files" stays fast on large codebases — including ones with nested worktrees and `node_modules` that previously sat well past the old file-count ceiling.
