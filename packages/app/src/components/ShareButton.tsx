
import { Trans, useLingui } from '@lingui/react/macro';
import { Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDocumentContext } from '@/editor/DocumentContext';
import { useGitSyncStatusDetailed } from '@/hooks/use-git-sync-status';
import { scheduleClipboardWrite } from '@/lib/share/clipboard-adapter';
import { runShareAction } from '@/lib/share/run-share-action';

export interface ShareButtonProps {
  onClickWhenNoRemote: () => void;
}

export function ShareButton({ onClickWhenNoRemote }: ShareButtonProps) {
  const { t } = useLingui();
  const { activeDocName } = useDocumentContext();
  const { status } = useGitSyncStatusDetailed();
  const [busy, setBusy] = useState(false);
  const [clipboardFailedUrl, setClipboardFailedUrl] = useState<string | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!clipboardFailedUrl || !fallbackInputRef.current) return;
    fallbackInputRef.current.focus();
    fallbackInputRef.current.select();
  }, [clipboardFailedUrl]);

  if (!activeDocName) return null;

  const hasRemote = status?.hasRemote === true;

  async function handleClick() {
    if (busy) return;
    if (!activeDocName) return;
    setBusy(true);
    setClipboardFailedUrl(null);
    try {
      const result = await runShareAction(
        {
          docName: activeDocName,
          hasRemote,
          onClickWhenNoRemote,
        },
        {
          clipboardWrite: scheduleClipboardWrite,
          toastSuccess: (msg) => toast.success(msg),
          toastError: (msg) => {
            if (msg === 'Link ready but could not copy to clipboard.') return;
            toast.error(msg);
          },
          logEvent: (msg) => console.log(msg),
        },
      );
      if (result.kind === 'clipboard-failed') {
        setClipboardFailedUrl(result.shareUrl);
      }
    } catch {
      toast.error(t`Could not construct share URL.`);
    }
    setBusy(false);
  }

  return (
    <Popover
      open={clipboardFailedUrl !== null}
      onOpenChange={(open) => {
        if (!open) setClipboardFailedUrl(null);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverAnchor asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t`Share doc`}
              onClick={handleClick}
              disabled={busy}
              className="gap-1.5 text-muted-foreground px-1.5"
              data-testid="share-button"
            >
              <Share2 className="size-3.5" aria-hidden />
              <Trans>Share</Trans>
            </Button>
          </PopoverAnchor>
        </TooltipTrigger>
        <TooltipContent>
          <Trans>Share</Trans>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="flex w-80 flex-col gap-2"
        data-testid="share-button-fallback-popover"
      >
        <p className="text-sm font-medium">
          <Trans>Couldn't auto-copy</Trans>
        </p>
        <p className="text-xs text-muted-foreground">
          <Trans>Use Cmd/Ctrl+C to copy the link below, or open OK in the desktop app.</Trans>
        </p>
        <Input
          ref={fallbackInputRef}
          readOnly
          value={clipboardFailedUrl ?? ''}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          className="font-mono text-xs"
          data-testid="share-button-fallback-url"
          aria-label={t`Share URL`}
        />
      </PopoverContent>
    </Popover>
  );
}
