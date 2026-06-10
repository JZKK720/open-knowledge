import { describe, expect, test } from 'bun:test';
import { formatEntryCounts } from './PackCardGrid';

describe('formatEntryCounts() — card subtitle formatting', () => {
  test('renders "N files · N folders" for mixed packs', () => {
    expect(formatEntryCounts({ files: 4, folders: 3 })).toBe('4 files · 3 folders');
  });

  test('elides the file segment for folder-only packs', () => {
    expect(formatEntryCounts({ files: 0, folders: 2 })).toBe('2 folders');
  });

  test('singularizes when count is 1', () => {
    expect(formatEntryCounts({ files: 1, folders: 1 })).toBe('1 file · 1 folder');
  });
});
