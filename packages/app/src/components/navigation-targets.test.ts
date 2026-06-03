import { describe, expect, test } from 'bun:test';
import { DOCUMENT_OPEN_BYTE_LIMIT } from '@inkeep/open-knowledge-core';
import {
  deriveKnownFolderPaths,
  docNameForNavigationTarget,
  downgradeFolderIndexForHashNav,
  largeFileNavigationTarget,
  resolveNavigationTarget,
  withLargeFileOpenGuard,
} from './navigation-targets';

describe('deriveKnownFolderPaths', () => {
  test('derives ancestor folders from admitted doc names', () => {
    const folderPaths = deriveKnownFolderPaths(new Set(['docs/index', 'reports/q1/REPORT']));

    expect(folderPaths).toEqual(new Set(['docs', 'reports', 'reports/q1']));
  });
});

describe('resolveNavigationTarget', () => {
  test('prefers an exact document over folder landing notes', () => {
    const resolved = resolveNavigationTarget('reports', {
      pages: new Set(['reports', 'reports/index', 'reports/reports']),
      folderPaths: new Set(['reports']),
    });

    expect(resolved).toEqual({
      kind: 'doc',
      target: 'reports',
      docName: 'reports',
    });
  });

  test('prefers an exact document over a folder with the same basename', () => {
    const resolved = resolveNavigationTarget('hello', {
      pages: new Set(['hello']),
      folderPaths: new Set(['hello']),
    });

    expect(resolved).toEqual({
      kind: 'doc',
      target: 'hello',
      docName: 'hello',
    });
  });

  test('uses trailing slash intent to open a folder with the same basename as a document', () => {
    const resolved = resolveNavigationTarget('hello/', {
      pages: new Set(['hello']),
      folderPaths: new Set(['hello']),
    });

    expect(resolved).toEqual({
      kind: 'folder',
      target: 'hello',
      folderPath: 'hello',
    });
  });

  test('resolves a canonical index note before a bare folder', () => {
    const resolved = resolveNavigationTarget('./reports/', {
      pages: new Set(['reports/index']),
    });

    expect(resolved).toEqual({
      kind: 'folder-index',
      target: 'reports',
      folderPath: 'reports',
      docName: 'reports/index',
      noteKind: 'canonical-index',
    });
  });

  test('falls back to the legacy folder note when no canonical index exists', () => {
    const resolved = resolveNavigationTarget('reports', {
      pages: new Set(['reports/reports']),
    });

    expect(resolved).toEqual({
      kind: 'folder-index',
      target: 'reports',
      folderPath: 'reports',
      docName: 'reports/reports',
      noteKind: 'legacy-folder-note',
    });
  });

  test('returns folder for a known folder with no landing note', () => {
    const resolved = resolveNavigationTarget('reports/', {
      pages: new Set(),
      folderPaths: new Set(['reports']),
    });

    expect(resolved).toEqual({
      kind: 'folder',
      target: 'reports',
      folderPath: 'reports',
    });
  });

  test('returns missing when neither a doc nor folder exists', () => {
    const resolved = resolveNavigationTarget('reports', {
      pages: new Set(['docs/index']),
    });

    expect(resolved).toEqual({
      kind: 'missing',
      target: 'reports',
    });
  });

  test('resolves a bare-name target to a same-basename file in a subfolder', () => {
    const resolved = resolveNavigationTarget('analysis', {
      pages: new Set(['andrew-data/project-x/analysis']),
      pagesByBasename: new Map([['analysis', 'andrew-data/project-x/analysis']]),
    });

    expect(resolved).toEqual({
      kind: 'doc',
      target: 'andrew-data/project-x/analysis',
      docName: 'andrew-data/project-x/analysis',
    });
  });

  test('basename match is slug-normalized so [[Project X]] resolves to subfolder/project-x', () => {
    const resolved = resolveNavigationTarget('Project X', {
      pages: new Set(['subfolder/project-x']),
      pagesByBasename: new Map([['project-x', 'subfolder/project-x']]),
    });

    expect(resolved).toEqual({
      kind: 'doc',
      target: 'subfolder/project-x',
      docName: 'subfolder/project-x',
    });
  });

  test('exact root match wins over a same-basename subfolder file', () => {
    const resolved = resolveNavigationTarget('analysis', {
      pages: new Set(['analysis', 'sub/analysis']),
      pagesByBasename: new Map([['analysis', 'sub/analysis']]),
    });

    expect(resolved).toEqual({
      kind: 'doc',
      target: 'analysis',
      docName: 'analysis',
    });
  });

  test('full-path slug match wins over basename', () => {
    const resolved = resolveNavigationTarget('sub-analysis', {
      pages: new Set(['Sub-Analysis', 'other/analysis']),
      pagesBySlug: new Map([
        ['sub-analysis', 'Sub-Analysis'],
        ['other-analysis', 'other/analysis'],
      ]),
      pagesByBasename: new Map([
        ['sub-analysis', 'Sub-Analysis'],
        ['analysis', 'other/analysis'],
      ]),
    });

    expect(resolved).toEqual({
      kind: 'doc',
      target: 'Sub-Analysis',
      docName: 'Sub-Analysis',
    });
  });

  test('canonical folder-index wins over basename', () => {
    const resolved = resolveNavigationTarget('reports', {
      pages: new Set(['reports/index', 'docs/reports']),
      pagesByBasename: new Map([
        ['index', 'reports/index'],
        ['reports', 'docs/reports'],
      ]),
    });

    expect(resolved).toEqual({
      kind: 'folder-index',
      target: 'reports',
      folderPath: 'reports',
      docName: 'reports/index',
      noteKind: 'canonical-index',
    });
  });

  test('legacy folder note wins over basename', () => {
    const resolved = resolveNavigationTarget('reports', {
      pages: new Set(['reports/reports', 'docs/reports']),
      pagesByBasename: new Map([['reports', 'docs/reports']]),
    });

    expect(resolved).toEqual({
      kind: 'folder-index',
      target: 'reports',
      folderPath: 'reports',
      docName: 'reports/reports',
      noteKind: 'legacy-folder-note',
    });
  });

  test('basename branch ignores path-shaped targets so [[sub/foo]] does not rewrite', () => {
    const resolved = resolveNavigationTarget('sub/foo', {
      pages: new Set(['other/foo']),
      pagesByBasename: new Map([['foo', 'other/foo']]),
    });

    expect(resolved).toEqual({
      kind: 'missing',
      target: 'sub/foo',
    });
  });

  test('basename wins over a bare-folder fallback so a file beats an empty container', () => {
    const resolved = resolveNavigationTarget('analysis', {
      pages: new Set(['analysis/sub', 'other/analysis']),
      folderPaths: new Set(['analysis', 'other']),
      pagesByBasename: new Map([
        ['sub', 'analysis/sub'],
        ['analysis', 'other/analysis'],
      ]),
    });

    expect(resolved).toEqual({
      kind: 'doc',
      target: 'other/analysis',
      docName: 'other/analysis',
    });
  });

  test('without pagesByBasename, bare-name target in subfolder remains missing (backward compat)', () => {
    const resolved = resolveNavigationTarget('analysis', {
      pages: new Set(['sub/analysis']),
    });

    expect(resolved).toEqual({
      kind: 'missing',
      target: 'analysis',
    });
  });
});

describe('docNameForNavigationTarget', () => {
  test('returns null for folder targets so folder navigation stays doc-free', () => {
    expect(
      docNameForNavigationTarget({
        kind: 'folder',
        target: 'reports',
        folderPath: 'reports',
      }),
    ).toBeNull();
  });

  test('returns the editable doc name for live and missing targets', () => {
    expect(
      docNameForNavigationTarget({
        kind: 'folder-index',
        target: 'reports',
        folderPath: 'reports',
        docName: 'reports/index',
        noteKind: 'canonical-index',
      }),
    ).toBe('reports/index');

    expect(
      docNameForNavigationTarget({
        kind: 'missing',
        target: 'reports/new-note',
      }),
    ).toBe('reports/new-note');
  });

  test('returns the represented doc name for large-file targets', () => {
    expect(
      docNameForNavigationTarget({
        kind: 'large-file',
        target: 'big',
        docName: 'big',
        size: 101,
        limit: 100,
      }),
    ).toBe('big');
  });
});

describe('large-file open guard', () => {
  test('rewrites an oversized document target to a non-opening large-file target', () => {
    expect(
      withLargeFileOpenGuard(
        {
          kind: 'doc',
          target: 'big',
          docName: 'big',
        },
        new Map([['big', { size: 101 }]]),
        100,
      ),
    ).toEqual({
      kind: 'large-file',
      target: 'big',
      docName: 'big',
      size: 101,
      limit: 100,
    });
  });

  test('passes through documents at the exact byte limit', () => {
    const target = {
      kind: 'doc',
      target: 'exact',
      docName: 'exact',
    } as const;

    expect(withLargeFileOpenGuard(target, new Map([['exact', { size: 100 }]]), 100)).toBe(target);
  });

  test('rewrites an oversized folder-index target to a large-file target', () => {
    expect(
      withLargeFileOpenGuard(
        {
          kind: 'folder-index',
          target: 'reports',
          folderPath: 'reports',
          docName: 'reports/index',
          noteKind: 'canonical-index',
        },
        new Map([['reports/index', { size: 101 }]]),
        100,
      ),
    ).toEqual({
      kind: 'large-file',
      target: 'reports/index',
      docName: 'reports/index',
      size: 101,
      limit: 100,
    });
  });

  test('blocks documents over the default cap', () => {
    const oversizedBytes = DOCUMENT_OPEN_BYTE_LIMIT + 1;

    expect(
      withLargeFileOpenGuard(
        {
          kind: 'doc',
          target: 'oversized',
          docName: 'oversized',
        },
        new Map([['oversized', { size: oversizedBytes }]]),
      ),
    ).toEqual({
      kind: 'large-file',
      target: 'oversized',
      docName: 'oversized',
      size: oversizedBytes,
      limit: DOCUMENT_OPEN_BYTE_LIMIT,
    });
  });

  test('largeFileNavigationTarget ignores missing metadata', () => {
    expect(largeFileNavigationTarget('unknown', undefined, 100)).toBeNull();
  });
});

describe('downgradeFolderIndexForHashNav', () => {
  test('rewrites a canonical-index target to its folder overview', () => {
    expect(
      downgradeFolderIndexForHashNav({
        kind: 'folder-index',
        target: 'reports',
        folderPath: 'reports',
        docName: 'reports/index',
        noteKind: 'canonical-index',
      }),
    ).toEqual({
      kind: 'folder',
      target: 'reports',
      folderPath: 'reports',
    });
  });

  test('rewrites a legacy-folder-note target to its folder overview', () => {
    expect(
      downgradeFolderIndexForHashNav({
        kind: 'folder-index',
        target: 'reports',
        folderPath: 'reports',
        docName: 'reports/reports',
        noteKind: 'legacy-folder-note',
      }),
    ).toEqual({
      kind: 'folder',
      target: 'reports',
      folderPath: 'reports',
    });
  });

  test('passes through non-folder-index targets unchanged', () => {
    const doc = { kind: 'doc', target: 'foo', docName: 'foo' } as const;
    expect(downgradeFolderIndexForHashNav(doc)).toBe(doc);

    const folder = { kind: 'folder', target: 'reports', folderPath: 'reports' } as const;
    expect(downgradeFolderIndexForHashNav(folder)).toBe(folder);

    const missing = { kind: 'missing', target: 'gone' } as const;
    expect(downgradeFolderIndexForHashNav(missing)).toBe(missing);
  });
});
