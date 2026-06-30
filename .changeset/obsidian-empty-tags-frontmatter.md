---
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge": patch
---

Fix the Properties panel rejecting Obsidian-style empty `tags:` / `aliases:` frontmatter. Files that use Obsidian's default "no tags" shape (an empty `tags:` list whose only item is a blank `- `, or a bare `tags:` with no value) parse to YAML `null`, which the read schema previously rejected for the whole frontmatter block — so the panel showed nothing (or an error banner) and refused every edit, even to the file's other valid properties. The read path now coerces these empty shapes to empty values (`tags:\n- ` reads as an empty list, a bare `tags:` as empty text), so the panel reads and edits these files normally. Files are not rewritten on disk until you actually edit a property.
