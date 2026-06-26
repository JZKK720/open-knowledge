---
"@inkeep/open-knowledge": patch
---

Add OpenCode as a supported agent. `ok init` — and the desktop first-launch consent dialog plus the create-project dialog — now writes an `open-knowledge` MCP server entry to `opencode.json` (project-local, and `~/.config/opencode/opencode.json` for a global install), using OpenCode's `mcp` config shape and the same resilient launcher every other editor gets. OpenCode reads the Open Knowledge skill from the shared `.agents/skills/` directory it already scans, so no extra skill copy is written.

OpenCode is also wired into the Ask AI composer and Open-in-Agent menus as a terminal CLI: it appears as "OpenCode (CLI)" in the Terminal section and launches `opencode '<prompt>'` in the docked terminal. (It's terminal-only — no URL scheme — so it's deliberately absent from the GUI deep-link Desktop section.)

Adds an OpenCode integration page and brand logo to the docs site.
