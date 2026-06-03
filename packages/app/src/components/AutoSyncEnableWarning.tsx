import { Trans } from '@lingui/react/macro';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';

export function AutoSyncEnableDialogIntro() {
  return (
    <>
      <DialogTitle>
        <Trans>Enable git auto-sync?</Trans>
      </DialogTitle>
      <DialogDescription>
        <Trans>
          Auto-sync periodically fetches, pulls, and pushes commits to your remote git repository so
          your edits stay in sync across machines.
        </Trans>
      </DialogDescription>
    </>
  );
}

export function AutoSyncEnableWarning() {
  return (
    <div
      role="alert"
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
    >
      <p className="mb-2 font-medium">
        <Trans>Before you enable it</Trans>
      </p>
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <Trans>Pulls may overwrite uncommitted local file changes.</Trans>
        </li>
        <li>
          <Trans>
            Open Knowledge will create commits and push them to your remote automatically. If you do
            not want automatic commits in your git history, you should not enable auto-sync.
          </Trans>
        </li>
        <li>
          <Trans>
            If this repo is shared, your in-progress edits become visible to collaborators as soon
            as they sync.
          </Trans>
        </li>
      </ul>
    </div>
  );
}
