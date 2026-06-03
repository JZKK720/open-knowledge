---
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

fix(cli): exit immediately instead of hanging ~5s on short commands like `ok ps` and `ok stop`

`createFileLogger` runs in the CLI's `preAction` hook on every command and scheduled a deferred log-dir prune via `setTimeout(..., 5000)` that was never `.unref()`'d. A referenced timer keeps Node's event loop alive, so short commands finished their work in well under a second but the process could not exit until the 5s timer fired, so every `ok ps`, `ok stop`, `ok status`, etc. paid a flat ~5s tail. The timer is now unref'd: short commands exit as soon as their work is done, while the prune still runs on long-lived processes (`ok start`, `ok mcp`) where log accumulation actually needs capping. Per-file size remains bounded inline by `rotateIfNeeded` on every logger creation, so log hygiene is unaffected.
