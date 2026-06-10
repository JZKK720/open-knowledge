import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { KNOWN_TARGETS } from '@/lib/handoff/targets';

mock.module('@lingui/core/macro', () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, ''),
}));

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, ''),
  }),
}));

mock.module('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

function target(id: (typeof KNOWN_TARGETS)[number]['id']) {
  const found = KNOWN_TARGETS.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing target ${id}`);
  return found;
}

function renderMenuItem(children: ReactNode) {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>,
  );
}

describe('OpenInAgentMenuItem runtime behavior', () => {
  afterEach(() => {
    cleanup();
  });

  test('enabled row dispatches through onSelect with an accessible target label', async () => {
    const { OpenInAgentMenuItem } = await import('./OpenInAgentMenuItem');
    const selected: string[] = [];
    renderMenuItem(
      <OpenInAgentMenuItem
        target={target('codex')}
        installState={{ installed: true, lastChecked: 1 }}
        isElectronHost
        prompt="Open docs/notes.md"
        onSelect={() => selected.push('codex')}
      />,
    );

    await userEvent.click(screen.getByRole('menuitem', { name: 'Open with AI Codex' }));

    expect(selected).toEqual(['codex']);
  });

  test('not-installed Claude row exposes install and web-fallback submenu affordances', async () => {
    const { OpenInAgentMenuItem } = await import('./OpenInAgentMenuItem');
    const openedUrls: string[] = [];
    const webFallbackSuccesses: string[] = [];
    renderMenuItem(
      <OpenInAgentMenuItem
        target={target('claude-code')}
        installState={{ installed: false, lastChecked: 1 }}
        isElectronHost
        prompt="Open docs/notes.md"
        onSelect={() => {
          throw new Error('disabled row should not dispatch');
        }}
        openExternal={async (url) => {
          openedUrls.push(url);
          return { ok: true };
        }}
        onWebFallbackSuccess={(entry) => webFallbackSuccesses.push(entry.id)}
      />,
    );

    const trigger = screen.getByRole('menuitem', { name: 'Open with AI Claude, Not installed' });
    expect(trigger.getAttribute('data-row-disabled')).toBe('');

    await userEvent.hover(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('open-in-agent-submenu-claude-code')).toBeTruthy();
    });

    expect(screen.getByTestId('open-in-agent-message-claude-code').textContent).toBe(
      'Requires Claude Desktop.',
    );
    await userEvent.click(screen.getByTestId('open-in-agent-install-claude-code'));
    await userEvent.click(screen.getByTestId('open-in-agent-web-fallback-claude-code'));

    expect(openedUrls[0]).toBe('https://claude.com/download');
    expect(openedUrls[1]).toContain('https://claude.ai/new?q=');
    expect(decodeURIComponent(openedUrls[1].split('q=')[1] ?? '')).toBe('Open docs/notes.md');
    expect(webFallbackSuccesses).toEqual(['claude-code']);
  });
});
