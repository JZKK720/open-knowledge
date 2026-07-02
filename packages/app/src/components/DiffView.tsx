import { undo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { getChunks, MergeView, unifiedMergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { basicDarkInit, basicLightInit } from '@uiw/codemirror-theme-basic';
import { basicSetup } from 'codemirror';
import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConflictFooterHeightVar } from '@/hooks/use-conflict-footer-height';
import { Button } from './ui/button';

const darkTheme = basicDarkInit({
  settings: {
    background: 'var(--background)',
    gutterBackground: 'var(--muted)',
  },
});

const lightTheme = basicLightInit({
  settings: {
    background: 'var(--background)',
    gutterBackground: 'var(--muted)',
  },
});

const conflictMergeControlTheme = EditorView.theme({
  '.cm-deletedChunk .cm-chunkButtons': {
    display: 'flex',
    gap: '0.25rem',
  },
  ".cm-deletedChunk .cm-chunkButtons button[data-slot='button']": {
    margin: '0',
    border: '1px solid transparent',
    borderRadius: 'min(var(--radius-md), 10px)',
    color: 'var(--primary-foreground)',
  },
  ".cm-deletedChunk .cm-chunkButtons button[data-slot='button'][data-variant='destructive']": {
    color: 'var(--destructive)',
  },
});

export type DiffLayout = 'unified' | 'split';

interface MergeControlPortal {
  id: number;
  host: HTMLElement;
  type: 'reject' | 'accept';
  action: (event: MouseEvent) => void;
}

function createMergeControlRenderer({
  addControl,
  nextId,
  removeControl,
  root,
}: {
  addControl: (control: MergeControlPortal) => void;
  nextId: () => number;
  removeControl: (id: number) => void;
  root: HTMLElement;
}) {
  return (type: 'reject' | 'accept', action: (event: MouseEvent) => void): HTMLElement => {
    const host = document.createElement('span');
    host.className = 'inline-flex';
    const id = nextId();
    addControl({ id, host, type, action });
    queueMicrotask(() => {
      if (!root.contains(host)) removeControl(id);
    });
    return host;
  };
}

interface DiffViewProps {
  oldContent: string;
  newContent: string;
  layout: DiffLayout;
  conflictMode?: boolean;
  previewMode?: boolean;
  oursOverride?: string;
  onResolve?: (content: string) => void;
  onAbort?: () => void;
}

export function DiffView({
  oldContent,
  newContent,
  layout,
  conflictMode,
  previewMode,
  oursOverride,
  onResolve,
  onAbort,
}: DiffViewProps) {
  const { t } = useLingui();
  const effectiveNewContent = oursOverride ?? newContent;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | EditorView | null>(null);
  const mergeControlIdRef = useRef(0);
  const { resolvedTheme } = useTheme();
  const onResolveRef = useRef(onResolve);
  const onAbortRef = useRef(onAbort);
  const [chunksRemaining, setChunksRemaining] = useState<number | null>(null);
  const [mergeControls, setMergeControls] = useState<MergeControlPortal[]>([]);
  const conflictFooterRef = useConflictFooterHeightVar(conflictMode === true);
  useEffect(() => {
    onResolveRef.current = onResolve;
    onAbortRef.current = onAbort;
  });

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    setMergeControls([]);
    const mergeControlHosts = new Map<number, HTMLElement>();
    let disposed = false;
    const removeMergeControl = (id: number) => {
      if (disposed || !mergeControlHosts.delete(id)) return;
      setMergeControls((controls) => controls.filter((control) => control.id !== id));
    };
    const mergeControlObserver = new MutationObserver(() => {
      for (const [id, host] of mergeControlHosts) {
        if (!root.contains(host)) removeMergeControl(id);
      }
    });
    mergeControlObserver.observe(root, { childList: true, subtree: true });

    const theme = resolvedTheme === 'dark' ? darkTheme : lightTheme;
    const readOnly = [EditorView.editable.of(false), EditorState.readOnly.of(true)];
    const sharedExtensions = [basicSetup, markdown(), ...readOnly, theme, EditorView.lineWrapping];

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    if (previewMode) {
      const view = new EditorView({
        doc: effectiveNewContent,
        extensions: sharedExtensions,
        parent: root,
      });
      viewRef.current = view;
      setChunksRemaining(null);
    } else if (conflictMode) {
      const renderMergeControl = createMergeControlRenderer({
        addControl: (control) => {
          if (disposed) return;
          mergeControlHosts.set(control.id, control.host);
          setMergeControls((controls) => [...controls, control]);
        },
        nextId: () => {
          mergeControlIdRef.current += 1;
          return mergeControlIdRef.current;
        },
        removeControl: removeMergeControl,
        root,
      });
      const conflictExtensions = [
        basicSetup,
        markdown(),
        EditorView.editable.of(false),
        theme,
        conflictMergeControlTheme,
        EditorView.lineWrapping,
        unifiedMergeView({
          original: oldContent,
          highlightChanges: true,
          gutter: true,
          mergeControls: renderMergeControl,
          collapseUnchanged: { margin: 3, minSize: 4 },
        }),
        EditorView.updateListener.of((update) => {
          const result = getChunks(update.state);
          setChunksRemaining(result ? result.chunks.length : 0);
        }),
      ];
      const view = new EditorView({
        doc: effectiveNewContent,
        extensions: conflictExtensions,
        parent: root,
      });
      viewRef.current = view;
      const initial = getChunks(view.state);
      setChunksRemaining(initial ? initial.chunks.length : 0);
    } else if (layout === 'split') {
      const mv = new MergeView({
        a: { doc: oldContent, extensions: sharedExtensions },
        b: { doc: effectiveNewContent, extensions: sharedExtensions },
        parent: root,
        highlightChanges: true,
        gutter: true,
        collapseUnchanged: { margin: 3, minSize: 4 },
      });
      viewRef.current = mv;
    } else {
      const view = new EditorView({
        doc: effectiveNewContent,
        extensions: [
          ...sharedExtensions,
          unifiedMergeView({
            original: oldContent,
            highlightChanges: true,
            gutter: true,
            mergeControls: false,
            collapseUnchanged: { margin: 3, minSize: 4 },
          }),
        ],
        parent: root,
      });
      viewRef.current = view;
    }

    return () => {
      disposed = true;
      mergeControlObserver.disconnect();
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [oldContent, effectiveNewContent, layout, resolvedTheme, conflictMode, previewMode]);

  function handleSaveResolution() {
    const view = viewRef.current;
    if (!view || !(view instanceof EditorView)) return;
    onResolveRef.current?.(view.state.doc.toString());
  }

  function handleUndo() {
    const view = viewRef.current;
    if (!view || !(view instanceof EditorView)) return;
    undo(view);
  }

  const allResolved = chunksRemaining === 0;
  const hunksLabel =
    chunksRemaining === null
      ? ''
      : chunksRemaining === 0
        ? t`All hunks resolved`
        : plural(chunksRemaining, {
            one: '# unresolved hunk',
            other: '# unresolved hunks',
          });

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="diff-view min-h-0 flex-1 overflow-y-auto subtle-scrollbar"
      />
      {mergeControls.map((control) =>
        createPortal(
          <Button
            type="button"
            variant={control.type === 'accept' ? 'default' : 'destructive'}
            size="xs"
            onClick={(event) => {
              control.action(event.nativeEvent);
            }}
          >
            {control.type === 'accept' ? t`Accept` : t`Reject`}
          </Button>,
          control.host,
          control.id,
        ),
      )}
      {conflictMode && (
        <div
          ref={conflictFooterRef}
          className="flex items-center justify-between gap-2 px-3 py-2 border-t shrink-0"
        >
          <span
            className={`text-xs ${allResolved ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
          >
            {hunksLabel}
          </span>
          <div className="flex items-center gap-2">
            {onAbort && (
              <Button className="uppercase font-mono" variant="ghost" size="sm" onClick={onAbort}>
                <Trans>Exit merge</Trans>
              </Button>
            )}
            <Button
              className="uppercase font-mono"
              variant="outline"
              size="sm"
              onClick={handleUndo}
            >
              Undo
            </Button>
            {onResolve && (
              <Button
                variant="default"
                size="sm"
                disabled={!allResolved}
                onClick={handleSaveResolution}
              >
                <Trans>Save resolution</Trans>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
