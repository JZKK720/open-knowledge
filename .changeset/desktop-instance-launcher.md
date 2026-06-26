---
"@inkeep/open-knowledge-desktop": patch
---

Add `bun run --filter=@inkeep/open-knowledge-desktop instances` to launch multiple isolated desktop instances in parallel from the packaged app. Each `<name>=<project>` gets its own `--user-data-dir` (own single-instance lock + storage), opens its project, and is launched detached via `open -n` so it survives the launching process — the path that works for agent/automated launches, where dev-mode windows don't. Launches are staggered to avoid a boot race. Script: `packages/desktop/scripts/launch-instances.mjs`.
