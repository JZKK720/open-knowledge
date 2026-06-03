---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
"@inkeep/open-knowledge-desktop": patch
---

Encourage agents to pass a `summary` on every content write. The project skill (`packages/server/assets/skills/project/SKILL.md`) now tells agents to supply the one-line `summary` arg on `write_document` / `edit_document` — previously the field was only described as an optional parameter in the tool schema, so agents rarely sent one and document timelines showed writes without a human-readable change-note. The §Writing section gains a dedicated rule and the TL;DR Writes line gains a pointer to it. The `summary` plumbing itself is unchanged; this only adds the guidance that drives adoption.
