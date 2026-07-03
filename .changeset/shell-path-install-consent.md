---
"@inkeep/open-knowledge": patch
---

The macOS app now asks before editing your shell startup files. Putting `ok` on your `PATH` used to happen silently on first launch — a managed block appended to `~/.zshrc` / `~/.bash_profile` / fish's `conf.d`. That write is now a pre-checked "Add the `ok` command to your terminal" toggle in the first-launch dialog, and nothing touches your shell config if you uncheck it. Declining only affects `ok` typed in an external terminal: the app's built-in terminal now has `ok` available regardless, and MCP wiring and "Open with AI" launches never depended on it. Decisions are recorded in `path-install.json`; machines that already have the managed block are treated as consented (no re-prompt, block left in place), deleting the block still opts out permanently, and a declined install can be re-run any time from **File → Set up OpenKnowledge integrations…** (the renamed "Configure AI tool integrations…" item).
