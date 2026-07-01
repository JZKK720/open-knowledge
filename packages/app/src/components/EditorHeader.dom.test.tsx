import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  expectVisualClassTokens,
  expectVisualClassTokensAbsent,
} from '@/test-utils/visual-contract';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, ''),
  }),
}));

let activeDocName: string | null = 'docs/notes';
let activeTarget: unknown = { kind: 'doc' };
let sidebarState: 'expanded' | 'collapsed' = 'expanded';
let isDraggingRail = false;
let lastShareInput: unknown;

mock.module('@/editor/DocumentContext', () => ({
  useDocumentContext: () => ({ activeDocName, activeTarget }),
}));

mock.module('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ state: sidebarState, isDraggingRail }),
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button type="button" data-testid="sidebar-trigger" className={className}>
      sidebar
    </button>
  ),
}));

mock.module('./EditorTabs', () => ({
  EditorTabs: () => <div data-testid="editor-tabs" />,
}));

mock.module('./ShareButton', () => ({
  ShareButton: ({ input }: { input: unknown }) => {
    lastShareInput = input;
    return (
      <button type="button" disabled={input === null}>
        Share
      </button>
    );
  },
}));

mock.module('./PublishToGitHubDialog', () => ({
  PublishToGitHubDialog: ({ open }: { open: boolean }) => (
    <div data-testid="publish-dialog" data-open={String(open)} />
  ),
}));

mock.module('./SyncStatusBadge', () => ({
  SyncStatusBadge: () => <div data-testid="sync-status-badge" />,
}));

mock.module('@/presence/PresenceBar', () => ({
  PresenceBar: () => <div data-testid="presence-bar" />,
}));

mock.module('./BetaBadge', () => ({
  BetaBadge: () => <div data-testid="beta-badge" />,
}));

mock.module('./SettingsButton', () => ({
  SettingsButton: () => <button type="button">Settings</button>,
}));

mock.module('./HelpPopover', () => ({
  HelpPopover: () => <button type="button">Resources</button>,
}));

function setElectronHost(enabled: boolean) {
  Object.defineProperty(window, 'okDesktop', {
    configurable: true,
    value: enabled ? {} : undefined,
  });
}

interface TerminalHeaderProps {
  terminalAvailable?: boolean;
  terminalVisible?: boolean;
  onToggleChat?: () => void;
}

async function renderHeader(props: TerminalHeaderProps = {}) {
  const { EditorHeader } = await import('./EditorHeader');
  render(
    <TooltipProvider>
      <EditorHeader {...props} />
    </TooltipProvider>,
  );
  return document.querySelector('header') as HTMLElement;
}

describe('EditorHeader runtime behavior', () => {
  afterEach(() => {
    cleanup();
    setElectronHost(false);
    activeDocName = 'docs/notes';
    activeTarget = { kind: 'doc' };
    sidebarState = 'expanded';
    isDraggingRail = false;
    lastShareInput = undefined;
  });

  test('exports the EditorHeader component', async () => {
    const mod = await import('./EditorHeader');
    expect(typeof mod.EditorHeader).toBe('function');
  });

  test('web host keeps baseline header layout without Electron drag treatment', async () => {
    setElectronHost(false);
    sidebarState = 'collapsed';
    const header = await renderHeader();

    expect(header.getAttribute('data-electron-drag')).toBeNull();
    expectVisualClassTokens(header.className, [
      'flex',
      'h-12',
      'shrink-0',
      'items-center',
      'shadow-[inset_0_-1px_0_var(--border)]',
    ]);
    expectVisualClassTokensAbsent(header.className, [
      '[-webkit-app-region:drag]',
      'pl-[var(--ok-titlebar-reserve-left,1rem)]',
    ]);
    expectVisualClassTokensAbsent(screen.getByTestId('sidebar-trigger').className, [
      '[-webkit-app-region:no-drag]',
    ]);
  });

  test('Electron collapsed-sidebar host enables drag region and traffic-light reserve', async () => {
    setElectronHost(true);
    sidebarState = 'collapsed';
    const header = await renderHeader();

    expect(header.getAttribute('data-electron-drag')).toBe('');
    expectVisualClassTokens(header.className, [
      '[-webkit-app-region:drag]',
      'pl-[var(--ok-titlebar-reserve-left,1rem)]',
      'motion-safe:transition-[padding]',
    ]);
    expectVisualClassTokens(screen.getByTestId('sidebar-trigger').className, [
      '[-webkit-app-region:no-drag]',
    ]);
    const rightZone = header.children.item(1) as HTMLElement;
    expectVisualClassTokens(rightZone.className, ['[&>*]:[-webkit-app-region:no-drag]']);
  });

  test('Electron expanded sidebar keeps drag region but does not reserve traffic-light padding', async () => {
    setElectronHost(true);
    sidebarState = 'expanded';
    const header = await renderHeader();

    expectVisualClassTokens(header.className, ['[-webkit-app-region:drag]']);
    expectVisualClassTokensAbsent(header.className, ['pl-[var(--ok-titlebar-reserve-left,1rem)]']);
  });

  test('rail drag keeps the reserve but drops the padding transition so it snaps with the sidebar', async () => {
    setElectronHost(true);
    sidebarState = 'collapsed';
    isDraggingRail = true;
    const header = await renderHeader();

    expectVisualClassTokens(header.className, ['pl-[var(--ok-titlebar-reserve-left,1rem)]']);
    expectVisualClassTokensAbsent(header.className, ['motion-safe:transition-[padding]']);
  });

  test('renders tabs and action cluster without project or asset-title chrome', async () => {
    await renderHeader();

    expect(screen.getByTestId('editor-tabs')).toBeTruthy();
    expect(screen.queryByTestId('open-in-agent-menu')).toBeNull();
    expect(screen.queryByText('projectName')).toBeNull();
    expect(screen.queryByText('assetFileName')).toBeNull();
  });

  test('an active doc yields a doc-scope share input', async () => {
    activeDocName = 'docs/notes';
    activeTarget = { kind: 'doc' };
    await renderHeader();

    expect(lastShareInput).toEqual({ kind: 'doc', docName: 'docs/notes' });
  });

  test('a selected folder yields a folder-scope share input', async () => {
    activeDocName = null;
    activeTarget = { kind: 'folder', folderPath: 'guides' };
    await renderHeader();

    expect(lastShareInput).toEqual({ kind: 'folder', folderRelativePath: 'guides' });
  });

  test('nothing open or selected defaults to sharing the project root', async () => {
    activeDocName = null;
    activeTarget = null;
    await renderHeader();

    expect(lastShareInput).toEqual({ kind: 'folder', folderRelativePath: '' });
  });

  test('a managed-artifact doc (skill/template) keeps the share trigger disabled', async () => {
    activeDocName = '__skill__/project/my-skill';
    activeTarget = { kind: 'doc' };
    await renderHeader();

    expect(lastShareInput).toBeNull();
  });

  test('a non-shareable asset target keeps the share trigger disabled', async () => {
    activeDocName = null;
    activeTarget = { kind: 'asset', assetPath: 'img/logo.png' };
    await renderHeader();

    expect(lastShareInput).toBeNull();
  });

  test('terminalAvailable renders a single Open chat button when the dock is hidden', async () => {
    await renderHeader({ terminalAvailable: true, terminalVisible: false });

    expect(screen.getByRole('button', { name: 'Open chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close chat' })).toBeNull();
  });

  test('the button label flips to Close chat when the dock is visible', async () => {
    await renderHeader({ terminalAvailable: true, terminalVisible: true });

    expect(screen.getByRole('button', { name: 'Close chat' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open chat' })).toBeNull();
  });

  test('clicking the chat toggle fires its handler', async () => {
    const onToggleChat = mock(() => {});
    await renderHeader({ terminalAvailable: true, terminalVisible: false, onToggleChat });

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(onToggleChat).toHaveBeenCalledTimes(1);
  });

  test('the chat toggle does not render when terminalAvailable is false (web / no terminal surface)', async () => {
    await renderHeader({ terminalAvailable: false });

    expect(screen.queryByRole('button', { name: 'Open chat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close chat' })).toBeNull();
  });
});
