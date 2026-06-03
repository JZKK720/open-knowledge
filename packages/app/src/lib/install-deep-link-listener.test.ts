import { describe, expect, mock, test } from 'bun:test';
import type { OkDesktopBridge, OkDesktopConfig } from './desktop-bridge-types';
import { deriveShareReceiveToast, installDeepLinkListener } from './install-deep-link-listener';

type DeepLinkPayload = { doc: string; branch?: string | null; multiCandidate?: boolean };

function makeBridge(overrides: Partial<OkDesktopBridge> = {}): OkDesktopBridge & {
  fireDeepLink: (evt: DeepLinkPayload) => void;
} {
  let handler: ((evt: DeepLinkPayload) => void) | null = null;
  const base: OkDesktopBridge = {
    config: {
      collabUrl: 'ws://localhost:52000/collab',
      apiOrigin: 'http://localhost:52000',
      projectPath: '/tmp/project',
      projectName: 'project',
      mode: 'editor',
    } as OkDesktopConfig,
    onProjectSwitched: mock(() => () => {}),
    onMenuAction: mock(() => () => {}),
    onDeepLink: mock((cb: (evt: DeepLinkPayload) => void) => {
      handler = cb;
      return mock(() => {
        handler = null;
      });
    }),
    dialog: {
      openFolder: mock(() => Promise.resolve(null)),
    },
    shell: {
      openExternal: mock(() => Promise.resolve()),
    },
    clipboard: {
      writeText: mock(() => Promise.resolve()),
    },
    project: {
      listRecent: mock(() => Promise.resolve([])),
      removeRecent: mock(() => Promise.resolve()),
      getSessionState: mock(() =>
        Promise.resolve({
          openTabs: [],
          pinnedTabIds: [],
          activeDocName: null,
          activeTabId: null,
          updatedAt: null,
        }),
      ),
      setSessionState: mock(() => Promise.resolve()),
      open: mock(() => Promise.resolve()),
      close: mock(() => Promise.resolve()),
    },
    platform: 'darwin',
    appVersion: '0.0.0',
    ...overrides,
  };
  return Object.assign(base, {
    fireDeepLink: (evt: DeepLinkPayload) => handler?.(evt),
  });
}

describe('installDeepLinkListener (M4 US-007)', () => {
  test('no-op when bridge is undefined (web / CLI distribution)', () => {
    const setHash = mock(() => {});
    const result = installDeepLinkListener({ bridge: undefined, setHash });
    expect(result).toBeUndefined();
    expect(setHash.mock.calls.length).toBe(0);
  });

  test('registers onDeepLink when bridge is present', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    const unsubscribe = installDeepLinkListener({ bridge, setHash });
    expect(unsubscribe).toBeDefined();
    expect((bridge.onDeepLink as ReturnType<typeof mock>).mock.calls.length).toBe(1);
    expect(setHash.mock.calls.length).toBe(0);
  });

  test('updates hash to #/<doc> on deep-link event', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'intro.md' });
    expect(setHash.mock.calls[0]).toEqual(['#/intro.md']);
  });

  test('URL-encodes doc names with spaces / unicode', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'My Doc — 2026.md' });
    expect(setHash.mock.calls[0]?.[0]).toBe('#/My%20Doc%20%E2%80%94%202026.md');
  });

  test('URL-encodes nested doc names (round-trips via docNameFromHash)', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'notes/meeting-2026' });
    expect(setHash.mock.calls[0]?.[0]).toBe('#/notes%2Fmeeting-2026');
  });

  test('returns bridge unsubscribe so callers can detach on teardown', () => {
    const detach = mock(() => {});
    const bridge = makeBridge({
      onDeepLink: mock(() => detach),
    });
    const setHash = mock(() => {});
    const unsubscribe = installDeepLinkListener({ bridge, setHash });
    unsubscribe?.();
    expect(detach.mock.calls.length).toBe(1);
  });

  test('appends ?branch=<encoded> when branch is present in payload', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'intro.md', branch: 'main' });
    expect(setHash.mock.calls[0]?.[0]).toBe('#/intro.md?branch=main');
  });

  test('URL-encodes slashed branch names like feat/foo', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'docs/page.md', branch: 'feat/foo' });
    expect(setHash.mock.calls[0]?.[0]).toBe('#/docs%2Fpage.md?branch=feat%2Ffoo');
  });

  test('treats null branch identically to absent branch (back-compat)', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'intro.md', branch: null });
    expect(setHash.mock.calls[0]?.[0]).toBe('#/intro.md');
  });

  test('treats undefined branch identically to absent branch (back-compat)', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'intro.md', branch: undefined });
    expect(setHash.mock.calls[0]?.[0]).toBe('#/intro.md');
  });

  test('legacy doc-only payload (no branch key) still works unchanged', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    const legacyPayload = { doc: 'intro.md' } as { doc: string; branch?: string | null };
    bridge.fireDeepLink(legacyPayload);
    expect(setHash.mock.calls[0]?.[0]).toBe('#/intro.md');
  });

  test('encodes branch with unicode characters', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    installDeepLinkListener({ bridge, setHash });
    bridge.fireDeepLink({ doc: 'page.md', branch: '日本語' });
    expect(setHash.mock.calls[0]?.[0]).toBe('#/page.md?branch=%E6%97%A5%E6%9C%AC%E8%AA%9E');
  });
});

describe('deriveShareReceiveToast (FR9)', () => {
  test('returns payload with branch + projectPath when multiCandidate is true', () => {
    expect(
      deriveShareReceiveToast(
        { doc: 'x.md', branch: 'feat-bar', multiCandidate: true },
        '/wt/feat-bar',
      ),
    ).toEqual({
      message: 'Opened on branch feat-bar',
      description: '/wt/feat-bar',
    });
  });

  test('preserves slashed branch names verbatim in message (FR11)', () => {
    expect(
      deriveShareReceiveToast(
        { doc: 'x.md', branch: 'feat/foo/bar', multiCandidate: true },
        '/wt/foo',
      ),
    ).toEqual({
      message: 'Opened on branch feat/foo/bar',
      description: '/wt/foo',
    });
  });

  test('returns null when branch is absent (suppresses toast for legacy shares)', () => {
    expect(deriveShareReceiveToast({ doc: 'x.md' }, '/wt/feat')).toBeNull();
  });

  test('returns null when branch is null (back-compat with legacy IPC payload)', () => {
    expect(deriveShareReceiveToast({ doc: 'x.md', branch: null }, '/wt/feat')).toBeNull();
  });

  test('returns null when branch is empty string', () => {
    expect(deriveShareReceiveToast({ doc: 'x.md', branch: '' }, '/wt/feat')).toBeNull();
  });

  test('returns null when projectPath is empty (web/CLI distribution)', () => {
    expect(
      deriveShareReceiveToast({ doc: 'x.md', branch: 'feat-bar', multiCandidate: true }, ''),
    ).toBeNull();
  });

  test('returns null when multiCandidate is false (single-clone P4 suppression)', () => {
    expect(
      deriveShareReceiveToast(
        { doc: 'x.md', branch: 'feat-bar', multiCandidate: false },
        '/wt/feat-bar',
      ),
    ).toBeNull();
  });

  test('returns null when multiCandidate is absent (legacy emitter / single-clone default)', () => {
    expect(deriveShareReceiveToast({ doc: 'x.md', branch: 'feat-bar' }, '/wt/feat-bar')).toBeNull();
  });
});

describe('installDeepLinkListener — FR9 toast emission', () => {
  test('emits toast with branch + path when share is multi-candidate', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    const emitToast = mock(() => {});
    installDeepLinkListener({ bridge, setHash, emitToast });
    bridge.fireDeepLink({ doc: 'docs/x.md', branch: 'feat-bar', multiCandidate: true });
    expect(emitToast.mock.calls).toHaveLength(1);
    expect(emitToast.mock.calls[0]?.[0]).toBe('Opened on branch feat-bar');
    expect(emitToast.mock.calls[0]?.[1]).toEqual({
      description: '/tmp/project',
      duration: 3000,
    });
  });

  test('suppresses toast when share has no branch (legacy)', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    const emitToast = mock(() => {});
    installDeepLinkListener({ bridge, setHash, emitToast });
    bridge.fireDeepLink({ doc: 'docs/x.md' });
    expect(emitToast.mock.calls).toHaveLength(0);
  });

  test('suppresses toast for single-clone (P4) — multiCandidate is false', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    const emitToast = mock(() => {});
    installDeepLinkListener({ bridge, setHash, emitToast });
    bridge.fireDeepLink({ doc: 'docs/x.md', branch: 'feat-bar', multiCandidate: false });
    expect(emitToast.mock.calls).toHaveLength(0);
  });

  test('suppresses toast when multiCandidate is absent (legacy emitter)', () => {
    const bridge = makeBridge();
    const setHash = mock(() => {});
    const emitToast = mock(() => {});
    installDeepLinkListener({ bridge, setHash, emitToast });
    bridge.fireDeepLink({ doc: 'docs/x.md', branch: 'feat-bar' });
    expect(emitToast.mock.calls).toHaveLength(0);
  });
});
