import { TERMINAL_CLIS, type TerminalCli } from '@inkeep/open-knowledge-core';
import { useLingui } from '@lingui/react/macro';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OkDesktopBridge } from '@/lib/desktop-bridge-types';

interface TerminalCliMissingBannerProps {
  readonly cli: TerminalCli;
  readonly bridge: OkDesktopBridge;
  readonly onDismiss: () => void;
}

export function TerminalCliMissingBanner({
  cli,
  bridge,
  onDismiss,
}: TerminalCliMissingBannerProps) {
  const { t } = useLingui();
  const { bin, displayName, docsUrl } = TERMINAL_CLIS[cli];

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-border border-b bg-muted px-3 py-2 text-foreground text-xs"
    >
      <p className="min-w-0 flex-1">
        {t`${displayName} (${bin}) isn't installed or on your PATH.`}
      </p>
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={() => void bridge.shell.openExternal(docsUrl)}
      >
        {t`Get ${displayName}`}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t`Dismiss`}
        className="size-6 shrink-0"
        onClick={onDismiss}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
