---
"@inkeep/open-knowledge-server": patch
---

Divergent degraded-fallback content no longer overwrites the source bytes it stands for on WYSIWYG interaction. When a parse-error fallback block's editor content diverges from its underlying source region (possible only via dependency or plugin drift producing an unknown, position-unresolvable block), typing into the fallback followed by any later edit — including a remote peer's — previously rewrote the document source wholesale to the fallback-derived text, silently destroying the original bytes. The server bridge now detects when a sync drain would settle with the WYSIWYG view and the source text divergent beyond tolerance, keeps the source bytes authoritative, and re-derives the WYSIWYG view from source in the same drain (restoring the broken-block chrome as well).
