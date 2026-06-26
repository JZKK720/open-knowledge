import {
  type HandoffTarget,
  TERMINAL_CLI_IDS,
  TERMINAL_CLIS,
  type TerminalCli,
} from '@inkeep/open-knowledge-core';

export const VISIBLE_CLIS: readonly TerminalCli[] = TERMINAL_CLI_IDS;

/** CLI id → the handoff target id whose brand icon `TargetIcon` renders. Reads
 *  the single source of truth on the registry (shared with prompt composition)
 *  rather than a parallel local map. */
export function cliIconTargetId(cli: TerminalCli): HandoffTarget {
  return TERMINAL_CLIS[cli].handoffTarget;
}
