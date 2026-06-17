import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

type ConsentState = { enabled: boolean | null; synced: boolean };
type Writer = ((enabled: boolean) => { ok: true } | { ok: false; error: string }) | null;

let consentState: ConsentState = { enabled: false, synced: true };
let writerImpl: Writer = null;
const writerCalls: boolean[] = [];
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
  toast: { error: () => {} },
}));

mock.module('@/hooks/use-terminal-enabled', () => ({
  useTerminalConsentState: () => consentState,
  useTerminalEnabledWriter: () => writerImpl,
}));

mock.module('@/components/TerminalConsentDialog', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  TerminalConsentDialog: (props: any) => {
    consentDialogProps = props;
    return props.open ? <div data-testid="consent-dialog" /> : null;
  },
}));

const { TerminalSection } = await import('./TerminalSection');

describe('TerminalSection (Settings revoke toggle)', () => {
  beforeEach(() => {
    consentState = { enabled: false, synced: true };
    writerImpl = (enabled) => {
      writerCalls.push(enabled);
      return { ok: true };
    };
    writerCalls.length = 0;
    consentDialogProps = null;
  });
  afterEach(() => cleanup());

  test('reflects the granted state as a checked switch', () => {
    consentState = { enabled: true, synced: true };
    render(<TerminalSection />);
    expect((screen.getByRole('switch') as HTMLButtonElement).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  test('on → off revokes immediately via writer(false), no dialog', async () => {
    consentState = { enabled: true, synced: true };
    render(<TerminalSection />);
    await userEvent.click(screen.getByRole('switch'));
    expect(writerCalls).toEqual([false]);
    expect(screen.queryByTestId('consent-dialog')).toBeNull();
  });

  test('off → on opens the consent dialog and does not write until accepted', async () => {
    consentState = { enabled: false, synced: true };
    render(<TerminalSection />);
    await userEvent.click(screen.getByRole('switch'));

    expect(consentDialogProps?.open).toBe(true);
    expect(writerCalls).toEqual([]);

    act(() => consentDialogProps?.onAccept());
    expect(writerCalls).toEqual([true]);
  });

  test('off → on then decline leaves the shell off (no write)', async () => {
    consentState = { enabled: false, synced: true };
    render(<TerminalSection />);
    await userEvent.click(screen.getByRole('switch'));
    act(() => consentDialogProps?.onDecline());

    expect(writerCalls).toEqual([]);
    expect(consentDialogProps?.open).toBe(false);
  });

  test('the toggle is disabled until the project-local binding is ready', () => {
    consentState = { enabled: null, synced: false };
    writerImpl = null;
    render(<TerminalSection />);
    expect((screen.getByRole('switch') as HTMLButtonElement).disabled).toBe(true);
  });
});
