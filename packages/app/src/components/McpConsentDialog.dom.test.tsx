import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import type { OkMcpWiringResult, OkMcpWiringShowPayload } from '@/lib/desktop-bridge-types';
import type { McpConsentStore } from '@/lib/mcp-consent-store';
import { renderLinguiTemplate } from '@/test-utils/lingui-mock';
import type { ToastImpl } from './McpConsentDialogBody';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({ t: renderLinguiTemplate }),
}));

const payload: OkMcpWiringShowPayload = {
  detectedEditors: [
    { id: 'claude', label: 'Claude', detected: true, willReplace: true },
    { id: 'cursor', label: 'Cursor', detected: true, willReplace: false },
    { id: 'codex', label: 'Codex', detected: false, willReplace: false },
  ],
};

function deferredResult() {
  let resolve!: (result: OkMcpWiringResult) => void;
  const promise = new Promise<OkMcpWiringResult>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function makeHarness({
  confirmResult = async () => ({ ok: true as const }),
  skipResult = async () => ({ ok: true as const }),
}: {
  confirmResult?: (editorIds: readonly string[]) => Promise<OkMcpWiringResult>;
  skipResult?: () => Promise<OkMcpWiringResult>;
} = {}) {
  const confirmCalls: readonly string[][] = [];
  const skipCalls: string[] = [];
  const toastErrors: string[] = [];
  const store: McpConsentStore = {
    confirm: async (editorIds) => {
      (confirmCalls as string[][]).push([...editorIds]);
      return confirmResult(editorIds);
    },
    dismiss: () => {},
    getSnapshot: () => payload,
    install: () => undefined,
    skip: async () => {
      skipCalls.push('skip');
      return skipResult();
    },
    subscribe: () => () => {},
  };
  const toast: ToastImpl = {
    error: (message) => toastErrors.push(message),
  };
  return { confirmCalls, skipCalls, store, toast, toastErrors };
}

async function renderDialog(harness = makeHarness()) {
  const { McpConsentDialogBody } = await import('./McpConsentDialogBody');
  render(<McpConsentDialogBody payload={payload} store={harness.store} toast={harness.toast} />);
  return harness;
}

describe('McpConsentDialog runtime behavior', () => {
  afterEach(() => cleanup());

  test('renders willReplace disclosure and preselects detected editors only', async () => {
    await renderDialog();

    expect(screen.getByRole('dialog', { name: 'Add OpenKnowledge to your AI tools' })).toBeTruthy();
    expect(screen.getByTestId('mcp-consent-status-claude').textContent).toBe(
      'Will replace existing OpenKnowledge entry',
    );
    expect(screen.getByTestId('mcp-consent-status-cursor').textContent).toBe(
      'Detected on this machine',
    );
    expect(screen.getByTestId('mcp-consent-status-codex').textContent).toBe('Not detected');
    expect(screen.getByTestId('mcp-consent-checkbox-claude').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByTestId('mcp-consent-checkbox-cursor').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByTestId('mcp-consent-checkbox-codex').getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  test('failed Add resets busy state, reports the error, and allows retry', async () => {
    const first = deferredResult();
    const second = deferredResult();
    const outcomes = [first, second];
    const harness = makeHarness({
      confirmResult: async () => outcomes.shift()?.promise ?? { ok: true },
    });
    await renderDialog(harness);

    const add = screen.getByTestId('mcp-consent-add') as HTMLButtonElement;
    const skip = screen.getByTestId('mcp-consent-skip') as HTMLButtonElement;

    await userEvent.click(add);
    expect(add.disabled).toBe(true);
    expect(skip.disabled).toBe(true);
    expect(add.textContent).toBe('Working');

    first.resolve({ ok: false, error: 'Could not write Claude config' });
    await waitFor(() => {
      expect(add.disabled).toBe(false);
    });

    expect(skip.disabled).toBe(false);
    expect(add.textContent).toBe('Add');
    expect(harness.confirmCalls).toEqual([['claude', 'cursor']]);
    expect(harness.toastErrors).toEqual(['Could not write Claude config']);

    await userEvent.click(add);
    second.resolve({ ok: false, error: 'Still unwritable' });
    await waitFor(() => {
      expect(harness.confirmCalls).toEqual([
        ['claude', 'cursor'],
        ['claude', 'cursor'],
      ]);
    });
  });

  test('failed Skip resets busy state, reports the error, and allows retry', async () => {
    const first = deferredResult();
    const second = deferredResult();
    const outcomes = [first, second];
    const harness = makeHarness({
      skipResult: async () => outcomes.shift()?.promise ?? { ok: true },
    });
    await renderDialog(harness);

    const add = screen.getByTestId('mcp-consent-add') as HTMLButtonElement;
    const skip = screen.getByTestId('mcp-consent-skip') as HTMLButtonElement;

    await userEvent.click(skip);
    expect(add.disabled).toBe(true);
    expect(skip.disabled).toBe(true);

    first.resolve({ ok: false, error: 'Could not write marker' });
    await waitFor(() => {
      expect(skip.disabled).toBe(false);
    });

    expect(add.disabled).toBe(false);
    expect(harness.skipCalls).toEqual(['skip']);
    expect(harness.toastErrors).toEqual(['Could not write marker']);

    await userEvent.click(skip);
    second.resolve({ ok: false, error: 'Still cannot write marker' });
    await waitFor(() => {
      expect(harness.skipCalls).toEqual(['skip', 'skip']);
    });
  });
});
