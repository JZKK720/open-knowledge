import { describe, expect, test } from 'bun:test';
import {
  anchorFromHash,
  assetPathFromHash,
  docNameFromHash,
  hashFromAssetPath,
  hashFromDocName,
  hashFromFolderPath,
} from './doc-hash';

describe('docNameFromHash', () => {
  test('returns null for empty hash', () => {
    expect(docNameFromHash('')).toBeNull();
  });

  test('returns null for bare #/', () => {
    expect(docNameFromHash('#/')).toBeNull();
  });

  test('returns null for non-#/ hash', () => {
    expect(docNameFromHash('#heading')).toBeNull();
  });

  test('parses simple doc name', () => {
    expect(docNameFromHash('#/README')).toBe('README');
  });

  test('parses nested path', () => {
    expect(docNameFromHash('#/folder/sub/page')).toBe('folder/sub/page');
  });

  test('preserves trailing slash for folder intent', () => {
    expect(docNameFromHash('#/folder/sub/')).toBe('folder/sub/');
  });

  test('strips query string', () => {
    expect(docNameFromHash('#/doc?branch=feature')).toBe('doc');
  });

  test('strips browser-style anchor fragment', () => {
    expect(docNameFromHash('#/doc#heading')).toBe('doc');
  });

  test('strips query string from nested path', () => {
    expect(docNameFromHash('#/folder/doc?branch=feature&foo=bar')).toBe('folder/doc');
  });

  test('strips browser-style anchor fragment from nested path', () => {
    expect(docNameFromHash('#/folder/doc#heading')).toBe('folder/doc');
  });

  test('decodes percent-encoded spaces', () => {
    expect(docNameFromHash('#/My%20Notes/draft')).toBe('My Notes/draft');
  });

  test('decodes non-ASCII (em dash)', () => {
    expect(docNameFromHash('#/Ideas%20%E2%80%94%202026/draft')).toBe('Ideas — 2026/draft');
  });

  test('falls back on malformed encoding', () => {
    expect(docNameFromHash('#/bad%ZZpath')).toBe('bad%ZZpath');
  });

  test('malformed segment falls back to entire raw string', () => {
    expect(docNameFromHash('#/good%20segment/%ZZ/other')).toBe('good%20segment/%ZZ/other');
  });
});

describe('anchorFromHash', () => {
  test('returns null for hashes outside document routing', () => {
    expect(anchorFromHash('')).toBeNull();
    expect(anchorFromHash('#heading')).toBeNull();
    expect(anchorFromHash('#/doc')).toBeNull();
  });

  test('ignores query-param anchors', () => {
    expect(anchorFromHash('#/doc?anchor=heading')).toBeNull();
    expect(anchorFromHash('#/doc?foo=bar&anchor=heading')).toBeNull();
  });

  test('parses browser-style anchor fragment', () => {
    expect(anchorFromHash('#/ARCHITECTURE#the-problem')).toBe('the-problem');
  });

  test('decodes browser-style anchor fragment', () => {
    expect(anchorFromHash('#/doc#hello%20world')).toBe('hello world');
  });

  test('returns null for empty browser-style fragment', () => {
    expect(anchorFromHash('#/doc#')).toBeNull();
  });

  test('falls back to raw string on malformed fragment encoding', () => {
    expect(anchorFromHash('#/doc#bad%ZZencoding')).toBe('bad%ZZencoding');
  });

  test('uses fragment anchor when query params are also present', () => {
    expect(anchorFromHash('#/doc?anchor=query-anchor#fragment-anchor')).toBe('fragment-anchor');
  });

  test('asset hashes do not parse as anchor hashes', () => {
    expect(anchorFromHash(hashFromAssetPath('docs/photo.png'))).toBeNull();
  });
});

describe('hashFromDocName', () => {
  test('no anchor', () => {
    expect(hashFromDocName('README')).toBe('#/README');
  });

  test('with anchor', () => {
    expect(hashFromDocName('docs/guide', 'install')).toBe('#/docs/guide#install');
  });

  test('encodes anchor with special characters', () => {
    expect(hashFromDocName('doc', 'hello world')).toBe('#/doc#hello%20world');
  });

  test('null anchor produces no fragment', () => {
    expect(hashFromDocName('doc', null)).toBe('#/doc');
  });
});

describe('hashFromFolderPath', () => {
  test('adds a trailing slash', () => {
    expect(hashFromFolderPath('docs/guide')).toBe('#/docs/guide/');
  });

  test('does not duplicate a trailing slash', () => {
    expect(hashFromFolderPath('docs/guide/')).toBe('#/docs/guide/');
  });

  test('encodes anchor with special characters', () => {
    expect(hashFromFolderPath('docs/guide', 'hello world')).toBe('#/docs/guide/#hello%20world');
  });
});

describe('asset hash helpers', () => {
  test('round-trips nested asset paths', () => {
    const hash = hashFromAssetPath('docs/My Photo.png');
    expect(hash).toBe('#/__asset__/docs/My%20Photo.png');
    expect(assetPathFromHash(hash)).toBe('docs/My Photo.png');
  });

  test('asset hashes do not parse as doc hashes', () => {
    expect(docNameFromHash(hashFromAssetPath('docs/photo.png'))).toBeNull();
  });
});
