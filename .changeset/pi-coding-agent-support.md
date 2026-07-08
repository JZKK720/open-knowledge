---
"@inkeep/open-knowledge": minor
---

First-class support for the Pi coding agent (pi.dev), at parity with OpenCode. Pi has no MCP support, so `ok init` now drops a managed, dependency-free bridge extension at `.pi/extensions/open-knowledge.ts` — it launches OpenKnowledge's MCP server through the same resilient launcher every other editor gets and registers each OpenKnowledge tool as a native Pi tool under an `ok_` prefix (so OK's `edit`/`write` never shadow Pi's built-ins). The OpenKnowledge project skill lands in `.pi/skills/open-knowledge/`, which Pi scans natively; both are trust-gated by Pi's folder-trust prompt, refreshed idempotently on re-init, healed by the repair/reclaim sweeps, and removed by `ok deinit`/`ok uninstall`. Pi also joins the docked-terminal launch registry (`pi '<prompt>'`) and skill install targets, and gets an integrations docs page.
