---
"@inkeep/open-knowledge": patch
---

Omnibar "By meaning" UX: carry typed text into the mode, and show indexing progress

- Switching to "By meaning" (clicking the pill) now keeps whatever you already typed as the semantic query instead of clearing it — only a `tag:` filter prefix is dropped. The typed text becomes the pending search you can fire with Enter.
- The "By meaning" view now shows an indexing banner with live coverage ("Indexing your pages — N of M ready. Results may be incomplete.") while the corpus is still embedding. The first by-meaning search lazily kicks off that background index, and the banner ticks up as it progresses, so it is clear when results may not yet be complete.
