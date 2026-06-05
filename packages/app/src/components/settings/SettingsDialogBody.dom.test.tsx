import { afterEach, describe, expect, test } from 'bun:test';
import {
  type Config,
  type ConfigBinding,
  type ConfigPatch,
  ConfigSchema,
} from '@inkeep/open-knowledge-core';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SettingsDialogBody } from './SettingsDialogBody';

function makeBinding(config: Config = ConfigSchema.parse({})): {
  binding: ConfigBinding;
  patches: ConfigPatch[];
} {
  const patches: ConfigPatch[] = [];
  const binding: ConfigBinding = {
    current: () => config,
    patch: (patch: ConfigPatch) => {
      patches.push(patch);
      return {
        ok: true,
        effective: ConfigSchema.parse({ ...config, ...patch }),
        appliedPaths: ['editor.wordWrap'],
      };
    },
    subscribe: () => () => {},
    hasSynced: () => true,
    subscribeSynced: (listener) => {
      queueMicrotask(listener);
      return () => {};
    },
    dispose: () => {},
  };
  return { binding, patches };
}

describe('SettingsDialogBody preferences runtime', () => {
  afterEach(() => {
    cleanup();
  });

  test('renders editor.wordWrap in the Preferences section', () => {
    const { binding } = makeBinding();
    const { container } = render(
      <TooltipProvider>
        <SettingsDialogBody
          activeId="preferences"
          userBinding={binding}
          okignoreBinding={null}
          okignoreSynced={false}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeDefined();
    expect(screen.getByText('Word wrap')).toBeDefined();
    expect(screen.getByText('Wrap long lines in the markdown source editor.')).toBeDefined();
    const field = container.querySelector('[data-field="editor.wordWrap"]');
    expect(field).toBeTruthy();
    expect(field?.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
  });

  test('commits editor.wordWrap changes through binding.patch', async () => {
    const user = userEvent.setup();
    const { binding, patches } = makeBinding();
    render(
      <TooltipProvider>
        <SettingsDialogBody
          activeId="preferences"
          userBinding={binding}
          okignoreBinding={null}
          okignoreSynced={false}
        />
      </TooltipProvider>,
    );

    const wordWrapSwitch = screen.getByRole('switch', { name: 'Word wrap' });
    await user.click(wordWrapSwitch);

    await waitFor(() => {
      expect(patches).toEqual([{ editor: { wordWrap: false } }]);
    });
    expect(wordWrapSwitch.getAttribute('aria-checked')).toBe('false');
  });

  test('renders appearance.preview.autoOpen in the Preferences section', () => {
    const { binding } = makeBinding();
    const { container } = render(
      <TooltipProvider>
        <SettingsDialogBody
          activeId="preferences"
          userBinding={binding}
          okignoreBinding={null}
          okignoreSynced={false}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText('Open preview when agent edits')).toBeDefined();
    expect(
      screen.getByText(
        'When enabled, the agent opens or refreshes the preview after each edit. Disable if you manage your own preview window (OK Desktop, a browser tab on another display, etc.).',
      ),
    ).toBeDefined();
    const field = container.querySelector('[data-field="appearance.preview.autoOpen"]');
    expect(field).toBeTruthy();
    expect(field?.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
  });

  test('renders shared hotkeys in the Hotkeys section', () => {
    render(
      <TooltipProvider>
        <SettingsDialogBody
          activeId="hotkeys"
          userBinding={null}
          okignoreBinding={null}
          okignoreSynced={false}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Hotkeys' })).toBeDefined();
    expect(screen.getByTestId('settings-hotkeys-list')).toBeDefined();
    expect(screen.getByTestId('settings-hotkey-command-palette')).toBeDefined();
    expect(screen.getByText('Command palette')).toBeDefined();
    expect(screen.queryByText(/Chrome uses this to search/)).toBeNull();
  });

  test('keeps long hotkey rows compact when shortcut chips wrap', () => {
    render(
      <TooltipProvider>
        <SettingsDialogBody
          activeId="hotkeys"
          userBinding={null}
          okignoreBinding={null}
          okignoreSynced={false}
        />
      </TooltipProvider>,
    );

    const row = screen.getByTestId('settings-hotkey-source-editing');
    expect(row.className).toContain('sm:grid-cols-1');
    const shortcutColumn = row.children.item(1);
    expect(shortcutColumn?.className).toContain('min-w-0');
    expect(shortcutColumn?.className).toContain('self-start');
    expect(shortcutColumn?.className).toContain('content-start');
    expect(shortcutColumn?.className).toContain('flex-wrap');
    expect(shortcutColumn?.className).toContain('sm:justify-start');

    const shortRow = screen.getByTestId('settings-hotkey-command-palette');
    expect(shortRow.className).toContain('sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)]');
    expect(shortRow.children.item(1)?.className).toContain('sm:justify-end');
  });

  test('commits appearance.preview.autoOpen changes through binding.patch', async () => {
    const user = userEvent.setup();
    const { binding, patches } = makeBinding();
    render(
      <TooltipProvider>
        <SettingsDialogBody
          activeId="preferences"
          userBinding={binding}
          okignoreBinding={null}
          okignoreSynced={false}
        />
      </TooltipProvider>,
    );

    const autoOpenSwitch = screen.getByRole('switch', { name: 'Open preview when agent edits' });
    expect(autoOpenSwitch.getAttribute('aria-checked')).toBe('true');
    await user.click(autoOpenSwitch);

    await waitFor(() => {
      expect(patches).toEqual([{ appearance: { preview: { autoOpen: false } } }]);
    });
    expect(autoOpenSwitch.getAttribute('aria-checked')).toBe('false');

    await user.click(autoOpenSwitch);
    await waitFor(() => {
      expect(patches).toEqual([
        { appearance: { preview: { autoOpen: false } } },
        { appearance: { preview: { autoOpen: true } } },
      ]);
    });
    expect(autoOpenSwitch.getAttribute('aria-checked')).toBe('true');
  });
});
