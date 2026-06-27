---
"@inkeep/open-knowledge-app": patch
---

Docked terminal: an _Open in terminal_ launch no longer prints a raw `command not found`. The launch gate now writes the `<bin> '<prompt>'` command only when a PATH probe confirms the CLI is present. On a flaky `unknown` probe it re-probes once; a `not-found` verdict, a still-`unknown` re-probe, or an IPC-level probe failure all suppress the write and surface the existing missing-CLI banner instead. This applies to Codex / Cursor / OpenCode (via `cliPreflight`) and to Claude (gated on the fresh `claudePreflight` recheck it already runs). The trade-off is a rare false-negative — an installed CLI whose probe flakes twice won't auto-launch — in exchange for a guaranteed-clean terminal.
