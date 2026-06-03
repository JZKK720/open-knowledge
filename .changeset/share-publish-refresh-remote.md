---
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

fix(share): refresh remote status after Publish to GitHub so the wizard does not re-open on the next Share click

After a successful Publish to GitHub, the project gains an `origin` remote, but the sync engine had snapshotted `hasRemote: false` at boot and nothing told it to re-detect. The Share button reads that stale state, so the next Share click re-opened the Publish wizard as if the project had never been published — and submitting again 422'd on the repo that now exists (`<owner>/<name> already exists`). The publish handler now fires a fire-and-forget `refreshRemote()` on success (mirroring the set-identity nudge): the engine re-detects the new remote and broadcasts `sync-status` over CC1, so the client's `hasRemote` flips to true and the next Share click constructs the share URL directly instead of re-opening the wizard.
