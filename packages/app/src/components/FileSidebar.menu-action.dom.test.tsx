import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ResolvedNavigationTarget } from './navigation-targets';

type MenuAction =
  NonNullable<typeof window.okDesktop> extends { onMenuAction: (cb: infer C) => unknown }
    ? C extends (action: infer A) => unknown
      ? A
      : never
    : never;

function PassThrough({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function ElementPassThrough({
  children,
  asChild: _asChild,
  ...props
}: {
  children?: ReactNode;
  asChild?: boolean;
  [key: string]: unknown;
}) {
  return <div {...props}>{children}</div>;
}

function Button({
  children,
  asChild: _asChild,
  onCheckedChange: _onCheckedChange,
  size: _size,
  variant: _variant,
  ...props
}: {
  children?: ReactNode;
  asChild?: boolean;
  onCheckedChange?: unknown;
  size?: unknown;
  variant?: unknown;
  [key: string]: unknown;
}) {
  return (
    <button type="button" {...props}>
      {children}
    </button>
  );
}

const ACTIVE_TARGET = {
  kind: 'doc',
  target: 'notes/source',
  docName: 'notes/source',
} satisfies ResolvedNavigationTarget;

const notifyViewMenuStateChangedMock = mock(() => {});
let menuActionCallback: ((action: MenuAction) => void) | null = null;

mock.module('@/lib/perf', () => ({
  ProfilerBoundary: PassThrough,
}));

mock.module('@/components/FileTree', () => ({
  FileTree: () => <div data-testid="file-tree-stub" />,
}));

mock.module('@/components/ui/button', () => ({
  Button,
}));

const toggleSidebarMock = mock(() => {});

mock.module('@/components/ui/sidebar', () => ({
  Sidebar: ElementPassThrough,
  SidebarContent: ElementPassThrough,
  SidebarFooter: ElementPassThrough,
  SidebarHeader: ElementPassThrough,
  SidebarMenu: ElementPassThrough,
  SidebarMenuItem: ElementPassThrough,
  SidebarRail: () => null,
  useSidebar: () => ({ state: 'expanded', toggleSidebar: toggleSidebarMock }),
}));

mock.module('@/components/ui/context-menu', () => ({
  ContextMenu: PassThrough,
  ContextMenuCheckboxItem: Button,
  ContextMenuContent: ElementPassThrough,
  ContextMenuItem: Button,
  ContextMenuSeparator: () => <hr />,
  ContextMenuSub: PassThrough,
  ContextMenuSubContent: ElementPassThrough,
  ContextMenuSubTrigger: Button,
  ContextMenuTrigger: PassThrough,
}));

mock.module('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: PassThrough,
  DropdownMenuContent: ElementPassThrough,
  DropdownMenuItem: Button,
  DropdownMenuTrigger: PassThrough,
}));

mock.module('@/components/ui/tooltip', () => ({
  Tooltip: PassThrough,
  TooltipContent: ElementPassThrough,
  TooltipTrigger: PassThrough,
}));

mock.module('@/components/handoff/OpenInAgentEmptySpaceSubmenu', () => ({
  OpenInAgentEmptySpaceSubmenu: () => null,
}));

mock.module('@/components/handoff/useHandoffDispatch', () => ({
  buildFolderHandoffInput: () => null,
  buildHandoffInput: () => null,
  buildProjectScopedHandoffInput: () => null,
  useHandoffDispatch: () => ({ dispatch: mock(async () => ({ ok: true as const })) }),
}));

mock.module('@/components/handoff/useInstalledAgents', () => ({
  useInstalledAgents: () => ({ states: {} }),
}));

mock.module('@/components/ProjectSwitcher', () => ({
  ProjectSwitcher: () => null,
}));

mock.module('@/components/SidebarSearchBar', () => ({
  SidebarSearchBar: () => <button type="button">Search</button>,
  onPillRenderError: () => {},
}));

mock.module('@/components/UpdateNotices', () => ({
  UpdateNotices: () => null,
}));

mock.module('@/editor/DocumentContext', () => ({
  useDocumentContext: () => ({
    activeDocName: 'notes/source',
    activeTarget: ACTIVE_TARGET,
  }),
}));

mock.module('@/hooks/use-folder-config', () => ({
  useFolderConfig: () => ({
    state: {
      status: 'ready',
      data: { folder: { templates_available: [] } },
    },
  }),
}));

mock.module('@/lib/config-provider', () => ({
  useConfigContext: () => ({
    projectLocalBinding: null,
    merged: null,
  }),
}));

mock.module('@/lib/dispatch-open-in-terminal', () => ({
  dispatchOpenInTerminal: () => {},
}));

mock.module('@/lib/use-workspace', () => ({
  useWorkspace: () => ({
    contentDir: '/tmp/open-knowledge',
    pathSeparator: '/',
  }),
}));

mock.module('sonner', () => ({
  toast: {
    error: mock(() => {}),
    success: mock(() => {}),
  },
}));

const { FileSidebar } = await import('./FileSidebar');
const { subscribeToFileTreeMenuActionDuplicate } = await import(
  '@/lib/file-tree-menu-action-events'
);

describe('FileSidebar menu-action runtime routing', () => {
  beforeEach(() => {
    menuActionCallback = null;
    notifyViewMenuStateChangedMock.mockClear();
    toggleSidebarMock.mockClear();
    Object.defineProperty(window, 'okDesktop', {
      configurable: true,
      value: {
        platform: 'darwin',
        editor: {
          notifyViewMenuStateChanged: notifyViewMenuStateChangedMock,
        },
        shell: {
          showItemInFolder: mock(async () => {}),
        },
        onMenuAction: (callback: (action: MenuAction) => void) => {
          menuActionCallback = callback;
          return () => {
            if (menuActionCallback === callback) menuActionCallback = null;
          };
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'okDesktop', {
      configurable: true,
      value: undefined,
    });
  });

  test('duplicate menu action emits the active target on the FileTree event bus', async () => {
    const received: ResolvedNavigationTarget[] = [];
    const unsubscribe = subscribeToFileTreeMenuActionDuplicate((target) => {
      received.push(target);
    });

    try {
      render(<FileSidebar onOpenSearch={() => {}} />);
      await waitFor(() => expect(menuActionCallback).not.toBeNull());

      menuActionCallback?.('duplicate' as MenuAction);

      expect(received).toEqual([ACTIVE_TARGET]);
    } finally {
      unsubscribe();
    }
  });

  test('toggle-sidebar menu action invokes useSidebar().toggleSidebar()', async () => {
    render(<FileSidebar onOpenSearch={() => {}} />);
    await waitFor(() => expect(menuActionCallback).not.toBeNull());

    menuActionCallback?.('toggle-sidebar' as MenuAction);

    expect(toggleSidebarMock).toHaveBeenCalledTimes(1);
  });
});
