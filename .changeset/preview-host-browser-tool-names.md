---
"@inkeep/open-knowledge": patch
---

OK skill preview guidance is now framed around the three apps OK ships first-class preview support for, naming the exact in-app browser tool to drive in each so the agent opens the preview in the host's own surface instead of falling back to the system browser:

- **Claude Code Desktop** → `preview_start` / `preview_eval` (the preview pane).
- **Cursor** → its built-in Browser tool's `Navigate` action (`browser_navigate`, via Cursor's `cursor-ide-browser`). Notes that only the agent's own `Navigate` reaches the pane (a third-party MCP cannot push a URL in) and that a surfaced link follows Cursor's "Browser Tab" vs "Google Chrome" picker.
- **Codex desktop app** → the in-app `@Browser` plugin (drives via `tab.goto`).

The **Claude Code CLI** is now a clearly separate track: pure stdio, no browser — use `ok open <doc>` to deep-link into OK Desktop, never print/fake a browser. The Codex CLI, IDE extension, and Cloud live on this track too (web search only, no localhost browser). The underlying capability-not-host-name principle is retained so unknown hosts still route correctly.

The runtime "no browser attached" warning (`attach-preview-once`) now names the same per-host paths (`preview_start`, in-app browser `Navigate`/`@Browser`, CLI `ok open`) instead of only `preview_start`, so the in-band recovery signal matches the bundled skill.
