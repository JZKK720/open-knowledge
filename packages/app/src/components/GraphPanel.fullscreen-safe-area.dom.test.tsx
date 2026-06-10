import { afterEach, describe, mock, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderLinguiTemplate } from '@/test-utils/lingui-mock';
import {
  expectVisualClassTokens,
  expectVisualClassTokensAbsent,
} from '@/test-utils/visual-contract';

mock.module('@lingui/core/macro', () => ({
  t: renderLinguiTemplate,
}));

mock.module('@lingui/react/macro', () => ({
  Plural: ({ one }: { one: string }) => <>{one}</>,
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({ t: renderLinguiTemplate }),
}));

mock.module('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

mock.module('@/components/PageListContext', () => ({
  usePageList: () => ({
    assetPaths: new Set<string>(),
    error: null,
    folderPaths: new Set<string>(),
    loading: false,
    pages: new Set<string>(['docs/Active']),
    pagesBySlug: new Map<string, string>(),
    pageMeta: new Map(),
    pageTitles: new Map([['docs/Active', 'Active']]),
    refetch: () => {},
    addPage: () => {},
  }),
}));

mock.module('@/components/GraphView', () => ({
  GraphView: ({ isExpanded }: { isExpanded: boolean }) => (
    <div data-testid="graph-view" data-expanded={String(isExpanded)} />
  ),
}));

describe('GraphPanel fullscreen safe-area behavior', () => {
  afterEach(() => cleanup());

  async function renderExpandedGraphPanel() {
    const { GraphPanel } = await import('./GraphPanel');
    render(
      <TooltipProvider>
        <GraphPanel activeDocName="docs/Active" />
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Expand graph' }));
  }

  test('expanded overlay reserves the macOS traffic-light footprint at runtime', async () => {
    await renderExpandedGraphPanel();

    const graphView = screen.getByTestId('graph-view');
    const panel = graphView.closest('[data-slot="panel"]');
    expectVisualClassTokens(panel?.className, [
      'fixed',
      'inset-0',
      'z-50',
      'overflow-hidden',
      'bg-background',
    ]);

    const header = panel?.querySelector('[data-slot="panel-header"]');
    expectVisualClassTokens(header?.className, ['pl-[var(--ok-titlebar-reserve-left,1rem)]']);
    expectVisualClassTokensAbsent(header?.className, ['pl-[var(--ok-titlebar-reserve-left)]']);
  });
});
