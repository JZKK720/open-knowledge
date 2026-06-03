import { Trans, useLingui } from '@lingui/react/macro';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDocumentContext } from '@/editor/DocumentContext';
import { formatShortcut } from '@/lib/keyboard-shortcuts';
import { useWorkspace } from '@/lib/use-workspace';
import { cn } from '@/lib/utils';
import { PresenceBar } from '@/presence/PresenceBar';
import { BetaBadge } from './BetaBadge';
import { EditorTabs } from './EditorTabs';
import { HelpPopover } from './HelpPopover';
import { OpenInAgentMenu } from './handoff/OpenInAgentMenu';
import {
  buildFolderHandoffInput,
  buildHandoffInput,
  buildProjectScopedHandoffInput,
  type HandoffDispatchInput,
} from './handoff/useHandoffDispatch';
import { PublishToGitHubDialog } from './PublishToGitHubDialog';
import { SettingsButton } from './SettingsButton';
import { ShareButton } from './ShareButton';
import { SyncStatusBadge } from './SyncStatusBadge';

interface EditorHeaderProps {
  onSignIn?: () => void;
  onSetIdentity?: () => void;
  onOpenSearch?: () => void;
  openInAgentMenuOpen?: boolean;
  openInAgentMenuInput?: HandoffDispatchInput | null;
  onOpenInAgentMenuOpenChange?: (open: boolean) => void;
}

export function EditorHeader({
  onSignIn,
  onSetIdentity,
  onOpenSearch,
  openInAgentMenuOpen,
  openInAgentMenuInput,
  onOpenInAgentMenuOpenChange,
}: EditorHeaderProps) {
  const { t } = useLingui();
  const { activeDocName, activeTarget } = useDocumentContext();
  const { state: sidebarState } = useSidebar();
  const sidebarShortcut = formatShortcut('toggle-files-sidebar');
  const searchShortcut = formatShortcut('command-palette');
  const workspace = useWorkspace();
  const [publishOpen, setPublishOpen] = useState(false);
  const handoffInput: HandoffDispatchInput | null = (() => {
    if (activeTarget === null) {
      return buildProjectScopedHandoffInput({ workspace });
    }
    if (activeTarget.kind === 'folder') {
      if (!workspace) return null;
      return buildFolderHandoffInput({
        folderRelativePath: activeTarget.folderPath,
        workspace,
      });
    }
    return buildHandoffInput({ docName: activeDocName, workspace });
  })();
  const menuHandoffInput = openInAgentMenuInput ?? handoffInput;

  const isElectronHost = typeof window !== 'undefined' && window.okDesktop != null;
  const isCollapsed = sidebarState === 'collapsed';

  return (
    <header
      data-electron-drag={isElectronHost ? '' : undefined}
      className={cn(
        'flex h-12 shrink-0 items-center bg-muted/35 shadow-[inset_0_-1px_0_var(--border)]',
        isElectronHost && '[-webkit-app-region:drag]',
        isElectronHost && isCollapsed && 'pl-[78px]',
        isElectronHost &&
          'motion-safe:transition-[padding] motion-safe:duration-200 motion-safe:ease-linear',
      )}
    >
      {/*
        Left zone uses per-child `no-drag` opt-outs (instead of the
        right zone's `[&>*]:` child-combinator) because EditorTabs is a
        direct child whose own root MUST stay draggable so the empty
        space inside the tab strip continues to drag the window. Adding
        a future interactive control here? Apply `[-webkit-app-region:
        no-drag]` (gated on `isElectronHost`) explicitly on the new
        element — the right zone's blanket opt-out is intentionally
        scoped to its zone.
      */}
      <div className="flex min-w-0 flex-1 items-center gap-1 px-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger
              className={cn(
                '-ml-1 shrink-0 text-muted-foreground',
                isElectronHost && '[-webkit-app-region:no-drag]',
              )}
            />
          </TooltipTrigger>
          <TooltipContent>
            {sidebarState === 'expanded' ? (
              <Trans>Hide Files ({sidebarShortcut})</Trans>
            ) : (
              <Trans>Show Files ({sidebarShortcut})</Trans>
            )}
          </TooltipContent>
        </Tooltip>
        {isCollapsed && onOpenSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onOpenSearch}
                aria-label={t`Search (${searchShortcut})`}
                data-telemetry-event="ok.editor_header.search.click"
                className={cn(
                  'shrink-0 text-muted-foreground',
                  isElectronHost && '[-webkit-app-region:no-drag]',
                )}
              >
                <Search aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <Trans>Search ({searchShortcut})</Trans>
            </TooltipContent>
          </Tooltip>
        )}
        <Separator orientation="vertical" className="mr-1 h-4 shrink-0 data-vertical:self-center" />
        <EditorTabs />
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center justify-end gap-2 px-3',
          isElectronHost && '[&>*]:[-webkit-app-region:no-drag]',
        )}
      >
        <OpenInAgentMenu
          input={menuHandoffInput}
          open={openInAgentMenuOpen}
          onOpenChange={onOpenInAgentMenuOpenChange}
        />
        <ShareButton onClickWhenNoRemote={() => setPublishOpen(true)} />
        <PublishToGitHubDialog open={publishOpen} onOpenChange={setPublishOpen} />
        <SyncStatusBadge onSignIn={onSignIn} onSetIdentity={onSetIdentity} />
        <PresenceBar />
        <Separator orientation="vertical" className="h-4 shrink-0 data-vertical:self-center" />
        <BetaBadge />
        <SettingsButton />
        <HelpPopover />
      </div>
    </header>
  );
}
