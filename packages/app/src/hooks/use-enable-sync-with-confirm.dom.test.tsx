import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

mock.module('@lingui/react/macro', () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, ''),
  }),
}));

const toastErrors: string[] = [];
mock.module('sonner', () => ({
  toast: {
    error: (message: string) => toastErrors.push(message),
  },
}));

let projectLocalBinding: null | {
  patch: (patch: unknown) => { ok: true } | { ok: false; error: unknown };
} = null;

mock.module('@/lib/config-provider', () => ({
  useConfigContext: () => ({ projectLocalBinding }),
}));

type Writer = ((enabled: boolean) => { ok: true } | { ok: false; error: string }) | null;
type ConfirmState = {
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  onToggleRequest: (next: boolean) => void;
  onConfirm: () => void;
};
let hooks: Awaited<typeof import('./use-enable-sync-with-confirm')> | null = null;
let latestConfirmState: ConfirmState | null = null;
let latestWriter: Writer | undefined;

async function loadHooks() {
  hooks ??= await import('./use-enable-sync-with-confirm');
  return hooks;
}

function ConfirmProbe({ writer }: { writer: Writer }) {
  if (!hooks) throw new Error('hooks not loaded');
  latestConfirmState = hooks.useEnableSyncWithConfirm(writer);
  return <div data-testid="confirm-open">{String(latestConfirmState.confirmOpen)}</div>;
}

function WriterProbe({ children: _children }: { children?: ReactNode }) {
  if (!hooks) throw new Error('hooks not loaded');
  latestWriter = hooks.useSyncEnabledWriter();
  return <div data-testid="writer-present">{String(latestWriter !== null)}</div>;
}

describe('useEnableSyncWithConfirm runtime behavior', () => {
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  afterEach(() => {
    cleanup();
    latestConfirmState = null;
    latestWriter = undefined;
    projectLocalBinding = null;
    toastErrors.length = 0;
    consoleErrorSpy?.mockRestore();
  });

  test('exports the hook and project-local writer adapter', async () => {
    const mod = await loadHooks();
    expect(typeof mod.useEnableSyncWithConfirm).toBe('function');
    expect(typeof mod.useSyncEnabledWriter).toBe('function');
  });

  test('off to on opens confirmation and writes true only after confirm', async () => {
    await loadHooks();
    const writes: boolean[] = [];
    const writer: Writer = (enabled) => {
      writes.push(enabled);
      return { ok: true };
    };
    render(<ConfirmProbe writer={writer} />);

    await act(async () => {
      latestConfirmState?.onToggleRequest(true);
    });
    expect(screen.getByTestId('confirm-open').textContent).toBe('true');
    expect(writes).toEqual([]);

    await act(async () => {
      latestConfirmState?.onConfirm();
    });
    expect(writes).toEqual([true]);
    expect(screen.getByTestId('confirm-open').textContent).toBe('false');
  });

  test('on to off commits immediately without opening confirmation', async () => {
    await loadHooks();
    const writes: boolean[] = [];
    const writer: Writer = (enabled) => {
      writes.push(enabled);
      return { ok: true };
    };
    render(<ConfirmProbe writer={writer} />);

    await act(async () => {
      latestConfirmState?.onToggleRequest(false);
    });

    expect(writes).toEqual([false]);
    expect(screen.getByTestId('confirm-open').textContent).toBe('false');
  });

  test('confirm keeps the dialog open when enabling fails', async () => {
    await loadHooks();
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
    const writer: Writer = () => ({ ok: false, error: 'branch is protected' });
    render(<ConfirmProbe writer={writer} />);

    await act(async () => {
      latestConfirmState?.onToggleRequest(true);
      latestConfirmState?.onConfirm();
    });

    expect(screen.getByTestId('confirm-open').textContent).toBe('true');
    expect(toastErrors).toEqual(['Failed to enable sync — branch is protected']);
  });
});

describe('useSyncEnabledWriter runtime behavior', () => {
  afterEach(() => {
    cleanup();
    latestWriter = undefined;
    projectLocalBinding = null;
  });

  test('returns null until the project-local binding mounts', async () => {
    await loadHooks();
    projectLocalBinding = null;
    render(<WriterProbe />);

    expect(screen.getByTestId('writer-present').textContent).toBe('false');
    expect(latestWriter).toBeNull();
  });

  test('patches autoSync.enabled on the project-local binding', async () => {
    await loadHooks();
    const patches: unknown[] = [];
    projectLocalBinding = {
      patch: (patch: unknown) => {
        patches.push(patch);
        return { ok: true };
      },
    };
    render(<WriterProbe />);

    expect(latestWriter?.(true)).toEqual({ ok: true });
    expect(patches).toEqual([{ autoSync: { enabled: true } }]);
  });

  test('wraps binding errors into a string result for toast rendering', async () => {
    await loadHooks();
    projectLocalBinding = {
      patch: () => ({ ok: false, error: { code: 'WRITE_ERROR', detail: 'disk denied' } }),
    };
    render(<WriterProbe />);

    expect(latestWriter?.(false)).toEqual({
      ok: false,
      error: 'Failed to write config file: disk denied',
    });
  });
});
