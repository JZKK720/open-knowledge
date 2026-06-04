import { afterEach, describe, expect, mock, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { TooltipProvider } from '@/components/ui/tooltip';

mock.module('@/components/PageListContext', () => ({
  usePageList: () => ({
    folderPaths: new Set(['guides']),
    loading: false,
    pages: new Set(['guides/install']),
  }),
}));

const { LinkEditPopover } = await import('./LinkEditPopover');

const nativeRequestAnimationFrame = globalThis.requestAnimationFrame;
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = ((callback) => {
    callback(0);
    return 0;
  }) as typeof globalThis.requestAnimationFrame;
}

function makeEditor({
  active = true,
  href = 'https://example.com',
  onSetLink,
  onUnsetLink,
  selectionEmpty = true,
}: {
  active?: boolean;
  href?: string;
  onSetLink?: (attrs: { href: string }) => void;
  onUnsetLink?: () => void;
  selectionEmpty?: boolean;
} = {}): Editor {
  const chain = {
    focus: () => chain,
    run: () => true,
    setLink: (attrs: { href: string }) => {
      onSetLink?.(attrs);
      return chain;
    },
    unsetLink: () => {
      onUnsetLink?.();
      return chain;
    },
  };

  return {
    state: { selection: { empty: selectionEmpty } },
    getAttributes: mock((name: string) => (name === 'link' ? { href } : {})),
    isActive: mock((name: string) => name === 'link' && active),
    on: mock(() => {}),
    off: mock(() => {}),
    chain: () => chain,
  } as unknown as Editor;
}

function renderPopover(editor: Editor) {
  return render(
    <TooltipProvider>
      <LinkEditPopover editor={editor} />
    </TooltipProvider>,
  );
}

afterEach(() => {
  cleanup();
  if (nativeRequestAnimationFrame) {
    globalThis.requestAnimationFrame = nativeRequestAnimationFrame;
  }
});

describe('LinkEditPopover', () => {
  test('prefills the current URL when editing an active collapsed link', () => {
    renderPopover(makeEditor({ href: 'https://example.com/docs' }));

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert link' }));

    expect((screen.getByRole('combobox', { name: 'Link URL' }) as HTMLInputElement).value).toBe(
      'https://example.com/docs',
    );
  });

  test('starts empty for a non-collapsed selection even when the link mark is active', () => {
    renderPopover(makeEditor({ href: 'https://example.com/docs', selectionEmpty: false }));

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert link' }));

    expect((screen.getByRole('combobox', { name: 'Link URL' }) as HTMLInputElement).value).toBe('');
  });

  test('applies a trimmed URL with Enter and dismisses the input', () => {
    const setLink = mock((_attrs: { href: string }) => {});
    const unsetLink = mock(() => {});
    renderPopover(makeEditor({ active: false, onSetLink: setLink, onUnsetLink: unsetLink }));

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert link' }));
    const input = screen.getByRole('combobox', { name: 'Link URL' });
    fireEvent.change(input, { target: { value: '  https://example.com/new  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(setLink).toHaveBeenCalledWith({ href: 'https://example.com/new' });
    expect(unsetLink).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: 'Link URL' })).toBeNull();
  });

  test('submitting an empty active collapsed link unsets it', async () => {
    const setLink = mock((_attrs: { href: string }) => {});
    const unsetLink = mock(() => {});
    renderPopover(
      makeEditor({
        href: '',
        onSetLink: setLink,
        onUnsetLink: unsetLink,
      }),
    );

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply link' }));

    expect(setLink).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(unsetLink).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: 'Link URL' })).toBeNull();
    });
  });

  test('empty inactive input is a no-op and still dismisses', async () => {
    const setLink = mock((_attrs: { href: string }) => {});
    const unsetLink = mock(() => {});
    renderPopover(makeEditor({ active: false, onSetLink: setLink, onUnsetLink: unsetLink }));

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Insert link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply link' }));

    expect(setLink).not.toHaveBeenCalled();
    expect(unsetLink).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: 'Link URL' })).toBeNull();
    });
  });
});
