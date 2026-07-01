---
"@inkeep/open-knowledge": patch
---

Starting an AI chat in the docked terminal is now a first-class action. A single **Open chat / Close chat** button in the editor header reveals the terminal (collapsing the right document panel so the chat gets the full column) and starts your default CLI when no session is open, or hides it when it's showing. The terminal tab strip's **+** is now **New chat** (launches your default CLI, next to the last tab) alongside a separate **New terminal tab** button for a plain shell.

Your **default CLI** is detected from what's installed — priority Claude → Codex → OpenCode → Cursor — and the one you pick anywhere sticks for next time; if none are installed it falls back to Claude with the existing install prompt. The "Ask AI" bubble and the file-tree / composer "Open in terminal" actions use the same default and also clear the document panel for the chat. Across the app, the **Terminal** option now leads the "Open with AI" menus ahead of Desktop.
