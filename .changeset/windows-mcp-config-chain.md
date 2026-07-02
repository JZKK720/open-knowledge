---
'@inkeep/open-knowledge': patch
---

Generate a Windows-launchable MCP server config instead of the macOS-only `/bin/sh` chain. On Windows, `ok init`, `ok start`, and MCP autostart now register `powershell -NoProfile -NonInteractive -Command <chain>` (resolving the npm-global `ok.cmd` shim first, then `npx`). The reclaim sweep now recognizes both platforms' canonical entries everywhere, so a config written on one OS is never clobbered back and forth by the other, and hand-fixes on Windows stop being overwritten with an unlaunchable entry.
