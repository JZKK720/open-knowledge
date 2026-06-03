import { describe, expect, test } from 'bun:test';
import { createDesktopKeepaliveFactory } from './keepalive.ts';
import type { ServerLockMetadataLike } from './window-manager.ts';

const FAKE_LOCK: ServerLockMetadataLike = {
  pid: 12345,
  hostname: 'my-host',
  port: 51234,
  startedAt: '2026-05-21T00:00:00.000Z',
  worktreeRoot: '/tmp/keepalive-test',
  kind: 'interactive',
  capabilities: ['http', 'ws'],
};

describe('createDesktopKeepaliveFactory', () => {
  test('returns a handle with close()/isConnected()', () => {
    const factory = createDesktopKeepaliveFactory({
      readServerLock: () => FAKE_LOCK,
    });
    const handle = factory({ lockDir: '/tmp/keepalive-test/.ok/local' });
    expect(typeof handle.close).toBe('function');
    expect(typeof handle.isConnected).toBe('function');
    expect(handle.isConnected()).toBe(false); // hasn't connected yet (microtask gate)
    handle.close();
  });

  test('close() is idempotent — second call does not throw', () => {
    const factory = createDesktopKeepaliveFactory({
      readServerLock: () => FAKE_LOCK,
    });
    const handle = factory({ lockDir: '/tmp/k/.ok/local' });
    handle.close();
    expect(() => handle.close()).not.toThrow();
  });

  test('resolveWsUrl returns undefined when readServerLock returns null', async () => {
    let nullReads = 0;
    const factory = createDesktopKeepaliveFactory({
      readServerLock: () => {
        nullReads++;
        return null;
      },
    });
    const handle = factory({ lockDir: '/tmp/nope/.ok/local' });
    await new Promise<void>((r) => setImmediate(r));
    expect(nullReads).toBeGreaterThanOrEqual(1);
    expect(handle.isConnected()).toBe(false);
    handle.close();
  });

  test('resolveWsUrl returns undefined when port is zero (server still starting)', async () => {
    let zeroPortReads = 0;
    const factory = createDesktopKeepaliveFactory({
      readServerLock: () => {
        zeroPortReads++;
        return { ...FAKE_LOCK, port: 0 };
      },
    });
    const handle = factory({ lockDir: '/tmp/starting/.ok/local' });
    await new Promise<void>((r) => setImmediate(r));
    expect(zeroPortReads).toBeGreaterThanOrEqual(1);
    expect(handle.isConnected()).toBe(false);
    handle.close();
  });
});
