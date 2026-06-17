import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { OkDesktopBridge } from '@/lib/desktop-bridge-types';

type ConsentState = { enabled: boolean | null; synced: boolean };
type Writer = ((enabled: boolean) => { ok: true } | { ok: false; error: string }) | null;

let consentState: ConsentState = { enabled: null, synced: true };
let writerImpl: Writer = null;
const writerCalls: boolean[] = [];
const toastErrors: string[] = [];
// biome-ignore lint/suspicious/noExplicitAny: captured mock-component props
let consentDialogProps: Record<string, any> | null = null;

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((out, part, index) => `${out}${part}${values[index] ?? ''}`, ''),
  }),
}));

mock.module('sonner', () => ({
  toast: { error: (message: string) => toastErrors.push(message) },
}));

mock.module('@/hooks/use-terminal-enabled', () => ({
  useTerminalConsentState: () => consentState,
  useTerminalEnabledWriter: () => writerImpl,
}));

mock.module('./TerminalPanel', () => ({
  TerminalPanel: () => <span data-testid="terminal-panel" />,
}));

mock.module('./TerminalConsentDialog', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  TerminalConsentDialog: (props: any) => {
    consentDialogProps = props;
    return props.open ? <div data-testid="consent-dialog" /> : null;
  },
}));

const { TerminalGate } = await import('./TerminalGate');

const bridge = {} as OkDesktopBridge;

function renderGate(visible = true) {
  return render(<TerminalGate bridge={bridge} visible={visible} />);
}

describe('TerminalGate', () => {
  beforeEach(() => {
    consentState = { enabled: null, synced: true };
    writerImpl = (enabled) => {
      writerCalls.push(enabled);
      return { ok: true };
    };
    writerCalls.length = 0;
    toastErrors.length = 0;
    consentDialogProps = null;
  });
  afterEach(() => cleanup());

  test('enabled === true mounts the terminal (shell spawns); no consent dialog', async () => {
    consentState = { enabled: true, synced: true };
    renderGate();
    expect(await screen.findByTestId('terminal-panel')).toBeTruthy();
    expect(screen.queryByTestId('consent-dialog')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Terminal disabled' })).toBeNull();
  });

  test('enabled === null on first open shows the JIT consent dialog; no shell', () => {
    consentState = { enabled: null, synced: true };
    renderGate(true);
    expect(screen.queryByTestId('terminal-panel')).toBeNull();
    expect(consentDialogProps?.open).toBe(true);
  });

  test('null but not yet synced does not flash the dialog (cold start)', () => {
    consentState = { enabled: null, synced: false };
    renderGate(true);
    expect(consentDialogProps?.open).toBe(false);
  });

  test('null while hidden does not open the dialog', () => {
    consentState = { enabled: null, synced: true };
    renderGate(false);
    expect(consentDialogProps?.open).toBe(false);
  });

  test('accepting consent grants via the writer (terminal.enabled := true)', () => {
    consentState = { enabled: null, synced: true };
    renderGate(true);
    act(() => consentDialogProps?.onAccept());
    expect(writerCalls).toEqual([true]);
  });

  test('declining shows the not-enabled state and never spawns', () => {
    consentState = { enabled: null, synced: true };
    renderGate(true);
    act(() => consentDialogProps?.onDecline());

    expect(screen.getByRole('region', { name: 'Terminal disabled' })).toBeTruthy();
    expect(screen.queryByTestId('terminal-panel')).toBeNull();
    expect(consentDialogProps?.open).toBe(false);
    expect(writerCalls).toEqual([]);
  });

  test('enabled === false shows the not-enabled notice; no shell, no auto-dialog', () => {
    consentState = { enabled: false, synced: true };
    renderGate(true);
    expect(screen.getByRole('region', { name: 'Terminal disabled' })).toBeTruthy();
    expect(screen.queryByTestId('terminal-panel')).toBeNull();
    expect(consentDialogProps?.open).toBe(false);
  });

  test('re-enabling from a revoked notice reopens consent (re-consent on re-enable)', () => {
    consentState = { enabled: false, synced: true };
    renderGate(true);
    act(() => screen.getByRole('button', { name: 'Enable terminal' }).click());
    expect(consentDialogProps?.open).toBe(true);
  });

  test('accept with no writer yet surfaces an actionable toast, no crash', () => {
    consentState = { enabled: null, synced: true };
    writerImpl = null;
    renderGate(true);
    act(() => consentDialogProps?.onAccept());
    expect(writerCalls).toEqual([]);
    expect(toastErrors.length).toBe(1);
  });

  test('a writer that fails to persist consent surfaces a toast and never mounts the shell', () => {
    consentState = { enabled: null, synced: true };
    writerImpl = (enabled) => {
      writerCalls.push(enabled);
      return { ok: false, error: 'ENOSPC: no space left on device' };
    };
    renderGate(true);
    act(() => consentDialogProps?.onAccept());

    expect(writerCalls).toEqual([true]);
    expect(toastErrors.length).toBe(1);
    expect(toastErrors[0]).toContain('ENOSPC');
    expect(screen.queryByTestId('terminal-panel')).toBeNull();
  });
});
