---
"@inkeep/open-knowledge": patch
---

Agent-write content-divergence warnings now carry the converged document inline so an agent recovers without a second read. `structuredContent.contentDivergence` gains `currentState` (`{kind:"inline", content}`, or `{kind:"truncated", byteLength, hint}` over a 50 KB soft cap) plus a coarse `divergenceType`. The Site A gate is extracted to a shared predicate and extended to `version({ action: "rollback" })`. Divergence is now rate-measurable via the `ok.agent_write.gate_fired_total` / `ok.agent_write.content_divergence_total` counters (bounded `{handler}` label). Adds a production-Electron `agent-patch-divergence-probe` smoke test as permanent regression coverage.
