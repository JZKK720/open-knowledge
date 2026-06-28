---
"@inkeep/open-knowledge": patch
---

Make "Open in agent" (handoff to Claude, Codex, and Cursor) work on Windows and Linux, not just macOS. Install detection was already cross-platform, so on Windows/Linux a registered agent showed an enabled row that, when clicked, failed with a 500 error and a "Couldn't reach …" toast. Handoff dispatch now opens the agent's protocol URL through the OS's registered handler on every platform (`/usr/bin/open` on macOS, `rundll32` on Windows, `xdg-open` on Linux), and Cursor's workspace launch already worked cross-platform. On Windows/Linux the server first confirms the agent's URL scheme is actually registered, so an uninstalled agent reports "not installed" instead of a misleading success.
