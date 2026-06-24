---
"@inkeep/open-knowledge": patch
---

Add a committed, project-level auto-sync default (`autoSync.default`). A maintainer can now ship a project that opens quietly for collaborators: set **Settings → Sync → Default for everyone** to "Off by default" (or "On by default") and the choice is committed to `.ok/config.yml` and travels with the repo via git. New clones then skip the "enable auto-sync" onboarding prompt and open with sync in the chosen state.

`autoSync.default` is `true | false | null` (null/absent = ask, the previous behavior) and seeds each machine's `autoSync.enabled` on first open. It is a soft default — anyone can still change auto-sync for their own machine in Settings, which overrides the committed default for that machine only. The per-machine `autoSync.enabled` setting stays gitignored and per-machine.
