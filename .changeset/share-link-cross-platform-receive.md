---
"@inkeep/open-knowledge": patch
---

Give share-link recipients on Linux and Intel Macs a working way in, and make `ok clone` fail helpfully on private repos.

The share-link splash now always shows a copyable CLI block — `npm install -g @inkeep/open-knowledge` followed by `ok clone <owner/repo> -b <branch>` — alongside the macOS desktop options. After the page loads it adapts to the visitor's OS: Linux promotes the CLI and hides the desktop-only buttons, Windows shows a clear "Open Knowledge isn't supported on Windows yet" notice (keeping the View on GitHub link), and macOS keeps the desktop app primary with the CLI tucked behind a "Have an Intel Mac? Open with the CLI" disclosure. The clone command always pins the shared branch with `-b`, and a post-clone breadcrumb tells the recipient which file or folder to open once the clone lands them at the repo root.

`ok clone` now explains how to recover from an authentication failure instead of printing a raw git error. When you're not signed in, it prints `ok auth login` and the exact `ok clone` command to re-run afterward. A 403 names the signed-in account that may lack access, and a scope problem points at the missing `repo` OAuth scope.
