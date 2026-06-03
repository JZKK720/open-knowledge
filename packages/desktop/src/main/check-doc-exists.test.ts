import { describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { checkDocExists } from './check-doc-exists.ts';

describe('checkDocExists', () => {
  function makeProject(): string {
    return mkdtempSync(join(tmpdir(), 'ok-check-doc-exists-'));
  }

  function cleanup(path: string): void {
    rmSync(path, { recursive: true, force: true });
  }

  test('returns exists for a regular file at a simple path', () => {
    const project = makeProject();
    try {
      writeFileSync(join(project, 'README.md'), '# hi\n');
      expect(checkDocExists(project, 'README.md')).toEqual('exists');
    } finally {
      cleanup(project);
    }
  });

  test('returns exists for a nested file via slashed path', () => {
    const project = makeProject();
    try {
      mkdirSync(join(project, 'docs', 'guides'), { recursive: true });
      writeFileSync(join(project, 'docs', 'guides', 'intro.md'), 'body\n');
      expect(checkDocExists(project, 'docs/guides/intro.md')).toEqual('exists');
    } finally {
      cleanup(project);
    }
  });

  test('returns missing when the file does not exist (ENOENT)', () => {
    const project = makeProject();
    try {
      expect(checkDocExists(project, 'README.md')).toEqual('missing');
    } finally {
      cleanup(project);
    }
  });

  test('returns missing when the path resolves to a directory', () => {
    const project = makeProject();
    try {
      mkdirSync(join(project, 'docs'), { recursive: true });
      expect(checkDocExists(project, 'docs')).toEqual('missing');
    } finally {
      cleanup(project);
    }
  });

  test('follows symlinks to a real file (returns exists)', () => {
    const project = makeProject();
    try {
      writeFileSync(join(project, 'real.md'), '# real\n');
      symlinkSync(join(project, 'real.md'), join(project, 'link.md'));
      expect(checkDocExists(project, 'link.md')).toEqual('exists');
    } finally {
      cleanup(project);
    }
  });

  test('returns unreadable for non-absolute projectPath', () => {
    expect(checkDocExists('relative/path', 'README.md')).toEqual('unreadable');
  });

  test('returns unreadable for empty projectPath', () => {
    expect(checkDocExists('', 'README.md')).toEqual('unreadable');
  });

  test('returns unreadable for projectPath containing a NUL byte', () => {
    expect(checkDocExists('/tmp/a\0b', 'README.md')).toEqual('unreadable');
  });

  test('returns unreadable for projectPath that resolves to a different path (`..` escape)', () => {
    expect(checkDocExists('/tmp/../etc', 'passwd')).toEqual('unreadable');
  });

  test('returns unreadable for empty docPath', () => {
    const project = makeProject();
    try {
      expect(checkDocExists(project, '')).toEqual('unreadable');
    } finally {
      cleanup(project);
    }
  });

  test('returns unreadable for absolute docPath', () => {
    const project = makeProject();
    try {
      writeFileSync(join(project, 'README.md'), '# hi\n');
      expect(checkDocExists(project, join(project, 'README.md'))).toEqual('unreadable');
    } finally {
      cleanup(project);
    }
  });

  test('returns unreadable for docPath with a NUL byte', () => {
    const project = makeProject();
    try {
      expect(checkDocExists(project, 'a\0b.md')).toEqual('unreadable');
    } finally {
      cleanup(project);
    }
  });

  test('returns unreadable for docPath containing a `..` segment', () => {
    const project = makeProject();
    try {
      writeFileSync(join(project, 'README.md'), '# hi\n');
      expect(checkDocExists(project, 'docs/../README.md')).toEqual('unreadable');
    } finally {
      cleanup(project);
    }
  });

  test('returns unreadable for docPath that escapes the project root (`../`)', () => {
    const project = makeProject();
    try {
      expect(checkDocExists(project, '../escape.md')).toEqual('unreadable');
    } finally {
      cleanup(project);
    }
  });

  test('does not confuse sibling-directory prefix matches with containment', () => {
    const parent = mkdtempSync(join(tmpdir(), 'ok-check-doc-exists-parent-'));
    try {
      const project = join(parent, 'proj');
      const sibling = join(parent, 'proj-evil');
      mkdirSync(project);
      mkdirSync(sibling);
      writeFileSync(join(sibling, 'file.md'), 'no\n');
      expect(checkDocExists(project, '../proj-evil/file.md')).toEqual('unreadable');
    } finally {
      cleanup(parent);
    }
  });

  test('returns missing when projectPath itself does not exist', () => {
    expect(
      checkDocExists('/tmp/definitely-does-not-exist-ok-test-12345/proj', 'README.md'),
    ).toEqual('missing');
  });

  test('handles unreadable directory (EACCES) as unreadable, not missing', () => {
    if (process.platform === 'win32' || process.getuid?.() === 0) return;
    const project = makeProject();
    try {
      mkdirSync(join(project, 'locked'), { recursive: true });
      writeFileSync(join(project, 'locked', 'file.md'), '# hi\n');
      chmodSync(join(project, 'locked'), 0o000);
      try {
        const result = checkDocExists(project, 'locked/file.md');
        expect(result).not.toEqual('missing');
      } finally {
        chmodSync(join(project, 'locked'), 0o755);
      }
    } finally {
      cleanup(project);
    }
  });
});
