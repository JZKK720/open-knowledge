---
"@inkeep/open-knowledge": patch
---

Restore the `repository` field on the published CLI package, pointing at `inkeep/open-knowledge`. It was dropped when the mirror was re-pointed off `open-knowledge-legacy`, which left npm Trusted Publishing unable to verify provenance and failed every release publish with `E422 ... "repository.url" is ""`.
