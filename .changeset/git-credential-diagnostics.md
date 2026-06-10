---
"@inkeep/open-knowledge": patch
---

The git credential helper (`ok auth git-credential get`, invoked by git on every sync) now records a diagnostic line to `~/.ok/logs/cli.*.log` on every credential lookup: the host, the active storage backend, and the outcome — `found`, `absent` (no credential stored), or `read-error` (the keychain read failed, e.g. locked keychain or access denied). Hits log at `debug` (silent at the default level); misses log at `warn`. Previously these only went to stderr, which git swallows, so a vanished credential left no trace. The log is flushed before the helper exits so the record reliably lands. Token values are never logged.
