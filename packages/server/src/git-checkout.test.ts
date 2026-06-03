import { describe, expect, test } from 'bun:test';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
  isBranchInOtherWorktreeError,
  isBranchNotFoundFetchError,
  runCheckoutFlow,
} from './git-checkout.ts';
import { createGitInstance } from './git-handle.ts';

const execFileAsync = promisify(execFile);

describe('isBranchNotFoundFetchError', () => {
  test('matches the lowercase "couldn\'t find remote ref" message', () => {
    expect(
      isBranchNotFoundFetchError(
        new Error("fatal: couldn't find remote ref refs/heads/feat/missing"),
      ),
    ).toBe(true);
  });

  test('matches the capitalized "Couldn\'t find remote ref" message', () => {
    expect(
      isBranchNotFoundFetchError(
        new Error("fatal: Couldn't find remote ref refs/heads/feat/missing"),
      ),
    ).toBe(true);
  });

  test('matches the older "Remote branch X not found" format', () => {
    expect(
      isBranchNotFoundFetchError(
        new Error('Remote branch missing-branch not found in upstream origin'),
      ),
    ).toBe(true);
  });

  test('rejects unrelated fetch failures (network unreachable)', () => {
    expect(
      isBranchNotFoundFetchError(
        new Error('fatal: unable to access https://example.com: Could not resolve host'),
      ),
    ).toBe(false);
  });

  test('rejects auth-denied failures', () => {
    expect(
      isBranchNotFoundFetchError(new Error('fatal: Authentication failed for https://example.com')),
    ).toBe(false);
  });

  test('rejects a French-locale translation of the branch-not-found message', () => {
    expect(
      isBranchNotFoundFetchError(
        new Error("fatal: n'a pas pu trouver de référence distante refs/heads/missing"),
      ),
    ).toBe(false);
    expect(
      isBranchNotFoundFetchError(
        new Error('fatal: konnte Remote-Referenz refs/heads/missing nicht finden'),
      ),
    ).toBe(false);
  });

  test('handles non-Error throwables', () => {
    expect(isBranchNotFoundFetchError("couldn't find remote ref refs/heads/x")).toBe(true);
    expect(isBranchNotFoundFetchError('random string')).toBe(false);
    expect(isBranchNotFoundFetchError(null)).toBe(false);
    expect(isBranchNotFoundFetchError(undefined)).toBe(false);
  });
});

describe('createGitInstance locale stabilization', () => {
  function readEnv(handle: ReturnType<typeof createGitInstance>): Record<string, string> {
    // biome-ignore lint/suspicious/noExplicitAny: probing internal simple-git executor for spawn-env assertion
    return ((handle.git as any)._executor?.env ?? {}) as Record<string, string>;
  }

  test('spawns git with LANG=C and LC_ALL=C so stderr stays English', () => {
    const handle = createGitInstance('/tmp');
    const env = readEnv(handle);
    expect(env.LANG).toBe('C');
    expect(env.LC_ALL).toBe('C');
  });

  test('preserves LANG/LC_ALL when GIT_INDEX_FILE is set', () => {
    const handle = createGitInstance('/tmp', { gitIndexFile: '.git/custom-index' });
    const env = readEnv(handle);
    expect(env.LANG).toBe('C');
    expect(env.LC_ALL).toBe('C');
    expect(env.GIT_INDEX_FILE).toBe('/tmp/.git/custom-index');
  });
});

describe('isBranchInOtherWorktreeError', () => {
  test('matches the canonical git stderr signature', () => {
    const result = isBranchInOtherWorktreeError(
      new Error("fatal: 'feat-bar' is already checked out at '/Users/.../wt/feat-bar'"),
    );
    expect(result).toEqual({ held: true, path: '/Users/.../wt/feat-bar' });
  });

  test('matches the newer "used by worktree at" phrasing (git version skew, e.g. Linux CI)', () => {
    const result = isBranchInOtherWorktreeError(
      new Error("fatal: 'feat-bar' is already used by worktree at '/tmp/x/wt-feat-bar'"),
    );
    expect(result).toEqual({ held: true, path: '/tmp/x/wt-feat-bar' });
  });

  test('matches slashed branch names like feat/foo/bar (FR11)', () => {
    const result = isBranchInOtherWorktreeError(
      new Error("fatal: 'feat/foo/bar' is already checked out at '/tmp/wt'"),
    );
    expect(result).toEqual({ held: true, path: '/tmp/wt' });
  });

  test('matches paths with spaces in them', () => {
    const result = isBranchInOtherWorktreeError(
      new Error("fatal: 'feat' is already checked out at '/Users/Me/My Repo/wt'"),
    );
    expect(result).toEqual({ held: true, path: '/Users/Me/My Repo/wt' });
  });

  test('truncates a path containing an apostrophe at the first inner quote (known limitation)', () => {
    const result = isBranchInOtherWorktreeError(
      new Error("fatal: 'feat' is already checked out at '/Users/me/it's-fine/wt'"),
    );
    expect(result).toEqual({ held: true, path: '/Users/me/it' });
  });

  test('returns held:false on a non-matching error message (fall-through to checkout-failed)', () => {
    expect(isBranchInOtherWorktreeError(new Error('Permission denied'))).toEqual({
      held: false,
    });
  });

  test('returns held:false on the dirty-tree git error', () => {
    expect(
      isBranchInOtherWorktreeError(
        new Error('error: Your local changes to the following files would be overwritten'),
      ),
    ).toEqual({ held: false });
  });

  test('returns held:false on a non-Error throwable', () => {
    expect(isBranchInOtherWorktreeError({ stderr: 'something' })).toEqual({ held: false });
    expect(isBranchInOtherWorktreeError(null)).toEqual({ held: false });
    expect(isBranchInOtherWorktreeError(undefined)).toEqual({ held: false });
  });

  test('returns held:false on empty path between quotes (defensive)', () => {
    expect(
      isBranchInOtherWorktreeError(new Error("fatal: 'feat' is already checked out at ''")),
    ).toEqual({ held: false });
  });
});

describe('runCheckoutFlow against real git', () => {
  async function git(cwd: string, ...args: string[]): Promise<void> {
    await execFileAsync('git', args, {
      cwd,
      env: { ...process.env, LANG: 'C', LC_ALL: 'C', GIT_CONFIG_GLOBAL: '/dev/null' },
    });
  }

  test('returns branch-in-other-worktree with otherWorktreePath when the branch is held in a linked worktree', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'checkout-bow-')));
    try {
      const main = join(root, 'main');
      mkdirSync(main);
      await git(main, 'init', '--initial-branch=main', '.');
      await git(main, 'config', 'user.email', 'test@example.com');
      await git(main, 'config', 'user.name', 'Test');
      writeFileSync(join(main, 'README.md'), '# main\n');
      await git(main, 'add', 'README.md');
      await git(main, 'commit', '-m', 'initial');
      const wt = join(root, 'wt-feat-bar');
      await git(main, 'worktree', 'add', '-b', 'feat-bar', wt);

      const outcome = await runCheckoutFlow(main, 'feat-bar');
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.reason).toBe('branch-in-other-worktree');
        expect(outcome.otherWorktreePath).toBe(wt);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('returns ok:true on a happy-path checkout (no regression)', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'checkout-ok-')));
    try {
      const main = root;
      await git(main, 'init', '--initial-branch=main', '.');
      await git(main, 'config', 'user.email', 'test@example.com');
      await git(main, 'config', 'user.name', 'Test');
      writeFileSync(join(main, 'README.md'), '# main\n');
      await git(main, 'add', 'README.md');
      await git(main, 'commit', '-m', 'initial');
      await git(main, 'branch', 'feat-bar');

      const outcome = await runCheckoutFlow(main, 'feat-bar');
      expect(outcome.ok).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
