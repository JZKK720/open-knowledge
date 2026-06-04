---
"@inkeep/open-knowledge": patch
---

Desktop: the main process no longer crashes with a recurring "A JavaScript error occurred in the main process — Error: write EPIPE" dialog after every window is closed. On macOS the main process outlives its windows, and the auto-updater's periodic timer keeps writing to the stdout/stderr inherited from the launching terminal; once that terminal closes, each write throws `EPIPE`, which — with no stream `error` listener — escalated to an uncaught exception and Electron's fatal-error modal, reappearing every few minutes until the process was killed. A broken-pipe guard installed at the earliest point of main-process boot now handles these benign writes at the stream boundary so they never become an uncaught exception, while genuine (non-broken-pipe) stream errors are still surfaced to the file log. The guard is logger-agnostic, so it covers every stdout/stderr writer in the main process, not just the updater.
