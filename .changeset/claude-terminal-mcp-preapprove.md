---
"@inkeep/open-knowledge-desktop": patch
---

Launching Claude Code from the docked terminal ("Open in Claude") no longer shows the one-time "New MCP server found in this project" trust prompt for Open Knowledge's own MCP server. The pre-approval applies only to OK's own server: a foreign or modified `open-knowledge` entry in a shared or cloned project still shows Claude Code's trust prompt, and the check runs per launch so it reflects the project's current state. Codex and Cursor launches are unchanged.
