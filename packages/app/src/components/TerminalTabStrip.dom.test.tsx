import { afterEach, describe, expect, mock, test } from 'bun:test';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type TerminalTabDescriptor, TerminalTabStrip } from './TerminalTabStrip';

const SESSIONS: readonly TerminalTabDescriptor[] = [
  { id: 's1', label: 'Terminal 1' },
  { id: 's2', label: 'Terminal 2' },
  { id: 's3', label: 'Terminal 3' },
];

function renderStrip(props?: {
  sessions?: readonly TerminalTabDescriptor[];
  activeSessionId?: string;
  dockPosition?: 'bottom' | 'right';
}) {
  const onSelect = mock((_id: string) => {});
  const onTabActivate = mock((_id: string) => {});
  const onNewChat = mock(() => {});
  const onNewTerminalTab = mock(() => {});
  const onClose = mock((_id: string) => {});
  const onToggleDock = mock(() => {});
  const onCollapse = mock(() => {});
  render(
    <TooltipProvider>
      <TerminalTabStrip
        sessions={props?.sessions ?? SESSIONS}
        activeSessionId={props?.activeSessionId ?? 's1'}
        onSelect={onSelect}
        onTabActivate={onTabActivate}
        onNewChat={onNewChat}
        onNewTerminalTab={onNewTerminalTab}
        onClose={onClose}
        dockPosition={props?.dockPosition ?? 'bottom'}
        onToggleDock={onToggleDock}
        onCollapse={onCollapse}
      />
    </TooltipProvider>,
  );
  return {
    onSelect,
    onTabActivate,
    onNewChat,
    onNewTerminalTab,
    onClose,
    onToggleDock,
    onCollapse,
  };
}

describe('TerminalTabStrip', () => {
  afterEach(() => cleanup());

  test('renders one tab per session inside a labeled tablist', () => {
    renderStrip();
    const tablist = screen.getByRole('tablist', { name: 'Terminal sessions' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Terminal 1', 'Terminal 2', 'Terminal 3']);
  });

  test('marks the active session as selected and leaves others unselected', () => {
    renderStrip({ activeSessionId: 's2' });
    expect(screen.getByRole('tab', { name: 'Terminal 2' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Terminal 1' }).getAttribute('aria-selected')).toBe(
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Terminal 3' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  test('is fully controlled: clicking a tab reports onSelect without changing its own selection', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderStrip({ activeSessionId: 's1' });

    await user.click(screen.getByRole('tab', { name: 'Terminal 2' }));

    expect(onSelect).toHaveBeenCalledWith('s2');
    expect(screen.getByRole('tab', { name: 'Terminal 1' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Terminal 2' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  test('reports onTabActivate with the session id on click, but not on arrow-key nav', async () => {
    const user = userEvent.setup();
    const { onTabActivate } = renderStrip({ activeSessionId: 's1' });

    await user.click(screen.getByRole('tab', { name: 'Terminal 2' }));
    expect(onTabActivate).toHaveBeenCalledWith('s2');

    onTabActivate.mockClear();
    act(() => screen.getByRole('tab', { name: 'Terminal 2' }).focus());
    await user.keyboard('{ArrowRight}');
    expect(onTabActivate).not.toHaveBeenCalled();
  });

  test('arrow-key navigation reports the next session via onSelect', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderStrip({ activeSessionId: 's1' });
    const first = screen.getByRole('tab', { name: 'Terminal 1' });

    act(() => {
      first.focus();
    });
    expect(document.activeElement).toBe(first);
    await user.keyboard('{ArrowRight}');

    expect(onSelect).toHaveBeenCalledWith('s2');
  });

  test('the New chat control reports onNewChat and never onSelect / onNewTerminalTab', async () => {
    const user = userEvent.setup();
    const { onNewChat, onNewTerminalTab, onSelect } = renderStrip();

    await user.click(screen.getByRole('button', { name: 'New chat' }));

    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onNewTerminalTab).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('the New terminal tab control reports onNewTerminalTab (bare shell) and never onNewChat', async () => {
    const user = userEvent.setup();
    const { onNewChat, onNewTerminalTab } = renderStrip();

    await user.click(screen.getByRole('button', { name: 'New terminal tab' }));

    expect(onNewTerminalTab).toHaveBeenCalledTimes(1);
    expect(onNewChat).not.toHaveBeenCalled();
  });

  test('New chat hugs the last tab, preceding the trailing New terminal tab / collapse controls', () => {
    renderStrip();
    const newChat = screen.getByRole('button', { name: 'New chat' });
    const newTerminalTab = screen.getByRole('button', { name: 'New terminal tab' });
    const collapse = screen.getByRole('button', { name: 'Collapse terminal' });
    expect(
      newChat.compareDocumentPosition(newTerminalTab) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      newTerminalTab.compareDocumentPosition(collapse) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test('a tab close control reports onClose with that session id only', async () => {
    const user = userEvent.setup();
    const { onClose, onSelect, onNewChat } = renderStrip({ activeSessionId: 's1' });

    await user.click(screen.getByRole('button', { name: 'Close Terminal 2' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith('s2');
    expect(onSelect).not.toHaveBeenCalled();
    expect(onNewChat).not.toHaveBeenCalled();
  });

  test('the dock-toggle reports onToggleDock and labels the resulting position', async () => {
    const user = userEvent.setup();
    const bottom = renderStrip({ dockPosition: 'bottom' });
    const toRight = screen.getByRole('button', { name: 'Dock terminal to the right' });
    await user.click(toRight);
    expect(bottom.onToggleDock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Dock terminal to the bottom' })).toBeNull();
    cleanup();

    const right = renderStrip({ dockPosition: 'right' });
    const toBottom = screen.getByRole('button', { name: 'Dock terminal to the bottom' });
    await user.click(toBottom);
    expect(right.onToggleDock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Dock terminal to the right' })).toBeNull();
  });

  test('the collapse control reports onCollapse and never onClose / onNewChat / onNewTerminalTab', async () => {
    const user = userEvent.setup();
    const { onCollapse, onClose, onNewChat, onNewTerminalTab } = renderStrip();

    await user.click(screen.getByRole('button', { name: 'Collapse terminal' }));

    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(onNewChat).not.toHaveBeenCalled();
    expect(onNewTerminalTab).not.toHaveBeenCalled();
  });

  test('no drag-to-dock grip is rendered (dragging was removed)', () => {
    renderStrip();
    expect(screen.queryByRole('button', { name: 'Drag to dock the terminal' })).toBeNull();
  });

  test('every icon-only control exposes an accessible name', () => {
    renderStrip();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New terminal tab' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Dock terminal to the right' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Collapse terminal' })).toBeDefined();
    for (const label of ['Terminal 1', 'Terminal 2', 'Terminal 3']) {
      expect(screen.getByRole('button', { name: `Close ${label}` })).toBeDefined();
    }
  });
});
