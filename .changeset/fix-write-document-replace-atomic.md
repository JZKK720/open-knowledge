---
"@inkeep/open-knowledge": patch
---

Fix `write_document({ position: "replace" })`: the call now performs an atomic overwrite at the CRDT layer. Previously when an agent's payload shared substrings with the existing content, only the differing characters were written (a DMP-incremental merge), and concurrent human typing could combine with the result into a hybrid document. The case now routes through the same atomic primitive `version({ action: "rollback" })` already uses, which deletes the prior bytes wholesale before inserting the new payload.

`append`, `prepend`, and `edit_document` find/replace are unchanged — they keep the item-preserving incremental primitive. (`edit_document` routes through an internal `patch` position so a surgical find/replace produces a minimal CRDT delta rather than a whole-document overwrite, which keeps a concurrent human's edits outside the matched span intact.)

PRD-6667.
