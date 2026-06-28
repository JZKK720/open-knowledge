---
"@inkeep/open-knowledge": patch
---

Desktop: enable the openknowledge.ai update proxy for the beta channel. Beta builds now fetch updates through `openknowledge.ai/updates/beta`, which 302s to the byte-identical GitHub asset (preserving the manifest sha512 and the macOS signature) so updates can be counted per version. Stable still reads the GitHub `publish:` config; it gets the same path once an end-to-end beta update is confirmed. A feed failure reverts to the GitHub provider for the session, so auto-update reliability never drops below GitHub-direct.
