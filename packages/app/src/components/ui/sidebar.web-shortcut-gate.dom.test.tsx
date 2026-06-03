import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import { SidebarProvider, useSidebar } from './sidebar';

function StateProbe() {
  const { state } = useSidebar();
  return <span data-testid="sidebar-state">{state}</span>;
}

function pressSidebarShortcut() {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { altKey: true, metaKey: true, code: 'KeyS' }),
    );
  });
}

function setOkDesktop(value: unknown) {
  (window as { okDesktop?: unknown }).okDesktop = value;
}

describe('SidebarProvider web-mode ⌥⌘S shortcut — Electron gate', () => {
  beforeEach(() => {
    window.innerWidth = 1400;
    setOkDesktop(undefined);
  });

  afterEach(() => {
    cleanup();
    setOkDesktop(undefined);
  });

  test('web host (no window.okDesktop): ⌥⌘S toggles the sidebar', () => {
    render(
      <SidebarProvider>
        <StateProbe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId('sidebar-state').textContent).toBe('expanded');

    pressSidebarShortcut();

    expect(screen.getByTestId('sidebar-state').textContent).toBe('collapsed');
  });

  test('Electron host (window.okDesktop set): ⌥⌘S does NOT toggle (native menu owns it)', () => {
    setOkDesktop({});
    render(
      <SidebarProvider>
        <StateProbe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId('sidebar-state').textContent).toBe('expanded');

    pressSidebarShortcut();

    expect(screen.getByTestId('sidebar-state').textContent).toBe('expanded');
  });

  test('web host (Win/Linux modifier): Ctrl+Alt+S also toggles the sidebar', () => {
    render(
      <SidebarProvider>
        <StateProbe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId('sidebar-state').textContent).toBe('expanded');

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { altKey: true, ctrlKey: true, code: 'KeyS' }),
      );
    });

    expect(screen.getByTestId('sidebar-state').textContent).toBe('collapsed');
  });
});
