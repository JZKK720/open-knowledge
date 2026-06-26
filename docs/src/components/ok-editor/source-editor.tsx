'use client';

import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { type RefObject, useEffect, useRef } from 'react';

const cmTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--slide-text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8125rem',
    lineHeight: '1.7',
    padding: '0',
    caretColor: 'var(--slide-text)',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--slide-text)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklab, var(--primary) 18%, transparent)',
  },
});

export function SourceEditor({
  initialDoc,
  viewRef,
}: {
  initialDoc: string;
  viewRef: RefObject<EditorView | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-once — parent re-mounts with a fresh initialDoc each source-mode entry; viewRef is a stable ref. Reacting would rebuild the CodeMirror view mid-edit.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          cmTheme,
        ],
      }),
    });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return <div ref={hostRef} className="ok-source-host" />;
}
