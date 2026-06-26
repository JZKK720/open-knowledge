import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderLinguiTemplate } from '@/test-utils/lingui-mock';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useLingui: () => ({ t: renderLinguiTemplate }),
}));

const { CopyablePromptList } = await import('./CopyablePromptList');

describe('CopyablePromptList', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, 'okDesktop');
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
  });
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(globalThis.document, 'execCommand');
  });

  test('flips a row to "Copied" when the clipboard write resolves', async () => {
    const writeText = mock(() => Promise.resolve());
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyablePromptList scenario="new-project" />);

    const button = screen.getByTestId('copy-prompt-button-competitor-research');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByTestId('copy-prompt-button-competitor-research').textContent).toContain(
        'Copied',
      );
    });
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  test('falls back to execCommand and still copies when embedded-iframe policy refuses the async write', async () => {
    const writeText = mock(() =>
      Promise.reject(
        Object.assign(new Error('blocked because of a permissions policy'), {
          name: 'NotAllowedError',
        }),
      ),
    );
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const execCommand = mock(() => true);
    Object.defineProperty(globalThis.document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    render(<CopyablePromptList scenario="new-project" />);

    fireEvent.click(screen.getByTestId('copy-prompt-button-competitor-research'));

    await waitFor(() => {
      expect(screen.getByTestId('copy-prompt-button-competitor-research').textContent).toContain(
        'Copied',
      );
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  test('does not flip to "Copied" when every clipboard path is refused', async () => {
    const writeText = mock(() =>
      Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })),
    );
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const execCommand = mock(() => false);
    Object.defineProperty(globalThis.document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    render(<CopyablePromptList scenario="new-project" />);
    fireEvent.click(screen.getByTestId('copy-prompt-button-competitor-research'));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('copy-prompt-button-competitor-research').textContent).not.toContain(
      'Copied',
    );
  });
});
