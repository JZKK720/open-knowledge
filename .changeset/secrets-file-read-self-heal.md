---
"@inkeep/open-knowledge": patch
---

Tighten loose permissions on the embeddings secrets file when reading it

The embeddings API key in `~/.ok/secrets.yml` was re-secured to 0600 only on write. A file left group/other-readable (an older build before chmod-on-write, an external tool, or a hand-edit) could stay world-readable indefinitely, since the key is read on every search but rewritten rarely or never. Reads now self-heal: a secrets file with a mode looser than owner-only is tightened to 0600 the moment it is read, with a one-time warning. Best-effort and never throws, so it stays safe on the search read path.

The store also reads a key stored under the previous field name as a fallback, so a key written by an earlier build keeps working after the field was renamed to `OPENAI_API_KEY`; the next time the key is set, it is rewritten under the current name (one-shot and self-clearing).
