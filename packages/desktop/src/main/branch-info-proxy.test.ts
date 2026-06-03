import { describe, expect, test } from 'bun:test';

import type { BranchInfoResponse, CheckoutResponse } from '@inkeep/open-knowledge-core';
import { RUNTIME_VERSION } from '@inkeep/open-knowledge-server';

import {
  type BranchInfoProxyDeps,
  proxyAwaitBranchSwitched,
  proxyFetchBranchInfo,
  proxyRunCheckout,
  resolveProjectServerOrigin,
  type ServerLockReadShape,
} from './branch-info-proxy';

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const h = init?.headers;
  if (h instanceof Headers) return h.get(name) ?? undefined;
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name)?.[1];
  if (h) return (h as Record<string, string>)[name];
  return undefined;
}

function buildDeps(overrides: Partial<BranchInfoProxyDeps> = {}): BranchInfoProxyDeps {
  return {
    readServerLock: () => ({ pid: 4242, port: 12345 }) satisfies ServerLockReadShape,
    isProcessAlive: () => true,
    fetch: (async () => new Response(null, { status: 500 })) as typeof fetch,
    pollIntervalMs: 5,
    pollTimeoutMs: 25,
    requestTimeoutMs: 200,
    ...overrides,
  };
}

const validBranchInfo: BranchInfoResponse = {
  currentBranch: 'main',
  currentHeadSha: null,
  detached: false,
  shareFileExists: true,
  dirtyConflicts: { conflicts: false, files: [] },
  branchIsLocal: true,
};

describe('resolveProjectServerOrigin', () => {
  test('returns http origin when the lock is live', async () => {
    const origin = await resolveProjectServerOrigin('/tmp/p', buildDeps());
    expect(origin).toBe('http://localhost:12345');
  });

  test('returns null when no lock is present after the poll window', async () => {
    const origin = await resolveProjectServerOrigin(
      '/tmp/p',
      buildDeps({ readServerLock: () => null }),
    );
    expect(origin).toBeNull();
  });

  test('returns null when port is zero (server still booting)', async () => {
    const origin = await resolveProjectServerOrigin(
      '/tmp/p',
      buildDeps({ readServerLock: () => ({ pid: 4242, port: 0 }) }),
    );
    expect(origin).toBeNull();
  });

  test('returns null when the lock-holding pid is dead', async () => {
    const origin = await resolveProjectServerOrigin(
      '/tmp/p',
      buildDeps({ isProcessAlive: () => false }),
    );
    expect(origin).toBeNull();
  });

  test('eventually picks up a lock that lands after the first poll', async () => {
    let calls = 0;
    const deps = buildDeps({
      readServerLock: () => {
        calls += 1;
        return calls >= 3 ? { pid: 1, port: 9999 } : null;
      },
    });
    const origin = await resolveProjectServerOrigin('/tmp/p', deps);
    expect(origin).toBe('http://localhost:9999');
    expect(calls).toBeGreaterThanOrEqual(3);
  });
});

describe('proxyFetchBranchInfo', () => {
  test('returns the validated response on a 200 with the expected shape', async () => {
    const fetchMock: typeof fetch = (async (input) => {
      const url = String(input);
      expect(url).toMatch(/branch-info\?.*branch=feat%2Ffoo/);
      expect(url).toMatch(/path=docs%2Ffoo\.md/);
      return new Response(JSON.stringify(validBranchInfo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const result = await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'feat/foo', docPath: 'docs/foo.md' },
      buildDeps({ fetch: fetchMock }),
    );
    expect(result).toEqual(validBranchInfo);
  });

  test('sends client version headers (kind=desktop-main) on the branch-info GET', async () => {
    let seen: RequestInit | undefined;
    const fetchMock: typeof fetch = (async (_input, init) => {
      seen = init;
      return new Response(JSON.stringify(validBranchInfo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'main', docPath: 'a.md' },
      buildDeps({ fetch: fetchMock }),
    );
    expect(headerOf(seen, 'x-ok-client-protocol')).toBe('1');
    expect(headerOf(seen, 'x-ok-client-kind')).toBe('desktop-main');
    expect(headerOf(seen, 'x-ok-client-runtime')).toBe(RUNTIME_VERSION);
  });

  test('returns null when the server returns non-2xx', async () => {
    const result = await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'main', docPath: 'a.md' },
      buildDeps({ fetch: (async () => new Response(null, { status: 500 })) as typeof fetch }),
    );
    expect(result).toBeNull();
  });

  test('returns null when the response shape is invalid', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify({ bogus: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'main', docPath: 'a.md' },
      buildDeps({ fetch: fetchMock }),
    );
    expect(result).toBeNull();
  });

  test('returns null when the server lock never resolves', async () => {
    const result = await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'main', docPath: 'a.md' },
      buildDeps({ readServerLock: () => null }),
    );
    expect(result).toBeNull();
  });

  test('returns null when fetch throws (network error / timeout)', async () => {
    const result = await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'main', docPath: 'a.md' },
      buildDeps({
        fetch: (async () => {
          throw new Error('boom');
        }) as typeof fetch,
      }),
    );
    expect(result).toBeNull();
  });
});

describe('proxyRunCheckout', () => {
  test('serializes branch in the JSON body and validates the success shape', async () => {
    let capturedBody: string | undefined;
    let capturedInit: RequestInit | undefined;
    const fetchMock: typeof fetch = (async (_url, init) => {
      capturedBody = String(init?.body ?? '');
      capturedInit = init;
      const okBody: CheckoutResponse = { ok: true };
      return new Response(JSON.stringify(okBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const result = await proxyRunCheckout(
      { projectPath: '/tmp/p', branch: 'feat/foo' },
      buildDeps({ fetch: fetchMock }),
    );
    expect(result).toEqual({ ok: true });
    expect(capturedBody).toBeDefined();
    expect(JSON.parse(capturedBody as string)).toEqual({ branch: 'feat/foo' });
    expect(headerOf(capturedInit, 'x-ok-client-kind')).toBe('desktop-main');
    expect(headerOf(capturedInit, 'content-type')).toBe('application/json');
  });

  test('returns the discriminated dirty-conflict shape verbatim', async () => {
    const body: CheckoutResponse = {
      ok: false,
      reason: 'dirty-conflict',
      files: ['a.md', 'b.md'],
    };
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyRunCheckout(
      { projectPath: '/tmp/p', branch: 'main' },
      buildDeps({ fetch: fetchMock }),
    );
    expect(result).toEqual(body);
  });

  test('returns null when the schema rejects an unknown failure reason', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify({ ok: false, reason: 'mystery' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyRunCheckout(
      { projectPath: '/tmp/p', branch: 'main' },
      buildDeps({ fetch: fetchMock }),
    );
    expect(result).toBeNull();
  });
});

describe('proxyAwaitBranchSwitched', () => {
  test('resolves with match when the first server-info poll already shows the expected branch', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify({ serverInstanceId: 'sid', currentBranch: 'feat/foo' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'feat/foo', timeoutMs: 200 },
      buildDeps({ fetch: fetchMock, pollIntervalMs: 5 }),
    );
    expect(result).toEqual({ ok: true });
  });

  test('polls until the server-info currentBranch matches', async () => {
    let polls = 0;
    const fetchMock: typeof fetch = (async () => {
      polls += 1;
      const currentBranch = polls >= 3 ? 'feat/foo' : 'main';
      return new Response(JSON.stringify({ serverInstanceId: 'sid', currentBranch }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'feat/foo', timeoutMs: 2_000 },
      buildDeps({ fetch: fetchMock, pollIntervalMs: 5 }),
    );
    expect(result).toEqual({ ok: true });
    expect(polls).toBeGreaterThanOrEqual(3);
  });

  test('resolves with timeout when no poll matches before the deadline', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify({ serverInstanceId: 'sid', currentBranch: 'main' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'feat/foo', timeoutMs: 50 },
      buildDeps({ fetch: fetchMock, pollIntervalMs: 5 }),
    );
    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });

  test('resolves with project-not-open when the server lock never resolves', async () => {
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'feat/foo', timeoutMs: 50 },
      buildDeps({ readServerLock: () => null }),
    );
    expect(result).toEqual({ ok: false, reason: 'project-not-open' });
  });

  test('treats non-2xx server-info responses as not-yet-matched (keeps polling, eventually times out)', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(null, { status: 500 })) as typeof fetch;
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'feat/foo', timeoutMs: 50 },
      buildDeps({ fetch: fetchMock, pollIntervalMs: 5 }),
    );
    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });

  test('treats malformed server-info responses as not-yet-matched (transient skew)', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify({ bogus: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'feat/foo', timeoutMs: 50 },
      buildDeps({ fetch: fetchMock, pollIntervalMs: 5 }),
    );
    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });

  test('preserves slashed branch names verbatim in the comparison', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify({ serverInstanceId: 'sid', currentBranch: 'release/v1.2.3' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'release/v1.2.3', timeoutMs: 200 },
      buildDeps({ fetch: fetchMock, pollIntervalMs: 5 }),
    );
    expect(result).toEqual({ ok: true });
  });
});

describe('AbortSignal cancellation', () => {
  test('resolveProjectServerOrigin bails early when the signal aborts mid-poll', async () => {
    const controller = new AbortController();
    let calls = 0;
    const deps = buildDeps({
      readServerLock: () => {
        calls += 1;
        if (calls === 2) controller.abort();
        return null;
      },
      pollIntervalMs: 1,
      pollTimeoutMs: 10_000,
    });
    const start = Date.now();
    const origin = await resolveProjectServerOrigin('/tmp/p', deps, controller.signal);
    const elapsed = Date.now() - start;
    expect(origin).toBeNull();
    expect(elapsed).toBeLessThan(500);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test('resolveProjectServerOrigin returns null synchronously when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    const deps = buildDeps({
      readServerLock: () => {
        calls += 1;
        return null;
      },
      pollTimeoutMs: 10_000,
    });
    const origin = await resolveProjectServerOrigin('/tmp/p', deps, controller.signal);
    expect(origin).toBeNull();
    expect(calls).toBe(0);
  });

  test('proxyFetchBranchInfo returns null without fetching when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let fetchCalls = 0;
    const result = await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'main', docPath: 'a.md' },
      buildDeps({
        fetch: (async () => {
          fetchCalls += 1;
          return new Response(JSON.stringify(validBranchInfo), { status: 200 });
        }) as typeof fetch,
      }),
      controller.signal,
    );
    expect(result).toBeNull();
    expect(fetchCalls).toBe(0);
  });

  test('proxyRunCheckout returns null without fetching when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let fetchCalls = 0;
    const result = await proxyRunCheckout(
      { projectPath: '/tmp/p', branch: 'main' },
      buildDeps({
        fetch: (async () => {
          fetchCalls += 1;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }) as typeof fetch,
      }),
      controller.signal,
    );
    expect(result).toBeNull();
    expect(fetchCalls).toBe(0);
  });

  test('proxyAwaitBranchSwitched terminates with timeout when the signal aborts mid-poll', async () => {
    const controller = new AbortController();
    let polls = 0;
    const fetchMock: typeof fetch = (async () => {
      polls += 1;
      if (polls === 2) controller.abort();
      return new Response(JSON.stringify({ serverInstanceId: 'sid', currentBranch: 'main' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    const start = Date.now();
    const result = await proxyAwaitBranchSwitched(
      { projectPath: '/tmp/p', branch: 'feat/foo', timeoutMs: 10_000 },
      buildDeps({ fetch: fetchMock, pollIntervalMs: 1 }),
      controller.signal,
    );
    const elapsed = Date.now() - start;
    expect(result).toEqual({ ok: false, reason: 'timeout' });
    expect(elapsed).toBeLessThan(500);
  });

  test('proxy functions work normally without a signal (back-compat)', async () => {
    const fetchMock: typeof fetch = (async () =>
      new Response(JSON.stringify(validBranchInfo), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;
    const result = await proxyFetchBranchInfo(
      { projectPath: '/tmp/p', branch: 'main', docPath: 'a.md' },
      buildDeps({ fetch: fetchMock }),
    );
    expect(result).toEqual(validBranchInfo);
  });
});
