---
"@inkeep/open-knowledge": patch
---

Show a redacted tail of the stored embeddings key in Settings

The "API key set" panel in Settings now shows the last four characters of the stored key (the rest masked) so you can tell at a glance which key is configured. The key is still never returned in full: the status endpoint exposes only the redacted tail, and only when the key is long enough that four characters are a negligible fraction.
