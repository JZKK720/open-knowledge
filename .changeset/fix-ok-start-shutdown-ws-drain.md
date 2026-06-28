---
"@inkeep/open-knowledge": patch
---

Fix `ok start` hanging for about 10 seconds on Ctrl+C when a live client was connected. If a browser preview tab or an agent/MCP session held a WebSocket open, shutdown left that socket alive, so the WebSocket-server close and the HTTP-server close each blocked until a 5-second internal timeout fired — adding ~10s of delay and printing an alarming `AggregateError` on a routine quit. Shutdown now drains the live upgrade sockets up front (mirroring the existing drain in `ok ui`), so both close steps finish promptly and the server lock is released right away.
