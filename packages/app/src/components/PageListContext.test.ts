import { describe, expect, test } from 'bun:test';
import { mergePageSets, pruneConfirmedOptimisticPages } from './PageListContext';
import SRC from './PageListContext.tsx?raw';

describe('PageListContext helpers', () => {
  test('mergePageSets keeps optimistic created pages visible until server confirms them', () => {
    const merged = mergePageSets(new Set(['STORIES']), new Set(['Y']));
    expect([...merged].sort()).toEqual(['STORIES', 'Y']);
  });

  test('pruneConfirmedOptimisticPages removes pages once the server index includes them', () => {
    const pending = pruneConfirmedOptimisticPages(new Set(['Y', 'tim']), new Set(['Y', 'STORIES']));
    expect([...pending]).toEqual(['tim']);
  });
});

describe('PageListContext compiler-memoization preconditions', () => {
  test('no "use no memo" directive opts the file out of the React Compiler', () => {
    expect(SRC).not.toMatch(/['"]use no memo['"]/);
  });

  test('no hand-written useMemo / useCallback / memo (compiler covers it)', () => {
    expect(SRC).not.toMatch(/\buseMemo\s*\(/);
    expect(SRC).not.toMatch(/\buseCallback\s*\(/);
    expect(SRC).not.toMatch(/\bmemo\s*\(/);
    expect(SRC).not.toMatch(/from\s+['"]react['"][^;]*\b(useMemo|useCallback|memo)\b/);
  });

  test('per-render derivations exist and consume reactive state via top-level helpers', () => {
    expect(SRC).toMatch(
      /const\s+pages\s*=\s*mergePageSets\(\s*serverPages\s*,\s*optimisticPages\s*\)/,
    );
    expect(SRC).toMatch(
      /const\s+pageTitles\s*=\s*mergePageTitles\(\s*serverPageTitles\s*,\s*optimisticPages\s*\)/,
    );
    expect(SRC).toMatch(/const\s+folderPaths\s*=\s*new Set\(\[[\s\S]*?deriveKnownFolderPaths\(/);
    expect(SRC).toMatch(/const\s+pagesBySlug\s*=\s*buildPagesBySlugIndex\(\s*pages\s*,/);
    expect(SRC).toMatch(/const\s+pagesByBasename\s*=\s*buildPagesByBasenameIndex\(\s*pages\s*,/);
  });

  test('setPageListCache effect depends on every memoized derivation passed into the cache', () => {
    expect(SRC).toMatch(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?setPageListCache\([\s\S]*?\}\s*,\s*\[\s*pages\s*,\s*folderPaths\s*,\s*pagesBySlug\s*,\s*pagesByBasename\s*,\s*assetPaths\s*,\s*pageIcons\s*\]\s*\)/,
    );
  });

  test('setPageListCache object literal forwards pagesByBasename (not just the dep array)', () => {
    expect(SRC).toMatch(/setPageListCache\(\s*\{[\s\S]*?\bpagesByBasename\b[\s\S]*?\}\s*\)/);
  });
});
