---
"@inkeep/open-knowledge": minor
---

Add opt-in semantic search to the MCP `search` tool, powered by a remote OpenAI-compatible embeddings API. When enabled, an embeddings signal is fused into `full_text` ranking so an agent's query surfaces conceptually-related pages even when they share no keywords (e.g. "auth retries" → a page titled "Session Token Refresh"). It is additive and **off by default**: with the flag off, search is byte-for-byte today's lexical ranking, and the cmd-K omnibar always stays purely lexical and instant.

**Privacy / egress.** When the feature is enabled **and** a key is set, the search query and matching page content are sent to the configured embeddings provider. Egress is explicit and scoped: only corpus content is embedded — anything excluded by `.okignore` / `.gitignore` is never sent — embedding is lazy (nothing leaves the machine until an agent actually runs a semantic search), and the key lives only in a 0600 `~/.ok/secrets.yml` file (never in config, logs, or telemetry). If the key is missing, the provider errors, or you're offline, search silently degrades to lexical and never blocks.

Setup (per machine): `ok embeddings set-key` stores the provider key in `~/.ok/secrets.yml` (0600); set `search.semantic.enabled: true` in project-local config. `ok embeddings status` shows capability. Provider base URL / model / dimensions are configurable (Azure / self-hosted / other). Vectors cache incrementally under `.ok/local/` (content-addressed, keyed by provider + model + dimensions). See the "Semantic search" section of the configuration reference for full setup.
