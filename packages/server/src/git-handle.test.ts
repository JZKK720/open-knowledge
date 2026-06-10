import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { buildGitEnv, createGitInstance } from './git-handle.ts';
import { withParentLock } from './git-mutex.ts';

describe('buildGitEnv', () => {
  function withEnv(key: string, value: string | undefined, fn: () => void): void {
    const saved = process.env[key];
    try {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      fn();
    } finally {
      if (saved === undefined) delete process.env[key];
      else process.env[key] = saved;
    }
  }

  test('forces LANG/LC_ALL=C for locale-stable stderr', () => {
    const env = buildGitEnv();
    expect(env.LANG).toBe('C');
    expect(env.LC_ALL).toBe('C');
  });

  test('disables terminal prompts (no-TTY server-spawned git)', () => {
    expect(buildGitEnv().GIT_TERMINAL_PROMPT).toBe('0');
  });

  test('preserves PATH so a bare-command credential helper resolves', () => {
    withEnv('PATH', '/custom/bin:/usr/bin', () => {
      expect(buildGitEnv().PATH).toBe('/custom/bin:/usr/bin');
    });
  });

  test('preserves ELECTRON_RUN_AS_NODE so the packaged credential helper runs as Node', () => {
    withEnv('ELECTRON_RUN_AS_NODE', '1', () => {
      expect(buildGitEnv().ELECTRON_RUN_AS_NODE).toBe('1');
    });
  });

  test('omits ELECTRON_RUN_AS_NODE on a non-Electron host (var unset)', () => {
    withEnv('ELECTRON_RUN_AS_NODE', undefined, () => {
      expect('ELECTRON_RUN_AS_NODE' in buildGitEnv()).toBe(false);
    });
  });
});

describe('createGitInstance (credential.helper config)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ok-git-handle-test-'));
    execSync('git init -q', { cwd: tmpDir });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('accepts credential.helper config without throwing', async () => {
    const handle = createGitInstance(tmpDir, {
      credentialArgs: ['-c', 'credential.helper=!open-knowledge auth git-credential'],
    });
    const version = await handle.git.raw(['--version']);
    expect(version).toContain('git version');
  });
});

describe('withParentLock', () => {
  test('serializes concurrent operations in enqueue order', async () => {
    const order: number[] = [];

    await Promise.all([
      withParentLock(async () => {
        await wait(10);
        order.push(1);
      }),
      withParentLock(async () => {
        order.push(2);
      }),
      withParentLock(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  test('continues after a failed task', async () => {
    const results: string[] = [];

    await Promise.allSettled([
      withParentLock(async () => {
        throw new Error('task 1 failed');
      }),
      withParentLock(async () => {
        results.push('task 2');
      }),
    ]);

    expect(results).toContain('task 2');
  });

  test('returns the resolved value', async () => {
    const result = await withParentLock(async () => 42);
    expect(result).toBe(42);
  });

  test('propagates errors to caller', async () => {
    await expect(
      withParentLock(async () => {
        throw new Error('deliberate failure');
      }),
    ).rejects.toThrow('deliberate failure');
  });
});

void beforeEach;
void afterEach;
