import { t } from '@lingui/core/macro';
import { toast } from 'sonner';

type Bridge = NonNullable<typeof window.okDesktop>;

type OpenInTerminalOutcome = Awaited<ReturnType<Bridge['shell']['openInTerminal']>>;

type OpenInTerminalFailureReason = Extract<OpenInTerminalOutcome, { ok: false }>['reason'];

export async function dispatchOpenInTerminal(bridge: Bridge, dirAbsPath: string): Promise<void> {
  const reasonLabel: Record<OpenInTerminalFailureReason | 'ipc-error', string> = {
    'not-found': t`Terminal.app not found`,
    'spawn-error': t`Could not launch Terminal`,
    timeout: t`Terminal took too long to respond`,
    'path-escape': t`Path resolves outside the project`,
    'ipc-error': t`Lost connection to the main process`,
  };
  let result: OpenInTerminalOutcome;
  try {
    result = await bridge.shell.openInTerminal(dirAbsPath);
  } catch (err) {
    console.warn('[shell] openInTerminal IPC threw', { dirAbsPath, err });
    toast.error(t`Could not open Terminal`, { description: reasonLabel['ipc-error'] });
    return;
  }
  if (!result.ok) {
    console.warn('[shell] openInTerminal failed', { reason: result.reason, dirAbsPath });
    toast.error(t`Could not open Terminal`, { description: reasonLabel[result.reason] });
  }
}
