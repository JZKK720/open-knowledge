---
"@inkeep/open-knowledge": patch
---

Clarify the skills import prompt. The one-time banner now states what Import actually does: it moves the editor-dir skills into `.ok/skills` and replaces the `.claude`, `.codex`, etc. copies with symlinks back to it, so the knowledge base is the single place to edit them and every editor stays in sync. It also flags the consequences a user needs before clicking: if those folders are committed to git the change should be reviewed, and symlinks can behave differently on some editors and on Windows.
