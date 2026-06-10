---
"@inkeep/open-knowledge": patch
---

Fix the sync status dialog and recovery when a GitHub credential is missing. Previously a credential-less fetch/push was misclassified as a retryable network error, so the popover showed "Offline" with a raw `could not read Username … Device not configured` stderr blob and "Sync now" / "Retry" buttons that could never succeed — and the one useful action, reconnecting GitHub, was never offered. Now this is classified as an auth error (`auth-no-credential`): the dialog reads "Reconnect required" with a clear one-line message ("GitHub sign-in is missing or expired. Reconnect to resume syncing.") and a single "Connect GitHub" button. Reconnecting resumes sync without an app restart, and the auth-error state no longer persists across restarts. The server also sets `GIT_TERMINAL_PROMPT=0` so git fails fast instead of attempting a no-TTY prompt.
