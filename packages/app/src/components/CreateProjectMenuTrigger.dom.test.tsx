import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { OkDesktopBridge } from '@/lib/desktop-bridge-types';
import { CreateProjectMenuTrigger } from './CreateProjectMenuTrigger';

type MenuActionLike = 'new-project' | 'new-doc' | 'toggle-sidebar';

type WindowGlobals = { NodeFilter?: typeof NodeFilter };
type GlobalWithDomShims = typeof globalThis &
  WindowGlobals & { window?: WindowGlobals; ResizeObserver?: unknown };
const globalWithDomShims = globalThis as GlobalWithDomShims;
if (
  globalWithDomShims.NodeFilter === undefined &&
  globalWithDomShims.window?.NodeFilter !== undefined
) {
  globalWithDomShims.NodeFilter = globalWithDomShims.window.NodeFilter;
}
if (globalWithDomShims.ResizeObserver === undefined) {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalWithDomShims.ResizeObserver = NoopResizeObserver;
}

const ASYNC_TIMEOUT_MS = 2000;

interface MenuActionBridgeStub {
  bridge: OkDesktopBridge;
  fire(action: MenuActionLike): void;
  readonly unsubscribeCalls: number;
}

function makeMenuActionBridge(): MenuActionBridgeStub {
  let captured: ((action: MenuActionLike) => void) | null = null;
  let unsubscribeCalls = 0;

  const bridge = {
    onMenuAction: (cb: (action: MenuActionLike) => void) => {
      captured = cb;
      return () => {
        unsubscribeCalls += 1;
        captured = null;
      };
    },
    fs: {
      defaultProjectsRoot: async (): Promise<string> => '/Users/test/Projects',
    },
    project: {
      recordCreateNewBannerShown: async () => undefined,
      createNew: async () => undefined,
      open: async () => undefined,
    },
    dialog: {
      openFolder: async (): Promise<string | null> => null,
    },
  } as unknown as OkDesktopBridge;

  return {
    bridge,
    fire: (action) => {
      if (captured) {
        act(() => captured?.(action));
      }
    },
    get unsubscribeCalls() {
      return unsubscribeCalls;
    },
  };
}

describe('CreateProjectMenuTrigger', () => {
  let consoleWarnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    consoleWarnSpy.mockRestore();
  });

  test('dialog is closed until the new-project menu action fires', () => {
    const stub = makeMenuActionBridge();
    render(<CreateProjectMenuTrigger bridge={stub.bridge} />);
    expect(screen.queryByTestId('create-project-dialog') !== null).toBe(false);
  });

  test('new-project menu action opens CreateProjectDialog', async () => {
    const stub = makeMenuActionBridge();
    render(<CreateProjectMenuTrigger bridge={stub.bridge} />);

    stub.fire('new-project');

    await waitFor(
      () => {
        expect(screen.queryByTestId('create-project-dialog') !== null).toBe(true);
      },
      { timeout: ASYNC_TIMEOUT_MS },
    );
    expect(screen.queryByText('Create new project') !== null).toBe(true);
  });

  test('unrelated menu actions do not open the dialog', async () => {
    const stub = makeMenuActionBridge();
    render(<CreateProjectMenuTrigger bridge={stub.bridge} />);

    stub.fire('new-doc');
    stub.fire('toggle-sidebar');

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('create-project-dialog') !== null).toBe(false);
  });

  test('unsubscribes from onMenuAction on unmount', () => {
    const stub = makeMenuActionBridge();
    const { unmount } = render(<CreateProjectMenuTrigger bridge={stub.bridge} />);
    expect(stub.unsubscribeCalls).toBe(0);
    unmount();
    expect(stub.unsubscribeCalls).toBe(1);
  });
});
