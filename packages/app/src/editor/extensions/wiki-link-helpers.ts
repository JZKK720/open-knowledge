import { getHeadingSlug, toWikiLinkSlug } from '@inkeep/open-knowledge-core';
import type { PageListCacheSnapshot } from '../page-list-cache';

export { getHeadingSlug, toWikiLinkSlug };

type PagesLookupInput = ReadonlySet<string> | PageListCacheSnapshot;

function isSnapshot(input: PagesLookupInput): input is PageListCacheSnapshot {
  return 'pagesBySlug' in input;
}

function getPagesSet(input: PagesLookupInput): ReadonlySet<string> {
  return isSnapshot(input) ? input.pages : input;
}

function getAssetPathsSet(input: PagesLookupInput, assetPaths?: ReadonlySet<string>) {
  return isSnapshot(input) ? (input.assetPaths ?? new Set<string>()) : (assetPaths ?? new Set());
}

function getFilePathsSet(input: PagesLookupInput, filePaths?: ReadonlySet<string>) {
  return isSnapshot(input) ? (input.filePaths ?? new Set<string>()) : (filePaths ?? new Set());
}

function slugLookup(target: string, input: PagesLookupInput): string | undefined {
  const targetSlug = toWikiLinkSlug(target);
  if (!targetSlug) return undefined;
  if (isSnapshot(input)) {
    return input.pagesBySlug.get(targetSlug);
  }
  for (const page of input) {
    if (toWikiLinkSlug(page) === targetSlug) return page;
  }
  return undefined;
}

function basenameLookup(target: string, input: PagesLookupInput): string | undefined {
  if (target.includes('/')) return undefined;
  const targetSlug = toWikiLinkSlug(target);
  if (!targetSlug) return undefined;
  if (isSnapshot(input)) {
    return input.pagesByBasename?.get(targetSlug);
  }
  let bestMatch: string | undefined;
  for (const page of input) {
    const slash = page.lastIndexOf('/');
    const basename = slash === -1 ? page : page.slice(slash + 1);
    if (toWikiLinkSlug(basename) !== targetSlug) continue;
    if (bestMatch === undefined || page.localeCompare(bestMatch) < 0) bestMatch = page;
  }
  return bestMatch;
}

export function canUseTargetAsPathSegment(target: string): boolean {
  const trimmed = target.trim();
  return (
    trimmed.length > 0 &&
    !/[\\/\0<>:"|?*]/.test(trimmed) &&
    !/[. ]$/.test(trimmed) &&
    trimmed !== '.' &&
    trimmed !== '..'
  );
}

export function wikiLinkSuggestedFilename(target: string): string {
  const baseName = canUseTargetAsPathSegment(target) ? target.trim() : toWikiLinkSlug(target);
  return `${baseName}.md`;
}

export function buildUnresolvedWikiLinkAttrs(query: string): {
  target: string;
  alias: string | null;
  anchor: null;
} | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const slug = toWikiLinkSlug(trimmed);
  if (!slug) return null;

  return {
    target: slug,
    alias: slug === trimmed ? null : trimmed,
    anchor: null,
  };
}

export function getWikiLinkResolutionCandidates(target: string): string[] {
  const trimmed = target.trim();
  if (!trimmed) return [];
  const slug = toWikiLinkSlug(trimmed);
  return slug.length > 0 && slug !== trimmed ? [slug] : [];
}

export function resolveWikiLinkTargetDocName(
  target: string,
  input: PagesLookupInput,
): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) return undefined;
  const pages = getPagesSet(input);
  if (pages.has(trimmed)) return trimmed;
  const viaSlug = slugLookup(trimmed, input);
  if (viaSlug) return viaSlug;
  for (const candidate of getWikiLinkResolutionCandidates(trimmed)) {
    if (pages.has(candidate)) return candidate;
  }
  const folderIndexDocName = resolveFolderIndexDocName(trimmed, pages);
  if (folderIndexDocName) return folderIndexDocName;
  return basenameLookup(trimmed, input);
}

function resolveFolderIndexDocName(target: string, pages: ReadonlySet<string>): string | undefined {
  const canonical = `${target}/index`;
  if (pages.has(canonical)) return canonical;
  const slashIndex = target.lastIndexOf('/');
  const leaf = slashIndex === -1 ? target : target.slice(slashIndex + 1);
  const legacy = leaf ? `${target}/${leaf}` : null;
  if (legacy && pages.has(legacy)) return legacy;
  return undefined;
}

function normalizeAssetTarget(target: string): string {
  const trimmed = target.trim();
  const withoutHash = (trimmed.split('#')[0] ?? '').trim();
  const withoutQuery = (withoutHash.split('?')[0] ?? '').trim();
  return withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery;
}

export function resolveWikiLinkAssetTarget(
  target: string,
  assetPaths: ReadonlySet<string>,
  filePaths?: ReadonlySet<string>,
): string | null {
  const normalized = normalizeAssetTarget(target);
  if (!normalized) return null;

  const lowerTarget = normalized.toLowerCase();
  const partitions: ReadonlyArray<ReadonlySet<string>> = filePaths
    ? [assetPaths, filePaths]
    : [assetPaths];

  for (const partition of partitions) {
    if (partition.has(normalized)) return normalized;
    for (const path of partition) {
      if (path.toLowerCase() === lowerTarget) return path;
    }
  }

  if (normalized.includes('/')) return null;
  const matches: string[] = [];
  for (const partition of partitions) {
    for (const path of partition) {
      const slash = path.lastIndexOf('/');
      const basename = slash === -1 ? path : path.slice(slash + 1);
      if (basename.toLowerCase() === lowerTarget) matches.push(path);
    }
  }
  if (matches.length === 0) return null;
  return matches.sort((a, b) => a.localeCompare(b))[0] ?? null;
}

export function isResolvedWikiLinkTarget(
  target: string,
  pages: PagesLookupInput,
  assetPaths?: ReadonlySet<string>,
  filePaths?: ReadonlySet<string>,
): boolean {
  const trimmed = target.trim();
  if (!trimmed) return false;
  if (
    resolveWikiLinkAssetTarget(
      trimmed,
      getAssetPathsSet(pages, assetPaths),
      getFilePathsSet(pages, filePaths),
    )
  ) {
    return true;
  }

  const pagesSet = getPagesSet(pages);
  if (pagesSet.has(trimmed)) return true;

  if (getWikiLinkResolutionCandidates(trimmed).some((candidate) => pagesSet.has(candidate))) {
    return true;
  }

  if (slugLookup(trimmed, pages) !== undefined) return true;

  if (resolveFolderIndexDocName(trimmed, pagesSet)) return true;

  return basenameLookup(trimmed, pages) !== undefined;
}
