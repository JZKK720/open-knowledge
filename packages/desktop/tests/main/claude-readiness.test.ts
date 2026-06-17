import { describe, expect, test } from 'bun:test';
import {
  CLAUDE_PROBE_ARGS,
  interpretClaudeProbe,
  mcpStatusFromClassification,
  type ProbeChild,
  type ProbeTimers,
  resolveClaudeReadiness,
  runLoginShellProbe,
} from '../../src/main/claude-readiness.ts';

function makeFakeChild() {
  let exitCb: ((code: number | null) => void) | null = null;
  let errorCb: ((err: Error) => void) | null = null;
  let killed = false;
  const child: ProbeChild = {
    onExit: (cb) => {
      exitCb = cb;
    },
    onError: (cb) => {
      errorCb = cb;
    },
    kill: () => {
      killed = true;
    },
  };
  return {
    child,
    emitExit: (code: number | null) => exitCb?.(code),
    emitError: (err: Error) => errorCb?.(err),
    wasKilled: () => killed,
  };
}

function makeFakeTimers() {
  let scheduled: (() => void) | null = null;
  let cleared = false;
  const timers: ProbeTimers = {
    setTimer: (cb) => {
      scheduled = cb;
      return 'token';
    },
    clearTimer: () => {
      cleared = true;
    },
  };
  return { timers, fireTimeout: () => scheduled?.(), wasCleared: () => cleared };
}

describe('interpretClaudeProbe', () => {
  test('exit 0 → present', () => {
    expect(interpretClaudeProbe(0)).toBe('present');
  });
  test('non-zero exit → not-found (command -v ran, claude absent)', () => {
    expect(interpretClaudeProbe(1)).toBe('not-found');
    expect(interpretClaudeProbe(127)).toBe('not-found');
  });
  test('null (probe could not run) → unknown, NOT not-found', () => {
    expect(interpretClaudeProbe(null)).toBe('unknown');
  });
});

describe('mcpStatusFromClassification', () => {
  test('present → wired', () => {
    expect(mcpStatusFromClassification('present')).toBe('wired');
  });
  test('absent / no-entry / corrupt → needs-rewire', () => {
    expect(mcpStatusFromClassification('absent')).toBe('needs-rewire');
    expect(mcpStatusFromClassification('no-entry')).toBe('needs-rewire');
    expect(mcpStatusFromClassification('corrupt')).toBe('needs-rewire');
  });
});

describe('runLoginShellProbe', () => {
  test('spawns the supplied shell with the login-interactive command -v argv', async () => {
    const { child, emitExit } = makeFakeChild();
    const { timers } = makeFakeTimers();
    let spawnedFile = '';
    let spawnedArgs: readonly string[] = [];
    const p = runLoginShellProbe(
      (file, args) => {
        spawnedFile = file;
        spawnedArgs = args;
        return child;
      },
      '/bin/zsh',
      timers,
    );
    emitExit(0);
    await p;
    expect(spawnedFile).toBe('/bin/zsh');
    expect(spawnedArgs).toEqual(CLAUDE_PROBE_ARGS);
  });

  test('resolves the child exit code and clears the timeout', async () => {
    const { child, emitExit } = makeFakeChild();
    const { timers, wasCleared } = makeFakeTimers();
    const p = runLoginShellProbe(() => child, 'zsh', timers);
    emitExit(0);
    expect(await p).toBe(0);
    expect(wasCleared()).toBe(true);
  });

  test('a non-zero exit resolves that code (genuine not-found)', async () => {
    const { child, emitExit } = makeFakeChild();
    const { timers } = makeFakeTimers();
    const p = runLoginShellProbe(() => child, 'zsh', timers);
    emitExit(1);
    expect(await p).toBe(1);
  });

  test("an async spawn 'error' resolves null (UNKNOWN, not absent)", async () => {
    const { child, emitError } = makeFakeChild();
    const { timers, wasCleared } = makeFakeTimers();
    const p = runLoginShellProbe(() => child, 'zsh', timers);
    emitError(new Error('spawn zsh ENOENT'));
    expect(await p).toBe(null);
    expect(wasCleared()).toBe(true);
  });

  test('a synchronous spawn throw (EMFILE/ENOMEM) resolves null', async () => {
    const { timers } = makeFakeTimers();
    const p = runLoginShellProbe(
      () => {
        throw new Error('spawn EMFILE');
      },
      'zsh',
      timers,
    );
    expect(await p).toBe(null);
  });

  test('a timeout kills the child and resolves null', async () => {
    const { child, wasKilled } = makeFakeChild();
    const { timers, fireTimeout } = makeFakeTimers();
    const p = runLoginShellProbe(() => child, 'zsh', timers, 5000);
    fireTimeout();
    expect(await p).toBe(null);
    expect(wasKilled()).toBe(true);
  });

  test('only the first signal wins (exit after timeout is ignored)', async () => {
    const { child, emitExit } = makeFakeChild();
    const { timers, fireTimeout } = makeFakeTimers();
    const p = runLoginShellProbe(() => child, 'zsh', timers);
    fireTimeout();
    emitExit(0); // late — already settled to null
    expect(await p).toBe(null);
  });
});

describe('resolveClaudeReadiness', () => {
  test('claude present + mcp wired', async () => {
    const r = await resolveClaudeReadiness({
      probeClaude: () => Promise.resolve(0),
      classifyMcpEntry: () => 'present',
    });
    expect(r).toEqual({ claude: 'present', mcp: 'wired' });
  });

  test('claude not-found + mcp missing → needs-rewire', async () => {
    const r = await resolveClaudeReadiness({
      probeClaude: () => Promise.resolve(1),
      classifyMcpEntry: () => 'no-entry',
    });
    expect(r).toEqual({ claude: 'not-found', mcp: 'needs-rewire' });
  });

  test('probe-null surfaces as claude unknown (mcp still resolves)', async () => {
    const r = await resolveClaudeReadiness({
      probeClaude: () => Promise.resolve(null),
      classifyMcpEntry: () => 'present',
    });
    expect(r).toEqual({ claude: 'unknown', mcp: 'wired' });
  });

  test('a rejected probe degrades to claude unknown, never crashes', async () => {
    const r = await resolveClaudeReadiness({
      probeClaude: () => Promise.reject(new Error('boom')),
      classifyMcpEntry: () => 'present',
    });
    expect(r.claude).toBe('unknown');
  });

  test('a throwing classify degrades to needs-rewire, never crashes', async () => {
    const r = await resolveClaudeReadiness({
      probeClaude: () => Promise.resolve(0),
      classifyMcpEntry: () => {
        throw new Error('claude.json read blew up');
      },
    });
    expect(r).toEqual({ claude: 'present', mcp: 'needs-rewire' });
  });
});
