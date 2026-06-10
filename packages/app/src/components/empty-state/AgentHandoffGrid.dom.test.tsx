import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { HandoffTarget, InstallState, TargetData } from '@inkeep/open-knowledge-core';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const states: Partial<Record<HandoffTarget, InstallState>> = {};
const refreshCalls: string[] = [];
const dispatchCalls: Array<{ target: HandoffTarget; input: unknown }> = [];
const installCalls: TargetData[] = [];
let workspace: unknown = { projectDir: '/project' };

mock.module('@/components/handoff/OpenInAgentMenuItem', () => ({
  TargetIcon: ({ id }: { id: HandoffTarget }) => <svg data-testid={`target-icon-${id}`} />,
}));

mock.module('@/components/handoff/useInstalledAgents', () => ({
  useInstalledAgents: () => ({
    states,
    refresh: () => {
      refreshCalls.push('refresh');
    },
  }),
}));

mock.module('@/components/handoff/useHandoffDispatch', () => ({
  buildProjectScopedHandoffInput: ({ workspace: currentWorkspace }: { workspace: unknown }) =>
    currentWorkspace === null ? null : { scope: 'project', workspace: currentWorkspace },
  openInstallUrl: (target: TargetData) => {
    installCalls.push(target);
    return Promise.resolve();
  },
  useHandoffDispatch: () => ({
    dispatch: (target: HandoffTarget, input: unknown) => {
      dispatchCalls.push({ target, input });
      return Promise.resolve({ ok: true });
    },
  }),
}));

mock.module('@/lib/use-workspace', () => ({
  useWorkspace: () => workspace,
}));

async function renderAgentHandoffGrid() {
  const { AgentHandoffGrid } = await import('./AgentHandoffGrid');
  render(<AgentHandoffGrid />);
}

function setInstallStates(value: InstallState['installed']) {
  states['claude-code'] = { installed: value };
  states.codex = { installed: value };
  states.cursor = { installed: value };
}

describe('AgentHandoffGrid runtime behavior', () => {
  afterEach(() => {
    cleanup();
    for (const key of Object.keys(states) as HandoffTarget[]) delete states[key];
    refreshCalls.length = 0;
    dispatchCalls.length = 0;
    installCalls.length = 0;
    workspace = { projectDir: '/project' };
  });

  test('exports the component', async () => {
    const mod = await import('./AgentHandoffGrid');
    expect(typeof mod.AgentHandoffGrid).toBe('function');
  });

  test('renders only visible installed targets as Open buttons and dispatches through the shared hook', async () => {
    setInstallStates(true);
    await renderAgentHandoffGrid();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(screen.queryByText('Claude Cowork')).toBeNull();
    expect(screen.getByText('Claude')).not.toBeNull();
    expect(screen.getByText('Codex')).not.toBeNull();
    expect(screen.getByText('Cursor')).not.toBeNull();
    expect(buttons.every((button) => button.textContent?.includes('Open'))).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /Codex/ }));
    expect(dispatchCalls).toEqual([
      {
        target: 'codex',
        input: { scope: 'project', workspace: { projectDir: '/project' } },
      },
    ]);
  });

  test('disables installed Open buttons while workspace input is unavailable', async () => {
    setInstallStates(true);
    workspace = null;
    await renderAgentHandoffGrid();

    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.textContent).toContain('Open');
    }
  });

  test('missing targets open the install URL and refresh probe state', async () => {
    setInstallStates(false);
    await renderAgentHandoffGrid();

    const codex = screen.getByRole('button', { name: /Codex/ });
    expect(codex.textContent).toContain('Install');
    expect((codex as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(codex);
    expect(installCalls.map((target) => target.id)).toEqual(['codex']);
    expect(refreshCalls).toEqual(['refresh']);
    expect(dispatchCalls).toEqual([]);
  });

  test('pending targets render disabled Checking buttons instead of install links', async () => {
    setInstallStates(null);
    await renderAgentHandoffGrid();

    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.textContent).toContain('Checking');
    }
    expect(installCalls).toEqual([]);
    expect(dispatchCalls).toEqual([]);
  });
});
