import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderLinguiTemplate } from '@/test-utils/lingui-mock';
import { expectVisualClassTokens } from '@/test-utils/visual-contract';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({ t: renderLinguiTemplate }),
}));

mock.module('./EditorBreadcrumb', () => ({
  EditorBreadcrumb: ({ docName }: { docName: string | null }) => (
    <span data-testid="editor-breadcrumb-probe">{docName}</span>
  ),
}));

describe('EditorToolbar runtime layout', () => {
  afterEach(() => cleanup());

  async function renderToolbar() {
    const { EditorToolbar } = await import('./EditorToolbar');

    render(
      <TooltipProvider>
        <EditorToolbar
          activeDocName="docs/Page.md"
          isSourceMode={false}
          sourceDisabled={false}
          onModeChange={() => {}}
          showAddPropertyButton={true}
          onAddProperty={() => {}}
          isPanelCollapsed={false}
          onTogglePanel={() => {}}
        />
      </TooltipProvider>,
    );
  }

  test('toolbar overlay lets editor clicks pass through except explicit cells', async () => {
    await renderToolbar();

    const toolbar = screen.getByTestId('editor-toolbar');
    expectVisualClassTokens(toolbar.className, ['pointer-events-none']);

    const breadcrumbCell = screen.getByTestId('editor-breadcrumb-probe').parentElement;
    expectVisualClassTokens(breadcrumbCell?.className, ['pointer-events-auto']);
  });

  test('content-column wrapper encloses the three-column toolbar grid', async () => {
    await renderToolbar();

    const toolbar = screen.getByTestId('editor-toolbar');
    const alignedWrapper = toolbar.querySelector('.editor-content-aligned');
    expect(alignedWrapper).toBeTruthy();

    const grid = alignedWrapper?.querySelector('.grid.grid-cols-3');
    expect(grid).toBeTruthy();
  });

  test('mode toggle stays centered in the middle toolbar cell', async () => {
    await renderToolbar();

    const sourceButton = screen.getByRole('radio', { name: 'Markdown source' });
    const middleCell = sourceButton.closest('.pointer-events-auto.flex.justify-center');
    expect(middleCell).toBeTruthy();
  });
});
