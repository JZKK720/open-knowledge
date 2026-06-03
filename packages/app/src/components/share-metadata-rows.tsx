
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

const DEFAULT_BRANCH_NAMES: ReadonlySet<string> = new Set(['main', 'master']);

export interface ShareMetadataRowsProps {
  owner: string;
  repo: string;
  path: string;
  branch: string;
  testId: string;
  branchTestId: string;
}

export function ShareMetadataRows({
  owner,
  repo,
  path,
  branch,
  testId,
  branchTestId,
}: ShareMetadataRowsProps) {
  const showBranch = branch !== '' && !DEFAULT_BRANCH_NAMES.has(branch);
  return (
    <dl className="space-y-2 text-xs text-muted-foreground" data-testid={testId}>
      <ShareMetadataRow label={<Trans>Repository</Trans>}>
        <span>
          {owner}/{repo}
        </span>
      </ShareMetadataRow>
      {path ? (
        <ShareMetadataRow label={<Trans>File</Trans>}>
          <span className="font-mono">{path}</span>
        </ShareMetadataRow>
      ) : null}
      {showBranch ? (
        <ShareMetadataRow label={<Trans>Branch</Trans>}>
          <span className="font-mono" data-testid={branchTestId}>
            {branch}
          </span>
        </ShareMetadataRow>
      ) : null}
    </dl>
  );
}

interface ShareMetadataRowProps {
  label: ReactNode;
  children: ReactNode;
}

function ShareMetadataRow({ label, children }: ShareMetadataRowProps) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-20 shrink-0 font-mono uppercase tracking-wide text-2xs">{label}</dt>
      <dd className="min-w-0 flex-1 break-all text-foreground">{children}</dd>
    </div>
  );
}
