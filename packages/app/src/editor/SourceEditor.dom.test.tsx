import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { Config } from '@inkeep/open-knowledge-core';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { OpenInAgentMenuRequestProvider } from '@/components/handoff/OpenInAgentMenuRequestContext';
import { ConfigContext, type ConfigContextValue } from '@/lib/config-context';
import { evictCmEditor } from './editor-cache';
import { SourceEditor } from './SourceEditor';

const originalFetch = globalThis.fetch;
const openRequests: unknown[] = [];
(globalThis as { Window?: typeof window.Window }).Window = window.Window;
Object.defineProperty(window.Range.prototype, 'getClientRects', {
  configurable: true,
  value: () => [],
});
Object.defineProperty(window.Range.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: () => ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 }),
});

const mountedDocNames = new Set<string>();

function makeConfigValue(wordWrap: boolean): ConfigContextValue {
  return {
    userBinding: null,
    userSynced: false,
    projectBinding: null,
    projectLocalBinding: null,
    okignoreBinding: null,
    okignoreSynced: false,
    userConfig: null,
    projectConfig: null,
    projectLocalConfig: null,
    projectLocalSynced: false,
    merged: { editor: { wordWrap } } as Config,
  };
}

function makeProvider(docName: string): { provider: HocuspocusProvider; ytext: Y.Text } {
  const document = new Y.Doc();
  const ytext = document.getText('source');
  ytext.insert(0, '# heading\n\nbody');
  const awareness = new Awareness(document);
  const provider = {
    document,
    awareness,
    configuration: { name: docName },
    destroy: () => {
      awareness.destroy();
      document.destroy();
    },
  } as unknown as HocuspocusProvider;
  mountedDocNames.add(docName);
  return { provider, ytext };
}

function Harness({
  provider,
  ytext,
  wordWrap,
  isSourceModeActive = true,
}: {
  provider: HocuspocusProvider;
  ytext: Y.Text;
  wordWrap: boolean;
  isSourceModeActive?: boolean;
}) {
  return (
    <ConfigContext value={makeConfigValue(wordWrap)}>
      <OpenInAgentMenuRequestProvider
        value={{
          openSelection(request) {
            openRequests.push(request);
            return true;
          },
        }}
      >
        <SourceEditor
          docName={provider.configuration.name ?? 'test-source'}
          ytext={ytext}
          provider={provider}
          isSourceModeActive={isSourceModeActive}
        />
      </OpenInAgentMenuRequestProvider>
    </ConfigContext>
  );
}

async function findCmContent(container: HTMLElement): Promise<HTMLElement> {
  await waitFor(() => {
    expect(container.querySelector('.cm-content')).toBeTruthy();
  });
  return container.querySelector<HTMLElement>('.cm-content');
}

function setPlatform(platform: string): void {
  Object.defineProperty(globalThis.navigator, 'platform', {
    value: platform,
    configurable: true,
  });
}

describe('SourceEditor word-wrap preference wiring', () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/pages') return Response.json({ pages: [] });
      if (url === '/api/documents') return Response.json({ documents: [] });
      if (url === '/api/tags') return Response.json({ tags: [] });
      return Response.json({}, { status: 404 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    for (const docName of mountedDocNames) {
      evictCmEditor(docName);
    }
    mountedDocNames.clear();
    openRequests.length = 0;
    globalThis.fetch = originalFetch;
  });

  test('applies editor.wordWrap to the source CodeMirror instance', async () => {
    const { provider, ytext } = makeProvider('source-word-wrap-off');
    const { container } = render(<Harness provider={provider} ytext={ytext} wordWrap={false} />);

    const content = await findCmContent(container);

    expect(content.classList.contains('cm-lineWrapping')).toBe(false);
  });

  test('hot-swaps source CodeMirror line wrapping without remounting', async () => {
    const { provider, ytext } = makeProvider('source-word-wrap-hot-swap');
    const { container, rerender } = render(
      <Harness provider={provider} ytext={ytext} wordWrap={true} />,
    );

    const content = await findCmContent(container);
    const cmEditor = container.querySelector('.cm-editor');
    expect(content.classList.contains('cm-lineWrapping')).toBe(true);

    rerender(<Harness provider={provider} ytext={ytext} wordWrap={false} />);

    await waitFor(() => {
      expect(content.classList.contains('cm-lineWrapping')).toBe(false);
    });
    expect(container.querySelector('.cm-editor')).toBe(cmEditor);
  });

  test('Cmd+Shift+I requests the header Open with AI menu with the source selection', async () => {
    setPlatform('MacIntel');
    const { provider, ytext } = makeProvider('source-edit-with-ai');
    const { container } = render(<Harness provider={provider} ytext={ytext} wordWrap={true} />);

    const content = await findCmContent(container);
    const view = EditorView.findFromDOM(content);
    expect(view).toBeTruthy();
    view?.dispatch({ selection: EditorSelection.range(2, 9) });

    await act(async () => {
      content.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'I',
          code: 'KeyI',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(openRequests).toEqual([
      {
        docName: 'source-edit-with-ai',
        instruction: '',
        selectionMarkdown: 'heading',
      },
    ]);
  });

  test('Cmd+Shift+I does not fire when source mode is inactive', async () => {
    setPlatform('MacIntel');
    const { provider, ytext } = makeProvider('source-edit-with-ai-inactive');
    const { container } = render(
      <Harness provider={provider} ytext={ytext} wordWrap={true} isSourceModeActive={false} />,
    );

    const content = await findCmContent(container);
    const view = EditorView.findFromDOM(content);
    expect(view).toBeTruthy();
    view?.dispatch({ selection: EditorSelection.range(2, 9) });

    await act(async () => {
      content.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'I',
          code: 'KeyI',
          metaKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(openRequests).toEqual([]);
  });

  test('Cmd+Shift+I does not fire on non-macOS', async () => {
    setPlatform('Linux x86_64');
    const { provider, ytext } = makeProvider('source-edit-with-ai-non-mac');
    const { container } = render(<Harness provider={provider} ytext={ytext} wordWrap={true} />);

    const content = await findCmContent(container);
    const view = EditorView.findFromDOM(content);
    expect(view).toBeTruthy();
    view?.dispatch({ selection: EditorSelection.range(2, 9) });

    await act(async () => {
      content.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'I',
          code: 'KeyI',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(openRequests).toEqual([]);
  });
});
