import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { HandoffTarget, InstallState } from '@inkeep/open-knowledge-core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { renderLinguiTemplate } from '@/test-utils/lingui-mock';
import type { HandoffDispatchInput } from './useHandoffDispatch';

mock.module('@lingui/core/macro', () => ({
  t: renderLinguiTemplate,
}));

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({ t: renderLinguiTemplate }),
}));

mock.module('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

mock.module('@/lib/config-provider', () => ({
  useConfigContext: () => ({
    merged: { appearance: { preview: { autoOpen: true } } },
  }),
}));

mock.module('@/lib/config-context', () => ({
  useConfigContext: () => ({
    merged: { appearance: { preview: { autoOpen: true } } },
  }),
}));

mock.module('sonner', () => ({
  toast: {
    error: mock(() => {}),
    success: mock(() => {}),
  },
}));

const readyInput: HandoffDispatchInput = {
  docContext: { relativePath: 'notes/today.md' },
  docPath: '/project/notes/today.md',
  projectDir: '/project',
};

function installStates(
  overrides: Partial<Record<HandoffTarget, InstallState>> = {},
): Record<HandoffTarget, InstallState> {
  return {
    'claude-code': { installed: false, lastChecked: 1 },
    'claude-cowork': { installed: true, lastChecked: 1 },
    codex: { installed: true, lastChecked: 1 },
    cursor: { installed: null, lastChecked: 1 },
    ...overrides,
  };
}

async function renderSubmenu({
  input = readyInput,
  states = installStates(),
  webFallbackVisible,
}: {
  input?: HandoffDispatchInput | null;
  states?: Record<HandoffTarget, InstallState>;
  webFallbackVisible?: boolean;
} = {}) {
  const { OpenInAgentContextSubmenu } = await import('./OpenInAgentContextSubmenu');
  const dispatchCalls: Array<{ input: HandoffDispatchInput; target: HandoffTarget }> = [];
  const dispatch = mock(async (target: HandoffTarget, nextInput: HandoffDispatchInput) => {
    dispatchCalls.push({ input: nextInput, target });
    return { ok: true as const };
  });

  render(
    <DropdownMenu open={true}>
      <DropdownMenuContent forceMount={true}>
        <OpenInAgentContextSubmenu
          dispatch={dispatch}
          input={input}
          installStates={states}
          isElectronHost={true}
          webFallbackVisible={webFallbackVisible}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );

  const trigger = screen.getByRole('menuitem', { name: 'Open with AI' });
  await userEvent.hover(trigger);
  await waitFor(() => {
    expect(document.querySelector('[data-slot="dropdown-menu-sub-content"]')).toBeTruthy();
  });

  return { dispatch, dispatchCalls, trigger };
}

describe('OpenInAgentContextSubmenu runtime behavior', () => {
  afterEach(() => cleanup());

  test('renders only installed visible targets and dispatches the selected row', async () => {
    const { dispatchCalls } = await renderSubmenu();

    const trigger = document.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
    expect(trigger?.textContent).toContain('Open with AI');
    expect(screen.getByTestId('file-tree-open-in-codex')).toBeTruthy();
    expect(screen.queryByTestId('file-tree-open-in-claude-cowork') === null).toBe(true);
    expect(screen.queryByTestId('file-tree-open-in-cursor') === null).toBe(true);
    expect(screen.getByTestId('file-tree-open-in-claude-web-fallback')).toBeTruthy();

    await userEvent.click(screen.getByRole('menuitem', { name: 'Open with AI Codex' }));

    expect(dispatchCalls).toEqual([{ input: readyInput, target: 'codex' }]);
  });

  test('keeps rows disabled with a No workspace label while input is missing', async () => {
    const { dispatch } = await renderSubmenu({ input: null });

    const codex = screen.getByRole('menuitem', { name: 'Open with AI Codex, No workspace' });
    expect(codex.getAttribute('data-disabled')).toBe('');
    expect(codex.textContent).toContain('No workspace');

    await userEvent.click(codex);

    expect(dispatch).not.toHaveBeenCalled();
  });

  test('hides the Claude web fallback when the caller opts out or Claude is installed', async () => {
    await renderSubmenu({ webFallbackVisible: false });
    expect(screen.queryByTestId('file-tree-open-in-claude-web-fallback') === null).toBe(true);
    cleanup();

    await renderSubmenu({
      states: installStates({
        'claude-code': { installed: true, lastChecked: 1 },
      }),
    });
    expect(screen.queryByTestId('file-tree-open-in-claude-web-fallback') === null).toBe(true);
    expect(screen.getByTestId('file-tree-open-in-claude-code')).toBeTruthy();
  });
});
