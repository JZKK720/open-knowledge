
import type { ShareConstructUrlErrorCode } from '@inkeep/open-knowledge-core';
import { getLogger } from '../logger.ts';

export const SHARE_BASE_URL = 'https://openknowledge.ai/d/';

export const SHARE_CONSTRUCT_URL_HANDLER_TAG = 'share-construct-url';

export function isValidShareDocPath(docPath: string): boolean {
  if (docPath.length === 0) return false;
  if (docPath.startsWith('/') || docPath.startsWith('\\')) return false;
  for (const segment of docPath.split(/[/\\]/)) {
    if (segment === '..' || segment === '.git') return false;
    if (segment.length === 0) return false;
  }
  return true;
}

export function buildGitHubBlobUrl(
  owner: string,
  repo: string,
  branch: string,
  docPath: string,
): string {
  const encodedBranch = encodeURIComponent(branch);
  const encodedSegments = docPath.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${owner}/${repo}/blob/${encodedBranch}/${encodedSegments}`;
}

export function emitShareConstructUrlLog(
  result: 'ok' | ShareConstructUrlErrorCode,
  branchExists?: boolean,
): void {
  getLogger('share').info(
    { action: 'construct-url', result, ...(branchExists === undefined ? {} : { branchExists }) },
    'share action',
  );
}
