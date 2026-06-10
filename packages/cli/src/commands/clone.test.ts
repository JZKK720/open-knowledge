import { afterEach, beforeEach, describe, expect, it, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { OK_DIR } from '../constants.ts';
import {
  buildCloneArgs,
  buildCloneEnv,
  cloneWithBranchFallback,
  ensureOkExcludedFromGit,
  isBranchNotFoundError,
  shouldSkipAuthForPublicRepo,
} from './clone.ts';

describe('buildCloneEnv', () => {
  test('inherits PATH and HOME from the source env', () => {
    const env = buildCloneEnv({ PATH: '/opt/homebrew/bin:/usr/bin', HOME: '/Users/me' });
    expect(env.PATH).toBe('/opt/homebrew/bin:/usr/bin');
    expect(env.HOME).toBe('/Users/me');
  });

  test('pins GIT_TERMINAL_PROMPT=0 and LANG/LC_ALL=C, overriding inherited locale', () => {
    const env = buildCloneEnv({ PATH: '/usr/bin', LANG: 'fr_FR.UTF-8', LC_ALL: 'fr_FR.UTF-8' });
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.LANG).toBe('C');
    expect(env.LC_ALL).toBe('C');
  });

  test('drops undefined entries (no `undefined` strings reach the child env)', () => {
    const env = buildCloneEnv({ PATH: '/usr/bin', SOME_UNSET: undefined });
    expect('SOME_UNSET' in env).toBe(false);
  });
});

describe('shouldSkipAuthForPublicRepo', () => {
  test('https + github.com + isPublic=true → true (anonymous clone path)', () => {
    expect(shouldSkipAuthForPublicRepo('https', 'github.com', true)).toBe(true);
  });

  test('https + github.com + isPublic=false → false (private, needs auth)', () => {
    expect(shouldSkipAuthForPublicRepo('https', 'github.com', false)).toBe(false);
  });

  test('https + GHES hostname + isPublic=true → false (GHES uses different auth posture)', () => {
    expect(shouldSkipAuthForPublicRepo('https', 'github.acme.com', true)).toBe(false);
  });

  test('hostname matches by exact equality, not endsWith — `evilgithub.com` does not bypass auth', () => {
    expect(shouldSkipAuthForPublicRepo('https', 'evilgithub.com', true)).toBe(false);
  });

  test('hostname matches by exact equality, not subdomain — `gist.github.com` does not bypass auth', () => {
    expect(shouldSkipAuthForPublicRepo('https', 'gist.github.com', true)).toBe(false);
  });

  test('ssh + github.com + isPublic=true → false (SSH keeps key material in play)', () => {
    expect(shouldSkipAuthForPublicRepo('ssh', 'github.com', true)).toBe(false);
  });

  test('git protocol + github.com + isPublic=true → false (only https opts in)', () => {
    expect(shouldSkipAuthForPublicRepo('git', 'github.com', true)).toBe(false);
  });
});

describe('ensureOkExcludedFromGit', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = resolve(
      tmpdir(),
      `clone-exclude-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, '.git', 'info'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns "no-exclude" when .git/info/exclude does not exist', () => {
    rmSync(join(testDir, '.git'), { recursive: true, force: true });
    expect(ensureOkExcludedFromGit(testDir)).toBe('no-exclude');
  });

  it('appends OK_DIR/ to a fresh exclude file with default git template', () => {
    const excludePath = join(testDir, '.git', 'info', 'exclude');
    const defaultTemplate = `# git ls-files --others --exclude-from=.git/info/exclude
# Lines that start with '#' are comments.
# For a project mostly in C, the following would be a good set of
# exclude patterns (uncomment them if you want to use them):
# *.[oa]
# *~
`;
    writeFileSync(excludePath, defaultTemplate, 'utf-8');

    expect(ensureOkExcludedFromGit(testDir)).toBe('appended');
    const after = readFileSync(excludePath, 'utf-8');
    expect(after).toContain(`${OK_DIR}/`);
    expect(after.startsWith(defaultTemplate)).toBe(true);
  });

  it('appends OK_DIR/ to an empty exclude file', () => {
    const excludePath = join(testDir, '.git', 'info', 'exclude');
    writeFileSync(excludePath, '', 'utf-8');

    expect(ensureOkExcludedFromGit(testDir)).toBe('appended');
    expect(readFileSync(excludePath, 'utf-8')).toBe(`${OK_DIR}/\n`);
  });

  it('inserts a newline before appending when existing file has no trailing newline', () => {
    const excludePath = join(testDir, '.git', 'info', 'exclude');
    writeFileSync(excludePath, '*.tmp', 'utf-8');

    expect(ensureOkExcludedFromGit(testDir)).toBe('appended');
    expect(readFileSync(excludePath, 'utf-8')).toBe(`*.tmp\n${OK_DIR}/\n`);
  });

  it('is idempotent — re-running returns "already-present"', () => {
    const excludePath = join(testDir, '.git', 'info', 'exclude');
    writeFileSync(excludePath, `${OK_DIR}/\n`, 'utf-8');

    expect(ensureOkExcludedFromGit(testDir)).toBe('already-present');
    expect(readFileSync(excludePath, 'utf-8')).toBe(`${OK_DIR}/\n`);
  });

  it('recognizes leading-slash and no-trailing-slash variants', () => {
    const excludePath = join(testDir, '.git', 'info', 'exclude');
    for (const variant of [OK_DIR, `/${OK_DIR}`, `/${OK_DIR}/`]) {
      writeFileSync(excludePath, `${variant}\n`, 'utf-8');
      expect(ensureOkExcludedFromGit(testDir)).toBe('already-present');
    }
  });

  it('writes to the COMMON-dir info/exclude when run inside a linked worktree (bug-fix case)', () => {
    const mainRepoDir = resolve(
      tmpdir(),
      `clone-exclude-main-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const linkedDir = resolve(
      tmpdir(),
      `clone-exclude-linked-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(mainRepoDir, { recursive: true });
    execFileSync('git', ['init', '--initial-branch=main'], {
      cwd: mainRepoDir,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: mainRepoDir });
    execFileSync('git', ['config', 'user.name', 'T'], { cwd: mainRepoDir });
    writeFileSync(join(mainRepoDir, 'README.md'), '# r\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: mainRepoDir });
    execFileSync('git', ['commit', '-m', 'init'], {
      cwd: mainRepoDir,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    execFileSync('git', ['worktree', 'add', '-b', 'feature', linkedDir], {
      cwd: mainRepoDir,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    try {
      const dotGit = readFileSync(join(linkedDir, '.git'), 'utf-8');
      expect(dotGit.startsWith('gitdir:')).toBe(true);

      const result = ensureOkExcludedFromGit(linkedDir);
      expect(result).toBe('appended');

      const mainExclude = readFileSync(join(mainRepoDir, '.git', 'info', 'exclude'), 'utf-8');
      expect(mainExclude).toContain(`${OK_DIR}/`);
    } finally {
      rmSync(linkedDir, { recursive: true, force: true });
      rmSync(mainRepoDir, { recursive: true, force: true });
    }
  });
});

describe('buildCloneArgs', () => {
  test('returns just --progress when no branch is given', () => {
    expect(buildCloneArgs(null)).toEqual(['--progress']);
    expect(buildCloneArgs(undefined)).toEqual(['--progress']);
  });

  test('appends -b <branch> when branch is given', () => {
    expect(buildCloneArgs('main')).toEqual(['--progress', '-b', 'main']);
  });

  test('passes slashed branches through verbatim (git accepts the slash form)', () => {
    expect(buildCloneArgs('feat/foo')).toEqual(['--progress', '-b', 'feat/foo']);
  });

  test('treats an empty-string branch as absent (defensive)', () => {
    expect(buildCloneArgs('')).toEqual(['--progress']);
  });
});

describe('cloneWithBranchFallback', () => {
  test('branch present + clone succeeds: no fallback, args include -b <branch>', async () => {
    const calls: string[][] = [];
    const fallbacks: string[] = [];
    const result = await cloneWithBranchFallback({
      branch: 'main',
      clone: async (args) => {
        calls.push(args);
      },
      onFallback: (b) => {
        fallbacks.push(b);
      },
    });
    expect(result).toEqual({ fellBack: false });
    expect(calls).toEqual([['--progress', '-b', 'main']]);
    expect(fallbacks).toEqual([]);
  });

  test('branch null: legacy path — no -b, single attempt', async () => {
    const calls: string[][] = [];
    const fallbacks: string[] = [];
    const result = await cloneWithBranchFallback({
      branch: null,
      clone: async (args) => {
        calls.push(args);
      },
      onFallback: (b) => {
        fallbacks.push(b);
      },
    });
    expect(result).toEqual({ fellBack: false });
    expect(calls).toEqual([['--progress']]);
    expect(fallbacks).toEqual([]);
  });

  test('branch present + Remote branch not found: emits fallback, retries without -b', async () => {
    const calls: string[][] = [];
    const fallbacks: string[] = [];
    let attempt = 0;
    const result = await cloneWithBranchFallback({
      branch: 'missing-branch',
      clone: async (args) => {
        calls.push(args);
        attempt += 1;
        if (attempt === 1) {
          throw new Error('fatal: Remote branch missing-branch not found in upstream origin');
        }
      },
      onFallback: (b) => {
        fallbacks.push(b);
      },
    });
    expect(result).toEqual({ fellBack: true });
    expect(calls).toEqual([['--progress', '-b', 'missing-branch'], ['--progress']]);
    expect(fallbacks).toEqual(['missing-branch']);
  });

  test('slashed branch (e.g. feat/foo) fallback works end-to-end', async () => {
    const calls: string[][] = [];
    const fallbacks: string[] = [];
    let attempt = 0;
    await cloneWithBranchFallback({
      branch: 'feat/foo',
      clone: async (args) => {
        calls.push(args);
        attempt += 1;
        if (attempt === 1) {
          throw new Error('fatal: Remote branch feat/foo not found in upstream origin');
        }
      },
      onFallback: (b) => {
        fallbacks.push(b);
      },
    });
    expect(calls[0]).toEqual(['--progress', '-b', 'feat/foo']);
    expect(calls[1]).toEqual(['--progress']);
    expect(fallbacks).toEqual(['feat/foo']);
  });

  test('onFallback fires BEFORE the retry so JSONL consumers see what was attempted', async () => {
    const ordering: string[] = [];
    await cloneWithBranchFallback({
      branch: 'missing',
      clone: async (args) => {
        if (args.includes('-b')) {
          ordering.push('first-attempt');
          throw new Error('Remote branch missing not found');
        }
        ordering.push('retry');
      },
      onFallback: () => {
        ordering.push('fallback-emitted');
      },
    });
    expect(ordering).toEqual(['first-attempt', 'fallback-emitted', 'retry']);
  });

  test('auth failure: re-thrown, no fallback retry', async () => {
    const calls: string[][] = [];
    const fallbacks: string[] = [];
    await expect(
      cloneWithBranchFallback({
        branch: 'main',
        clone: async (args) => {
          calls.push(args);
          throw new Error('fatal: Authentication failed for https://github.com/...');
        },
        onFallback: (b) => {
          fallbacks.push(b);
        },
      }),
    ).rejects.toThrow(/Authentication failed/);
    expect(calls).toEqual([['--progress', '-b', 'main']]);
    expect(fallbacks).toEqual([]);
  });

  test('network failure: re-thrown, no fallback retry', async () => {
    const calls: string[][] = [];
    await expect(
      cloneWithBranchFallback({
        branch: 'main',
        clone: async (args) => {
          calls.push(args);
          throw new Error('fatal: unable to access ...: Could not resolve host');
        },
        onFallback: () => {},
      }),
    ).rejects.toThrow(/Could not resolve host/);
    expect(calls).toEqual([['--progress', '-b', 'main']]);
  });

  test('branch null + non-branch error: re-thrown, no fallback (legacy path stays legacy)', async () => {
    await expect(
      cloneWithBranchFallback({
        branch: null,
        clone: async () => {
          throw new Error('Remote branch foo not found');
        },
        onFallback: () => {},
      }),
    ).rejects.toThrow(/Remote branch/);
  });
});

describe('isBranchNotFoundError', () => {
  test('matches simple-git remote-branch-not-found shape', () => {
    const err = new Error(
      'fatal: Remote branch missing-branch not found in upstream origin\nfatal: Could not find remote branch missing-branch to clone',
    );
    expect(isBranchNotFoundError(err)).toBe(true);
  });

  test('matches the message regardless of branch name', () => {
    expect(isBranchNotFoundError(new Error('Remote branch feat/foo not found'))).toBe(true);
  });

  test('matches the lowercase "couldn\'t find remote ref" message (git CLI variant)', () => {
    expect(
      isBranchNotFoundError(new Error("fatal: couldn't find remote ref refs/heads/feat/missing")),
    ).toBe(true);
  });

  test('matches the capitalized "Couldn\'t find remote ref" message', () => {
    expect(
      isBranchNotFoundError(new Error("fatal: Couldn't find remote ref refs/heads/feat/missing")),
    ).toBe(true);
  });

  test('does not match auth failures', () => {
    expect(
      isBranchNotFoundError(new Error('fatal: Authentication failed for https://github.com/...')),
    ).toBe(false);
  });

  test('does not match network errors', () => {
    expect(
      isBranchNotFoundError(new Error('fatal: unable to access ...: Could not resolve host')),
    ).toBe(false);
  });

  test('handles non-Error values without throwing', () => {
    expect(isBranchNotFoundError('Remote branch foo not found')).toBe(true);
    expect(isBranchNotFoundError(null)).toBe(false);
    expect(isBranchNotFoundError(undefined)).toBe(false);
  });
});
