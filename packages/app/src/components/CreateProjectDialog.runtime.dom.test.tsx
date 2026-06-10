import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { ALL_EDITOR_IDS, EDITOR_LABELS } from '@inkeep/open-knowledge-core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  OkDesktopBridge,
  OkFolderState,
  OkMcpWiringEditorId,
} from '@/lib/desktop-bridge-types';
import { CreateProjectDialog } from './CreateProjectDialog';

type WindowGlobals = {
  NodeFilter?: typeof NodeFilter;
};
type GlobalWithDomShims = typeof globalThis &
  WindowGlobals & {
    window?: WindowGlobals;
    ResizeObserver?: unknown;
  };
const globalWithDomShims = globalThis as GlobalWithDomShims;
if (
  globalWithDomShims.NodeFilter === undefined &&
  globalWithDomShims.window?.NodeFilter !== undefined
) {
  globalWithDomShims.NodeFilter = globalWithDomShims.window.NodeFilter;
}
if (globalWithDomShims.ResizeObserver === undefined) {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalWithDomShims.ResizeObserver = NoopResizeObserver;
}

const PARENT = '/Users/test/Projects';
const TARGET = `${PARENT}/Runtime Project`;
const SECOND_TARGET = `${PARENT}/Second Project`;

function makeBridge() {
  let pickedPath: string | null = TARGET;
  let folderStateImpl = async (): Promise<OkFolderState> => 'free';
  const openFolderArgs: unknown[] = [];
  const folderStateCalls: string[] = [];
  const bannerCalls: string[] = [];
  const createNewCalls: Array<{
    parent: string;
    name: string;
    editors: OkMcpWiringEditorId[];
  }> = [];

  const bridge = {
    fs: {
      defaultProjectsRoot: mock(() => Promise.resolve(PARENT)),
      findEnclosingProjectRoot: mock(() => Promise.resolve(null)),
      findEnclosingGitRoot: mock(() => Promise.resolve(null)),
      folderState: mock((path: string) => {
        folderStateCalls.push(path);
        return folderStateImpl(path);
      }),
      removeGitFolder: mock(() => Promise.resolve()),
    },
    dialog: {
      openFolder: mock((options?: unknown) => {
        openFolderArgs.push(options);
        return Promise.resolve(pickedPath);
      }),
    },
    project: {
      recordCreateNewBannerShown: mock((banner: string) => {
        bannerCalls.push(banner);
        return Promise.resolve();
      }),
      createNew: mock(
        (payload: { parent: string; name: string; editors: OkMcpWiringEditorId[] }) => {
          createNewCalls.push(payload);
          return Promise.resolve();
        },
      ),
      open: mock(() => Promise.resolve()),
    },
  } as unknown as OkDesktopBridge;

  return {
    bridge,
    bannerCalls,
    createNewCalls,
    folderStateCalls,
    openFolderArgs,
    setPickedPath: (next: string | null) => {
      pickedPath = next;
    },
    setFolderStateImpl: (next: (path: string) => Promise<OkFolderState>) => {
      folderStateImpl = next;
    },
  };
}

async function renderDialog(stub = makeBridge()) {
  const onOpenChange = mock(() => {});
  render(<CreateProjectDialog open={true} onOpenChange={onOpenChange} bridge={stub.bridge} />);
  await screen.findByTestId('create-project-dialog');
  return { ...stub, onOpenChange };
}

async function browseAndWaitForTarget(target = TARGET) {
  fireEvent.click(screen.getByTestId('create-browse'));
  await waitFor(
    () => {
      expect(screen.getByTestId('create-target-caption').textContent).toBe(target);
    },
    { timeout: 2000 },
  );
}

async function waitForSubmitEnabled() {
  await waitFor(
    () => {
      expect((screen.getByTestId('create-submit') as HTMLButtonElement).disabled).toBe(false);
    },
    { timeout: 2000 },
  );
}

describe('CreateProjectDialog runtime wiring', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  test('cancel, browse, editor labels, and submit are wired through the mounted form', async () => {
    const stub = await renderDialog();

    const form = screen.getByTestId('create-project-form') as HTMLFormElement;
    const cancel = screen.getByTestId('create-cancel') as HTMLButtonElement;
    const submit = screen.getByTestId('create-submit') as HTMLButtonElement;
    const browse = screen.getByTestId('create-browse') as HTMLButtonElement;

    expect(cancel.type).toBe('button');
    expect(submit.type).toBe('submit');
    expect(submit.getAttribute('form')).toBe(form.id);
    expect(browse.type).toBe('button');

    for (const id of ALL_EDITOR_IDS) {
      const checkbox = screen.getByTestId(`create-editor-${id}`);
      expect(checkbox.closest('label')?.textContent).toContain(EDITOR_LABELS[id]);
      expect(checkbox.getAttribute('aria-checked')).toBe('true');
    }

    fireEvent.click(screen.getByTestId('create-editor-cursor'));
    expect(screen.getByTestId('create-editor-cursor').getAttribute('aria-checked')).toBe('false');

    fireEvent.click(cancel);
    expect(stub.onOpenChange).toHaveBeenCalledWith(false);
    expect(stub.createNewCalls).toEqual([]);

    await browseAndWaitForTarget();
    expect(stub.openFolderArgs.at(-1)).toEqual({ defaultPath: PARENT });
    await waitForSubmitEnabled();

    fireEvent.click(submit);

    await waitFor(() => {
      expect(stub.createNewCalls).toEqual([
        {
          parent: PARENT,
          name: 'Runtime Project',
          editors: ALL_EDITOR_IDS.filter((id) => id !== 'cursor'),
          sharing: 'shared',
        },
      ]);
    });
    expect(stub.onOpenChange).toHaveBeenLastCalledWith(false);
  });

  test('subfolder rescue sticks through a free re-probe and resets on a fresh Browse pick', async () => {
    const stub = makeBridge();
    stub.setFolderStateImpl(async (path) => (path === TARGET ? 'exists-nonempty' : 'free'));
    await renderDialog(stub);

    await browseAndWaitForTarget();

    await waitFor(
      () => {
        expect(screen.getByTestId('create-subfolder-rescue')).not.toBeNull();
      },
      { timeout: 2000 },
    );
    expect(stub.bannerCalls).toContain('nonempty');

    fireEvent.change(screen.getByTestId('create-subfolder-input'), {
      target: { value: 'Nested Notes' },
    });

    await waitFor(
      () => {
        expect((screen.getByTestId('create-subfolder-input') as HTMLInputElement).value).toBe(
          'Nested Notes',
        );
        expect((screen.getByTestId('create-submit') as HTMLButtonElement).disabled).toBe(false);
      },
      { timeout: 2000 },
    );

    stub.setPickedPath(SECOND_TARGET);
    stub.setFolderStateImpl(async () => 'free');
    fireEvent.click(screen.getByTestId('create-browse'));

    await waitFor(
      () => {
        expect(screen.getByTestId('create-target-caption').textContent).toBe(SECOND_TARGET);
        expect(screen.queryByTestId('create-subfolder-rescue')).toBeNull();
      },
      { timeout: 2000 },
    );
  });
});
