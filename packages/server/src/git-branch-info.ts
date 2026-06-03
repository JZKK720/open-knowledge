
import { isValidBranchName } from '@inkeep/open-knowledge-core';
import { type DirtyOverlapResult, dirtyFilesOverlapWith } from './git-dirty.ts';
import { createGitInstance } from './git-handle.ts';

export { isValidBranchName };

export type BranchInfo =
  | {
      detached: false;
      currentBranch: string | null;
      currentHeadSha: null;
      shareFileExists: boolean;
      dirtyConflicts: DirtyOverlapResult;
      branchIsLocal: boolean;
    }
  | {
      detached: true;
      currentBranch: null;
      currentHeadSha: string;
      shareFileExists: boolean;
      dirtyConflicts: DirtyOverlapResult;
      branchIsLocal: boolean;
    };

export function isValidBranchInfoDocPath(docPath: unknown): docPath is string {
  if (typeof docPath !== 'string') return false;
  if (docPath.length === 0) return false;
  if (docPath.startsWith('/')) return false;
  if (docPath.includes('\\')) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control chars are exactly what we want to reject
  if (/[\x00-\x1F\x7F]/.test(docPath)) return false;
  for (const segment of docPath.split('/')) {
    if (segment.length === 0) return false;
    if (segment === '..' || segment === '.git') return false;
  }
  return true;
}

export async function computeBranchInfo(
  projectDir: string,
  targetBranch: string,
  docPath: string,
): Promise<BranchInfo> {
  const { git } = createGitInstance(projectDir);

  await git.raw(['rev-parse', '--git-dir']);

  const headStatePromise = (async (): Promise<
    | { detached: false; currentBranch: string | null; currentHeadSha: null }
    | { detached: true; currentBranch: null; currentHeadSha: string }
  > => {
    try {
      const ref = (await git.raw(['symbolic-ref', 'HEAD'])).trim();
      const match = /^refs\/heads\/(.+)$/.exec(ref);
      const branch = match ? match[1] : null;
      return { detached: false, currentBranch: branch, currentHeadSha: null };
    } catch {
      const sha = (await git.raw(['rev-parse', '--short=7', 'HEAD'])).trim();
      if (sha.length === 0) {
        return { detached: false, currentBranch: null, currentHeadSha: null };
      }
      return { detached: true, currentBranch: null, currentHeadSha: sha };
    }
  })();

  const shareFilePromise = headStatePromise.then(async (head) => {
    const ref = head.detached ? 'HEAD' : head.currentBranch;
    if (!ref) return false;
    try {
      await git.raw(['cat-file', '-e', `${ref}:${docPath}`]);
      return true;
    } catch {
      return false;
    }
  });

  const branchIsLocalPromise = git
    .raw(['rev-parse', '--verify', `refs/heads/${targetBranch}`])
    .then(() => true)
    .catch(() => false);

  const dirtyPromise = dirtyFilesOverlapWith(projectDir, targetBranch).catch(
    (err: unknown): DirtyOverlapResult => {
      if (isBranchResolutionError(err)) return { conflicts: false, files: [] };
      const message = err instanceof Error ? err.message : String(err);
      const truncated = message.length > 500 ? `${message.slice(0, 500)}…` : message;
      console.warn(
        `[git-branch-info] action=dirty-overlap-failed branch=${targetBranch} error=${truncated}`,
      );
      return { conflicts: false, files: [] };
    },
  );

  const [headState, shareFileExists, branchIsLocal, dirtyConflicts] = await Promise.all([
    headStatePromise,
    shareFilePromise,
    branchIsLocalPromise,
    dirtyPromise,
  ]);

  if (headState.detached) {
    return {
      detached: true,
      currentBranch: null,
      currentHeadSha: headState.currentHeadSha,
      shareFileExists,
      dirtyConflicts,
      branchIsLocal,
    };
  }
  return {
    detached: false,
    currentBranch: headState.currentBranch,
    currentHeadSha: null,
    shareFileExists,
    dirtyConflicts,
    branchIsLocal,
  };
}

export const BRANCH_INFO_HANDLER_TAG = 'git-branch-info';

export function isBranchResolutionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown revision|bad revision|ambiguous argument/i.test(message);
}
