import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

mock.module('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, part, index) => `${acc}${part}${values[index] ?? ''}`, ''),
  }),
}));

let hasRemote = false;
let projectLocalSynced = false;
let projectLocalConfig: { autoSync?: { enabled?: boolean | null } } | null = null;

mock.module('@/hooks/use-git-sync-status', () => ({
  useGitSyncStatus: () => ({
    hasRemote,
    pushPermission: { checkStatus: 'allowed' },
  }),
}));

mock.module('@/lib/config-provider', () => ({
  useConfigContext: () => ({ projectLocalConfig, projectLocalSynced }),
}));

mock.module('@/lib/use-workspace', () => ({
  useWorkspace: () => ({ contentDir: '/tmp/project', pathSeparator: '/' }),
}));

mock.module('@/editor/DocumentContext', () => ({
  useDocumentContext: () => ({ activeDocName: 'docs/notes', collabUrl: 'ws://test' }),
}));

mock.module('@/editor/use-editor-mode', () => ({
  useEditorMode: () => ['wysiwyg', () => {}],
}));

mock.module('./EditorHeader', () => ({
  EditorHeader: () => <div data-testid="editor-header" />,
}));

mock.module('./EditorArea', () => ({
  EditorArea: () => <div data-testid="editor-area" />,
}));

mock.module('./AuthModal', () => ({
  AuthModal: () => <div data-testid="auth-modal" />,
}));

mock.module('@/editor/components/TagDialog', () => ({
  TagDialog: () => <div data-testid="tag-dialog" />,
}));

mock.module('./AutoSyncOnboardingDialog', () => ({
  AutoSyncOnboardingDialog: ({ open, onResolved }: { open: boolean; onResolved: () => void }) => (
    <button
      type="button"
      data-testid="auto-sync-onboarding"
      data-open={String(open)}
      onClick={onResolved}
    >
      Auto sync onboarding
    </button>
  ),
}));

async function renderEditorPane() {
  const { EditorPane } = await import('./EditorPane');
  render(<EditorPane />);
}

describe('EditorPane auto-sync onboarding gate', () => {
  afterEach(() => {
    cleanup();
    hasRemote = false;
    projectLocalSynced = false;
    projectLocalConfig = null;
  });

  test('exports the EditorPane component', async () => {
    const mod = await import('./EditorPane');
    expect(typeof mod.EditorPane).toBe('function');
  });

  test('opens only when remote exists, project-local config is synced, and autoSync.enabled is null', async () => {
    hasRemote = true;
    projectLocalSynced = true;
    projectLocalConfig = { autoSync: { enabled: null } };

    await renderEditorPane();

    expect(screen.getByTestId('auto-sync-onboarding').getAttribute('data-open')).toBe('true');
  });

  test.each([
    ['no remote', false, true, { autoSync: { enabled: null } }],
    ['project-local config not synced', true, false, { autoSync: { enabled: null } }],
    ['project-local config missing', true, true, null],
    ['enabled true already answered', true, true, { autoSync: { enabled: true } }],
    ['enabled false already answered', true, true, { autoSync: { enabled: false } }],
    ['enabled undefined is not the unanswered sentinel', true, true, { autoSync: {} }],
  ] as const)('stays closed when %s', async (_label, nextHasRemote, nextSynced, nextProjectLocalConfig) => {
    hasRemote = nextHasRemote;
    projectLocalSynced = nextSynced;
    projectLocalConfig = nextProjectLocalConfig;

    await renderEditorPane();

    expect(screen.getByTestId('auto-sync-onboarding').getAttribute('data-open')).toBe('false');
  });

  test('resolved onboarding dismisses the dialog in the same render path', async () => {
    hasRemote = true;
    projectLocalSynced = true;
    projectLocalConfig = { autoSync: { enabled: null } };
    await renderEditorPane();

    const dialog = screen.getByTestId('auto-sync-onboarding');
    expect(dialog.getAttribute('data-open')).toBe('true');

    await userEvent.click(dialog);

    expect(screen.getByTestId('auto-sync-onboarding').getAttribute('data-open')).toBe('false');
  });
});
