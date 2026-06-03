import { Trans, useLingui } from '@lingui/react/macro';
import { ListPlus, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EditorModeValue } from '@/editor/use-editor-mode.ts';
import { formatShortcut, formatShortcutLabel } from '@/lib/keyboard-shortcuts';
import { EditorBreadcrumb } from './EditorBreadcrumb';
import { Markdown } from './icons/markdown';
import { Textbox } from './icons/textbox';

interface EditorToolbarProps {
  activeDocName: string | null;
  isSourceMode: boolean;
  sourceDisabled: boolean;
  onModeChange: (mode: EditorModeValue) => void;
  showAddPropertyButton: boolean;
  onAddProperty: () => void;
  isPanelCollapsed: boolean;
  onTogglePanel: () => void;
}

export function EditorToolbar({
  activeDocName,
  isSourceMode,
  sourceDisabled,
  onModeChange,
  showAddPropertyButton,
  onAddProperty,
  isPanelCollapsed,
  onTogglePanel,
}: EditorToolbarProps) {
  const { t } = useLingui();
  const panelShortcut = formatShortcut('toggle-document-panel');
  const panelShortcutLabel = formatShortcutLabel('toggle-document-panel');
  return (
    <div data-testid="editor-toolbar" className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {/*
        Outer wrapper mirrors the editor's content-column grid so the inner
        3-col layout aligns with the WYSIWYG content area. Without this, the
        previous `px-2` on the inner grid pushed the breadcrumb cell ~8px
        right of the editor's first text block. Cells inside `.editor-content-aligned`
        land on the `content` column automatically via the `> *` rule.
      */}
      <div className="editor-content-aligned bg-background py-2">
        <div className="grid grid-cols-3 items-center">
          {/*
          Breadcrumb cell. The parent grid is `pointer-events-none` so the
          editor canvas underneath remains clickable through the toolbar's
          empty regions; this cell must scope its own `pointer-events-auto`
          so the breadcrumb's per-segment `title` tooltips actually surface.
          Future siblings dropped into this cell must follow the same rule.
        */}
          <div className="pointer-events-auto flex min-w-0 items-center">
            <EditorBreadcrumb docName={activeDocName} />
          </div>
          <div className="pointer-events-auto flex justify-center">
            <ToggleGroup
              type="single"
              value={isSourceMode ? 'source' : 'wysiwyg'}
              onValueChange={(v: EditorModeValue | '') => {
                if (v) onModeChange(v);
              }}
              aria-label={t`Editor mode`}
              variant="segmented"
              size="sm"
              spacing={1}
              className="shrink-0 data-[size=sm]:rounded-[10px] bg-muted p-0.5"
            >
              <Tooltip>
                <ToggleGroupItem
                  value="wysiwyg"
                  aria-label={t`Visual editor`}
                  className="size-7 px-0 dark:data-[state=on]:bg-foreground/15"
                  asChild
                >
                  <TooltipTrigger>
                    <Textbox className="size-4" />
                  </TooltipTrigger>
                </ToggleGroupItem>
                <TooltipContent side="bottom">
                  <Trans>Visual</Trans>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Disabled <button> doesn't fire pointer events; wrap so the tooltip still triggers. */}
                  <div>
                    <ToggleGroupItem
                      value="source"
                      aria-label={t`Markdown source`}
                      disabled={sourceDisabled}
                      className="size-7 px-0 dark:data-[state=on]:bg-foreground/15"
                    >
                      <Markdown className="size-4" />
                    </ToggleGroupItem>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {sourceDisabled ? (
                    <Trans>
                      Source mode requires a live connection — your edits are saved and will appear
                      when you reconnect.
                    </Trans>
                  ) : (
                    <Trans>Markdown</Trans>
                  )}
                </TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </div>
          {/*
            Third column kept empty so the mode toggle stays centered in the
            content column. The action buttons render in the pane-edge
            cluster below, not here.
          */}
        </div>
      </div>
      {/*
        Action buttons sit flush against the doc-panel divider (the editor
        pane's right edge), not the narrower content column. `absolute` lifts
        them clear of the `.editor-content-aligned` grid; `pointer-events-auto`
        re-enables clicks under the toolbar's `pointer-events-none` root.
      */}
      <div className="pointer-events-auto absolute top-0 right-0 flex items-center justify-end gap-1 py-2 pr-2">
        {showAddPropertyButton && (
          <Tooltip>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t`Add properties`}
              onClick={onAddProperty}
              data-testid="add-properties-button"
              asChild
            >
              <TooltipTrigger>
                <ListPlus />
              </TooltipTrigger>
            </Button>
            <TooltipContent side="bottom">
              <Trans>Add properties</Trans>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <Button
            data-doc-panel-toggle=""
            variant="ghost"
            size="icon"
            onClick={onTogglePanel}
            aria-expanded={!isPanelCollapsed}
            aria-controls="doc-panel"
            aria-label={
              isPanelCollapsed
                ? t`Show panel (${panelShortcutLabel})`
                : t`Hide panel (${panelShortcutLabel})`
            }
            asChild
          >
            <TooltipTrigger>
              {isPanelCollapsed ? <PanelRightOpen /> : <PanelRightClose />}
            </TooltipTrigger>
          </Button>
          <TooltipContent side="bottom">
            {isPanelCollapsed ? (
              <Trans>Show panel ({panelShortcut})</Trans>
            ) : (
              <Trans>Hide panel ({panelShortcut})</Trans>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
      <div
        aria-hidden
        className="pointer-events-none h-2 bg-linear-to-b from-background to-transparent"
      />
    </div>
  );
}
