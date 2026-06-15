---
"@inkeep/open-knowledge": patch
---

OK skill guidance now tells agents to re-point the preview at the end of a multi-doc workflow and to stop claiming a doc is on screen when they haven't navigated there. The preview attaches once per session; later writes don't move the pane, so after a long workflow it could sit on an earlier doc while the agent reported the final file as "open." The Preview section now says: when a turn touches several docs, finish by navigating the preview to the doc the user should land on (via `preview_eval` / `preview_url`, honoring `autoOpen`), and don't tell the user a doc is open unless you navigated there this turn.
