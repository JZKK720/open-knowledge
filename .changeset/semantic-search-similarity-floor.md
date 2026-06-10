---
"@inkeep/open-knowledge": patch
---

Make semantic search retrieval rank-based so synonym queries return matches

Semantic ("by meaning") search returned nothing for synonym queries: "cybersecurity" missed a page about hacking, "kid" missed a page about a child. The cause was an absolute cosine floor of 0.35 applied before ranking. text-embedding-3-small produces a compressed similarity band for short keyword queries against whole-document embeddings (correct hits commonly score 0.13 to 0.29), so the floor discarded every candidate and search fell back to pure keyword matching, which a synonym cannot satisfy.

An absolute threshold is the wrong mechanism here: the right value is model-specific, and on a compressed scale a weak-but-real hit and weak noise overlap (a correct hit scored 0.147 while an unrelated query scored 0.151), so no threshold separates them. Retrieval is now rank-based: the closest pages by cosine are returned and ranked, with no absolute cutoff by default. The omnibar bounds the "By meaning" list by a result count (the same cap as keyword search) rather than a score, since nearest-neighbor search always has a closest match. An optional per-project hard cutoff remains via search.semantic.similarityFloor for anyone who knows their provider's cosine scale and wants to suppress weak matches.

This affects both the MCP search tool and the omnibar "By meaning" mode.
