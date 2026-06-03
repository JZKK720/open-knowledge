---
"@inkeep/open-knowledge": patch
"@inkeep/open-knowledge-core": patch
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge-app": patch
"@inkeep/open-knowledge-desktop": patch
---

fix(server): preserve PATH and ELECTRON_RUN_AS_NODE for the git credential helper so packaged-app sync can authenticate

In the packaged desktop app, sync to a private/HTTPS repo failed: the popover showed a `Yjs was already imported` warning and an Electron `Unable to find helper app` FATAL, then `could not read Username for 'https://github.com': Device not configured`.

The desktop server runs as Electron-as-Node and sets `localOpCliArgs` to `[electronBinary, cli.mjs]`, so git's credential helper re-invokes the Electron binary directly (it bypasses the `ok.sh` wrapper that sets `ELECTRON_RUN_AS_NODE=1`). But `createGitInstance` set the git child environment via simple-git's `.env(obj)`, which **replaces** `process.env` rather than merging — so the inherited `ELECTRON_RUN_AS_NODE=1` was dropped. The Electron binary then booted as a GUI app, couldn't find its helper-app bundle, and crashed before returning credentials.

`buildGitEnv()` now preserves `ELECTRON_RUN_AS_NODE` (so the helper runs as Node, not a GUI app) and `PATH` (so git resolves its subprocesses and a bare-command helper like `!open-knowledge auth git-credential` is found), alongside the existing `LANG`/`LC_ALL=C`.
