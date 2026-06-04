---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
"@inkeep/open-knowledge-desktop": patch
---

Rename the `gbrain` starter pack to **Entity vault (GBrain-compatible)** and reposition it as a human cockpit for GBrain-style Markdown brains rather than a GBrain reimplementation. This is a breaking pre-release rename: the canonical pack ID is now `entity-vault` with no `gbrain` alias, so `ok seed --pack gbrain` no longer resolves — use `ok seed --pack entity-vault`. The pack picker, seed dialog, toast, and CLI list now show "Entity vault (GBrain-compatible)". Generated dossier templates are tightened for GBrain-compatible parsing — document-level `title:` frontmatter, an explicit `--- timeline ---` sentinel, and parseable `- **YYYY-MM-DD** | source | @author — … Confidence: …` timeline bullets with path-qualified `[[folder/slug|Label]]` links. The workflow doc moved from `/workflows/gbrain` to `/workflows/entity-vault`. OK edits and reviews the Markdown; Garry Tan's `gbrain`, if installed, can still import/sync the same vault — interop is Markdown + Git, with no deep integration implied.
