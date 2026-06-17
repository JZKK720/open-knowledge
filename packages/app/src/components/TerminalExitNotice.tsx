import { useLingui } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';

export interface TerminalExitInfo {
  readonly exitCode: number;
  readonly signal: number | null;
  readonly error?: string;
}

interface TerminalExitNoticeProps {
  readonly info: TerminalExitInfo;
  readonly onRestart: () => void;
}

export function TerminalExitNotice({ info, onRestart }: TerminalExitNoticeProps) {
  const { t } = useLingui();

  let message: string;
  if (info.error != null) {
    message = t`The terminal stopped unexpectedly.`;
  } else if (info.signal != null && info.signal !== 0) {
    message = t`The terminal session ended (signal ${info.signal}).`;
  } else if (info.exitCode !== 0) {
    message = t`The terminal session ended (exit code ${info.exitCode}).`;
  } else {
    message = t`The terminal session ended.`;
  }

  return (
    <div
      role="alert"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#1e1e1e]/90 p-6 text-center text-[#d4d4d4]"
    >
      <p className="max-w-sm text-sm">{message}</p>
      <Button size="sm" variant="secondary" onClick={onRestart}>
        {t`Restart terminal`}
      </Button>
    </div>
  );
}
