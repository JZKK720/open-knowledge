---
"@inkeep/open-knowledge": patch
---

Rename the product brand from "Open Knowledge" to "OpenKnowledge" (one word) across the desktop app, CLI output, MCP/skill copy, and docs.

The macOS app, its helper bundle, the DMG artifact, and the userData directory are renamed. A one-time, identity-verified migration runs on the first launch of a renamed build: it relocates an existing user's app state (recent projects, window restore, auto-update cache) from `~/Library/Application Support/Open Knowledge/` to `.../OpenKnowledge/`, but only after verifying the legacy directory is ours (its `state.json` parses as our schema), so another vendor's identically-named directory is never touched. It copies, verifies, then removes the legacy directory; any failure degrades to a clean first run.

Technical identifiers are unchanged: the npm package `@inkeep/open-knowledge`, the macOS appId `com.inkeep.open-knowledge`, the `openknowledge://` deep-link scheme, the `openknowledge.ai` domain, and the `open-knowledge` MCP server name. "Open Knowledge Format" (Google's external standard) is also preserved.
