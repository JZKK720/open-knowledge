---
"@inkeep/open-knowledge": minor
---

Add semantic ("by meaning") search to the Cmd+K omnibar.

When semantic search is set up for a project (enabled plus an embeddings API key), the omnibar shows a "By meaning" filter pill beside "By tag". Clicking it opens an exclusive mode where typing stays instant and local; pressing Enter fires one vector search through the existing `/api/search` semantic fusion, the same engine the MCP `search` tool uses. Results are sticky: editing the query after a search keeps the prior results (dimmed) and offers a one-key re-fire, so a stray keystroke never costs the expensive result set. Escape exits the mode before closing the palette. When semantic search is not set up the pill is hidden and the omnibar is unchanged.

Omnibar-initiated semantic searches now carry a `source` tag so their cost can be counted apart from the MCP tool's.
