import { describe, expect, test } from 'bun:test';

import {
  isBranchResolutionError,
  isValidBranchInfoDocPath,
  isValidBranchName,
} from './git-branch-info.ts';

describe('isValidBranchName', () => {
  test('accepts a plain branch name', () => {
    expect(isValidBranchName('main')).toBe(true);
  });

  test('accepts a namespaced branch name with forward-slashes', () => {
    expect(isValidBranchName('feat/foo')).toBe(true);
  });

  test('rejects a leading dash (flag injection)', () => {
    expect(isValidBranchName('-evil')).toBe(false);
  });

  test('rejects leading whitespace', () => {
    expect(isValidBranchName(' main')).toBe(false);
  });

  test('rejects trailing whitespace', () => {
    expect(isValidBranchName('main ')).toBe(false);
  });

  test('rejects control characters', () => {
    expect(isValidBranchName('main\nfoo')).toBe(false);
    expect(isValidBranchName('main\x00foo')).toBe(false);
  });

  test('rejects non-string inputs', () => {
    expect(isValidBranchName(null)).toBe(false);
    expect(isValidBranchName(undefined)).toBe(false);
    expect(isValidBranchName(123)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidBranchName('')).toBe(false);
  });

  test('rejects colon (refspec injection: HEAD:refs/heads/evil)', () => {
    expect(isValidBranchName('HEAD:refs/heads/evil')).toBe(false);
    expect(isValidBranchName('foo:bar')).toBe(false);
  });

  test('rejects `..` segment (symmetric with CheckoutRequestSchema)', () => {
    expect(isValidBranchName('feat/../escape')).toBe(false);
    expect(isValidBranchName('..')).toBe(false);
  });
});

describe('isValidBranchInfoDocPath', () => {
  test('accepts a single-segment doc path', () => {
    expect(isValidBranchInfoDocPath('README.md')).toBe(true);
  });

  test('accepts a nested forward-slash doc path', () => {
    expect(isValidBranchInfoDocPath('docs/sub/page.md')).toBe(true);
  });

  test('rejects a leading forward-slash (absolute path)', () => {
    expect(isValidBranchInfoDocPath('/etc/passwd')).toBe(false);
  });

  test('rejects any backslash — wire contract is forward-slash only', () => {
    expect(isValidBranchInfoDocPath('docs\\page.md')).toBe(false);
    expect(isValidBranchInfoDocPath('\\etc\\passwd')).toBe(false);
    expect(isValidBranchInfoDocPath('foo/bar\\baz.md')).toBe(false);
  });

  test('rejects `..` traversal segment', () => {
    expect(isValidBranchInfoDocPath('docs/../etc/passwd')).toBe(false);
  });

  test('rejects `.git` segment (exact match, not `.gitignore`)', () => {
    expect(isValidBranchInfoDocPath('.git/HEAD')).toBe(false);
    expect(isValidBranchInfoDocPath('foo/.git/config')).toBe(false);
    expect(isValidBranchInfoDocPath('.gitignore')).toBe(true);
    expect(isValidBranchInfoDocPath('.github/foo.md')).toBe(true);
  });

  test('rejects consecutive slashes (empty segment)', () => {
    expect(isValidBranchInfoDocPath('docs//page.md')).toBe(false);
  });

  test('rejects control characters', () => {
    expect(isValidBranchInfoDocPath('docs/\npage.md')).toBe(false);
    expect(isValidBranchInfoDocPath('docs/\x00.md')).toBe(false);
  });

  test('rejects non-string inputs', () => {
    expect(isValidBranchInfoDocPath(null)).toBe(false);
    expect(isValidBranchInfoDocPath(undefined)).toBe(false);
    expect(isValidBranchInfoDocPath(123)).toBe(false);
  });

  test('rejects empty string', () => {
    expect(isValidBranchInfoDocPath('')).toBe(false);
  });
});

describe('isBranchResolutionError', () => {
  test('matches simple-git "unknown revision" failure (target ref not local)', () => {
    expect(
      isBranchResolutionError(
        new Error(
          "fatal: ambiguous argument 'HEAD..feat/missing': unknown revision or path not in the working tree.",
        ),
      ),
    ).toBe(true);
  });

  test('matches simple-git "bad revision" failure', () => {
    expect(isBranchResolutionError(new Error("fatal: bad revision 'HEAD..feat/missing'"))).toBe(
      true,
    );
  });

  test('matches the bare "ambiguous argument" form', () => {
    expect(isBranchResolutionError(new Error('fatal: ambiguous argument HEAD..foo'))).toBe(true);
  });

  test('rejects disk I/O failures (EACCES on .git/index)', () => {
    expect(
      isBranchResolutionError(
        new Error('error: cannot open .git/index: Permission denied (EACCES)'),
      ),
    ).toBe(false);
  });

  test('rejects git-binary-missing failures', () => {
    expect(isBranchResolutionError(new Error('spawn git ENOENT'))).toBe(false);
  });

  test('rejects "not a git repository" failures', () => {
    expect(
      isBranchResolutionError(new Error('fatal: not a git repository (or any parent up)')),
    ).toBe(false);
  });

  test('handles non-Error throwables', () => {
    expect(isBranchResolutionError('fatal: unknown revision HEAD..foo')).toBe(true);
    expect(isBranchResolutionError('random string')).toBe(false);
    expect(isBranchResolutionError(null)).toBe(false);
    expect(isBranchResolutionError(undefined)).toBe(false);
  });
});
