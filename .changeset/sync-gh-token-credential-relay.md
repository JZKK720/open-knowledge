---
"@inkeep/open-knowledge": patch
---

Sync now authenticates to GitHub using your `gh` CLI login, matching how clone already works. Previously the background sync engine only consulted Open Knowledge's own credential store, so users who were signed in with `gh` but had never completed a separate Open Knowledge sign-in saw a persistent "GitHub sign-in is missing or expired" error in the sync popover even though their `gh` session was valid. The server now resolves the `gh` token (the same source the push-permission check already used) and relays it to the git credential helper, which prefers it over its own stored token. A fresh `gh auth login` or a reconnect is picked up on the next sync cycle without a restart.

Also fixes `ok clone` so its `gh`-based authentication works on installs where `gh` lives outside the default PATH (e.g. Homebrew at `/opt/homebrew/bin`): clone now inherits your shell environment instead of replacing it, so the `gh` credential helper can locate `gh` and its config.
