---
"@inkeep/open-knowledge": minor
---

Add an OKF-conformant starter pack: `ok seed --pack okf` (also shown by `ok seed --list-packs`) scaffolds a small knowledge base that is conformant with Google's Open Knowledge Format (OKF) v0.1 from the first commit — every non-reserved doc carries a non-empty `type`, plus a frontmatter-free lowercase `index.md` (§6 navigation) and `log.md` (§7 change history). Pure pre-populated content: the native frontmatter schema stays open-shaped and nothing is enforced or linted. Ships a guidance-only OKF conventions skill like every other pack.
