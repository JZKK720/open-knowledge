'use client';

import type { EditorView } from '@codemirror/view';
import { MarkdownManager, sharedExtensions } from '@inkeep/open-knowledge-core';
import type { Editor } from '@tiptap/core';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import dynamic from 'next/dynamic';
import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import './ok-editor.css';
import { OkBubbleMenu } from './bubble-menu';
import { BlockDragHandle } from './drag-handle';
import { type EditorMode, ModeToggle } from './mode-toggle';
import { PreviewCodeBlock } from './preview-code-block';
import { HERO_SEED_MARKDOWN } from './seed';
import { SlashCommand } from './slash-command';

const SourceEditor = dynamic(() => import('./source-editor').then((m) => m.SourceEditor), {
  ssr: false,
});

const markdownManager = new MarkdownManager({ extensions: sharedExtensions });
const extensions = [
  ...sharedExtensions.map((ext) => (ext.name === 'codeBlock' ? PreviewCodeBlock : ext)),
  UndoRedo,
  SlashCommand,
  BlockDragHandle,
  Placeholder.configure({ placeholder: "Type '/' for commands", showOnlyCurrent: true }),
];

export function parseEditorMarkdown(markdown: string) {
  return markdownManager.parse(markdown);
}

export interface EditorDocStats {
  words: number;
  chars: number;
  tokens: number;
}

const EMPTY_STATS: EditorDocStats = { words: 0, chars: 0, tokens: 0 };

function computeDocStats(editor: Editor): EditorDocStats {
  let text = '';
  let chars = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock') {
      const meta = typeof node.attrs.meta === 'string' ? node.attrs.meta : '';
      if (node.attrs.language === 'html' && /\bpreview\b/.test(meta)) return false;
    }
    if (node.isText) {
      const s = node.text ?? '';
      text += s;
      chars += s.length;
      return true;
    }
    if (node.type.isBlock && text.length > 0 && !text.endsWith('\n')) text += '\n';
    return true;
  });
  const words = text.trim() ? (text.trim().match(/\S+/g)?.length ?? 0) : 0;
  return { words, chars, tokens: Math.ceil(chars / 4) };
}

export function useEditorDocStats(): EditorDocStats {
  const { editor } = useOkEditor();
  return (
    useEditorState({
      editor,
      selector: ({ editor }) => (editor ? computeDocStats(editor) : EMPTY_STATS),
    }) ?? EMPTY_STATS
  );
}

interface OkEditorContextValue {
  editor: Editor | null;
  mode: EditorMode;
  switchMode: (mode: EditorMode) => void;
  sourceDoc: string;
  sourceViewRef: RefObject<EditorView | null>;
}

const OkEditorContext = createContext<OkEditorContextValue | null>(null);

export function useOkEditor(): OkEditorContextValue {
  const ctx = use(OkEditorContext);
  if (!ctx) throw new Error('OkEditor components must be rendered inside <OkEditorProvider>');
  return ctx;
}

export function OkEditorProvider({
  children,
  initialMarkdown,
  frontmatter,
}: {
  children: ReactNode;
  initialMarkdown?: string;
  /** Optional YAML frontmatter block (`---\n…\n---`) revealed above the body in
   *  Markdown mode. The body editor stays frontmatter-free (the property panel is
   *  its display chrome); this only round-trips through the source view. */
  frontmatter?: string;
}) {
  const [mode, setMode] = useState<EditorMode>('visual');
  const [sourceDoc, setSourceDoc] = useState('');
  const sourceViewRef = useRef<EditorView | null>(null);
  const [initialContent] = useState(() =>
    markdownManager.parse(initialMarkdown ?? HERO_SEED_MARKDOWN),
  );

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: true,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'ok-editor-prose focus:outline-none', spellcheck: 'false' },
    },
  });

  function switchMode(next: EditorMode) {
    if (next === mode || !editor) return;
    if (next === 'source') {
      const body = markdownManager.serialize(editor.getJSON());
      setSourceDoc(frontmatter ? `${frontmatter}\n\n${body}` : body);
    } else {
      const raw = sourceViewRef.current?.state.doc.toString() ?? sourceDoc;
      const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n)*/, '');
      editor.commands.setContent(markdownManager.parse(body));
    }
    setMode(next);
  }

  return (
    <OkEditorContext value={{ editor, mode, switchMode, sourceDoc, sourceViewRef }}>
      {children}
    </OkEditorContext>
  );
}

export function OkEditorModeToggle() {
  const { mode, switchMode } = useOkEditor();
  return <ModeToggle mode={mode} onChange={switchMode} />;
}

export function OkEditorBody() {
  const { editor, mode, sourceDoc, sourceViewRef } = useOkEditor();

  const visualHostRef = useRef<HTMLDivElement>(null);
  const [visualHost, setVisualHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setVisualHost(visualHostRef.current);
  }, []);

  return (
    <>
      <div ref={visualHostRef} className="ok-editor-visual" hidden={mode !== 'visual'} />
      {visualHost &&
        createPortal(
          // biome-ignore lint/plugin/no-unportaled-editor-content: single non-pooled editor portalled into an exclusively-owned target — the rule's canonical shape; no Activity pool / editor cache in this marketing preview.
          <EditorContent editor={editor} />,
          visualHost,
        )}
      {editor && mode === 'visual' && <OkBubbleMenu editor={editor} />}
      {mode === 'source' && <SourceEditor initialDoc={sourceDoc} viewRef={sourceViewRef} />}
    </>
  );
}
