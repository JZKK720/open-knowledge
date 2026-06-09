---
"@inkeep/open-knowledge": patch
---

`ok auth status --json` now includes a `backend` field naming where credentials are stored — `keyring` (the OS keychain) or `file` (`~/.ok/auth.yml`). The field appears in every JSON status shape, including when you are not logged in, so you can confirm which storage backend is active without a stored token. Human-readable (non-`--json`) output is unchanged.
