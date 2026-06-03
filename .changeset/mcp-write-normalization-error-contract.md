---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
"@inkeep/open-knowledge-desktop": patch
---

Tighten the MCP write/edit surface's error contract and normalization (PRD-6837): malformed `docName` rejections now surface the specific reason (path traversal, hidden-dot segment, control character, …) instead of one flat "invalid request" line; `write_document` strips every trailing `.md`/`.mdx` so `foo.md.md` normalizes to `foo` (was the doubled `foo.md.md` on disk); `append`/`prepend` join with a single blank-line separator regardless of edge newlines (was an occasional `\n\n\n` double blank line); and `edit_frontmatter` adds the blank line after the closing `---` when it creates a frontmatter block on a doc that had none.
