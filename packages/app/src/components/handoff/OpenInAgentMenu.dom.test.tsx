import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { TargetData } from '@inkeep/open-knowledge-core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { HandoffDispatchInput } from './useHandoffDispatch';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, ''),
  }),
}));

const refreshCalls: string[] = [];
const dispatchCalls: Array<{ target: string; input: HandoffDispatchInput }> = [];
const fallbackPrompts: string[] = [];
let states: Record<string, { installed: boolean | null; lastChecked?: number }> = {};

mock.module('./useInstalledAgents', () => ({
  useInstalledAgents: () => ({
    states,
    refresh: () => {
      refreshCalls.push('refresh');
      return Promise.resolve();
    },
  }),
}));

mock.module('./useHandoffDispatch', () => ({
  useHandoffDispatch: () => ({
    dispatch: (target: string, input: HandoffDispatchInput) => {
      dispatchCalls.push({ target, input });
      return Promise.resolve({ ok: true as const });
    },
  }),
}));

mock.module('@/lib/config-context', () => ({
  useConfigContext: () => ({
    merged: { appearance: { preview: { autoOpen: true } } },
  }),
}));

mock.module('@/hooks/use-is-embedded', () => ({
  useIsEmbedded: () => false,
}));

const successToastForWebFallback = (displayName: string) =>
  `Opened ${displayName} in your browser.`;

mock.module('./OpenInAgentMenuItem', () => ({
  OpenInAgentMenuItem: ({ target, onSelect }: { target: TargetData; onSelect: () => void }) => (
    <button type="button" data-testid={`open-in-agent-row-${target.id}`} onClick={onSelect}>
      {target.displayName}
    </button>
  ),
  dispatchClaudeWebFallback: (prompt: string) => {
    fallbackPrompts.push(prompt);
    return Promise.resolve();
  },
  successToastForWebFallback,
}));

const input: HandoffDispatchInput = {
  docContext: { relativePath: 'docs/notes.md' },
  projectDir: '/tmp/project',
  docPath: '/tmp/project/docs/notes.md',
};

async function renderMenu(menuInput: HandoffDispatchInput | null = input) {
  const { OpenInAgentMenu } = await import('./OpenInAgentMenu');
  render(
    <TooltipProvider>
      <OpenInAgentMenu input={menuInput} />
    </TooltipProvider>,
  );
}

async function openMenu() {
  await userEvent.click(screen.getByTestId('open-in-agent-trigger'));
  await waitFor(() => {
    expect(screen.getByTestId('open-in-agent-menu')).toBeTruthy();
  });
}

describe('OpenInAgentMenu runtime behavior', () => {
  afterEach(() => {
    cleanup();
    refreshCalls.length = 0;
    dispatchCalls.length = 0;
    fallbackPrompts.length = 0;
    states = {};
  });

  test('exports the shell component and success toast re-export', async () => {
    const mod = await import('./OpenInAgentMenu');
    const itemMod = await import('./OpenInAgentMenuItem');

    expect(typeof mod.OpenInAgentMenu).toBe('function');
    expect(mod.successToastForWebFallback).toBe(itemMod.successToastForWebFallback);
  });

  test('trigger uses visible Open with AI text as its accessible name', async () => {
    await renderMenu();

    const trigger = screen.getByTestId('open-in-agent-trigger');
    expect(trigger.textContent).toContain('Open with AI');
    expect(trigger.getAttribute('aria-label')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open with AI' })).toBe(trigger);
  });

  test('disabled trigger still keeps the visible Open with AI label when no input exists', async () => {
    await renderMenu(null);

    const trigger = screen.getByRole('button', { name: 'Open with AI' }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-label')).toBeNull();
  });

  test('open refreshes install state and renders only installed visible targets', async () => {
    states = {
      'claude-cowork': { installed: true, lastChecked: 1 },
      'claude-code': { installed: true, lastChecked: 1 },
      codex: { installed: true, lastChecked: 1 },
      cursor: { installed: true, lastChecked: 1 },
    };
    await renderMenu();
    await openMenu();

    expect(refreshCalls).toEqual(['refresh']);
    expect(screen.getByTestId('open-in-agent-row-claude-code')).toBeTruthy();
    expect(screen.getByTestId('open-in-agent-row-codex')).toBeTruthy();
    expect(screen.getByTestId('open-in-agent-row-cursor')).toBeTruthy();
    expect(screen.queryByTestId('open-in-agent-row-claude-cowork')).toBeNull();

    await userEvent.click(screen.getByTestId('open-in-agent-row-codex'));
    expect(dispatchCalls).toEqual([{ target: 'codex', input }]);
  });

  test('Claude web fallback appears when the visible Claude row is not installed', async () => {
    states = {
      'claude-cowork': { installed: true, lastChecked: 1 },
      'claude-code': { installed: false, lastChecked: 1 },
      codex: { installed: false, lastChecked: 1 },
      cursor: { installed: false, lastChecked: 1 },
    };
    await renderMenu();
    await openMenu();

    const fallback = screen.getByTestId('open-in-agent-claude-web-fallback');
    expect(fallback.textContent).toContain('Open in claude.ai');

    await userEvent.click(fallback);
    expect(fallbackPrompts).toHaveLength(1);
    expect(fallbackPrompts[0]).toContain('docs/notes.md');
  });

  test('Claude web fallback is hidden when claude-code is installed', async () => {
    states = {
      'claude-cowork': { installed: false, lastChecked: 1 },
      'claude-code': { installed: true, lastChecked: 1 },
    };
    await renderMenu();
    await openMenu();

    expect(screen.queryByTestId('open-in-agent-claude-web-fallback')).toBeNull();
  });
});
