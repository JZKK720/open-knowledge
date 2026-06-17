import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTerminalConsentState, useTerminalEnabledWriter } from '@/hooks/use-terminal-enabled';
import type { OkDesktopBridge } from '@/lib/desktop-bridge-types';
import type { TerminalLaunchIntent } from './EditorPane';
import { TerminalConsentDialog } from './TerminalConsentDialog';

const TerminalPanel = lazy(() =>
  import('./TerminalPanel').then((m) => ({ default: m.TerminalPanel })),
);

interface TerminalGateProps {
  readonly bridge: OkDesktopBridge;
  readonly visible: boolean;
  readonly onClose?: () => void;
  /** "Open in terminal" launch intent. Only reaches the session once consent
   *  is granted (the enabled-true branch) — so consent still gates the launch. */
  readonly launch?: TerminalLaunchIntent | null;
}

export function TerminalGate({ bridge, visible, onClose, launch = null }: TerminalGateProps) {
  const { enabled, synced } = useTerminalConsentState();
  const writer = useTerminalEnabledWriter();
  const { t } = useLingui();
  const [declined, setDeclined] = useState(false);
  const [forceConsent, setForceConsent] = useState(false);

  const consentOpen = forceConsent || (visible && synced && enabled === null && !declined);
  const showNotice = !consentOpen && (enabled === false || (enabled === null && declined));

  function handleAccept() {
    if (writer === null) {
      toast.error(t`Terminal settings not loaded yet — try again in a moment.`);
      return;
    }
    const result = writer(true);
    if (!result.ok) {
      toast.error(t`Could not enable the terminal: ${result.error}`);
      return;
    }
    setForceConsent(false);
    setDeclined(false);
  }

  function handleDecline() {
    setForceConsent(false);
    setDeclined(true);
  }

  if (enabled === true) {
    return (
      <Suspense fallback={<div className="h-full w-full bg-[#1e1e1e]" aria-hidden="true" />}>
        <TerminalPanel bridge={bridge} className="h-full" onClose={onClose} launch={launch} />
      </Suspense>
    );
  }

  return (
    <>
      {showNotice ? (
        <TerminalNotEnabledNotice
          revoked={enabled === false}
          onEnable={() => setForceConsent(true)}
        />
      ) : (
        <div className="h-full w-full bg-[#1e1e1e]" aria-hidden="true" />
      )}
      <TerminalConsentDialog open={consentOpen} onAccept={handleAccept} onDecline={handleDecline} />
    </>
  );
}

interface TerminalNotEnabledNoticeProps {
  readonly revoked: boolean;
  readonly onEnable: () => void;
}

function TerminalNotEnabledNotice({ revoked, onEnable }: TerminalNotEnabledNoticeProps) {
  const { t } = useLingui();
  return (
    <section
      aria-label={t`Terminal disabled`}
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#1e1e1e] p-6 text-center"
    >
      <p className="max-w-sm text-sm text-[#d4d4d4]">
        {revoked
          ? t`The terminal is turned off for this project. Turn it back on to run commands here.`
          : t`The terminal is not enabled for this project.`}
      </p>
      <Button onClick={onEnable}>{t`Enable terminal`}</Button>
      {revoked ? (
        <p className="text-xs text-[#b3b3b3]">{t`You can also manage this in Settings.`}</p>
      ) : null}
    </section>
  );
}
