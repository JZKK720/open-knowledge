---
"@inkeep/open-knowledge-server": patch
"@inkeep/open-knowledge": patch
---

fix(server): folder delete and duplicate conflict pre-checks enumerate descendant docs from disk, not the lagging file index

Folder `delete-path` and `duplicate-path` derived their affected-docs set from the in-memory file index, which the chokidar watcher populates asynchronously. Right after a fresh `write_document` create, that index lags on-disk truth — the same root cause as the folder-rename bug (PRD-6839). Both handlers now walk the source directory on disk (via `listManagedDocNamesUnderFolderFromDisk`), the authoritative set of what the operation touches, exactly as folder rename does.

- **delete-path (folder):** the affected-docs set gates `captureAndCloseDocuments` and the `recentlyRemovedDocs` population, but `rmSync` removes the directory regardless. Against a just-created tree the lagging index returned an empty set, so those cleanup steps were skipped while the directory still vanished — orphaning the in-memory Y.Docs (silent data loss). The disk walk runs before the delete, so it sees every descendant.
- **duplicate-path (folder):** the conflict pre-check (refuse to copy a doc carrying raw `<<<<<<<` / `=======` / `>>>>>>>` merge-marker bytes) was silently bypassed for freshly-created children, producing a broken duplicate. The gate now sees every on-disk child.

The walk also `registerDocExtension`s each descendant, so the downstream `getDocExtension` calls in both handlers reconstruct the correct extension-ful path. `handleTrashCleanup` intentionally keeps reading the index — the file is already gone from disk by then, so an empty index is the desired idempotent fast-path.
