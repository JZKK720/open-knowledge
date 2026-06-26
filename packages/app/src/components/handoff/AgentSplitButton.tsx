import type { HandoffTarget, TargetData, TerminalCli } from '@inkeep/open-knowledge-core';
import { Trans, useLingui } from '@lingui/react/macro';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { TargetIcon } from '@/components/handoff/OpenInAgentMenuItem';
import { cliIconTargetId } from '@/components/handoff/terminal-cli-display';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface TerminalCliRow {
  readonly cli: TerminalCli;
  readonly label: ReactNode;
  readonly ariaLabel: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}

export interface AgentSplitButtonTestIds {
  primary: string;
  trigger: string;
  menu: string;
  option: (id: HandoffTarget) => string;
  terminal: string | ((cli: TerminalCli) => string);
}

export function AgentSplitButton({
  primary,
  onPrimary,
  primaryDisabled = false,
  installedTargets,
  selectedTargetId,
  onSelectTarget,
  terminal,
  terminals,
  menuEmptyState,
  onMenuOpenChange,
  menuAlign = 'end',
  triggerAriaLabel,
  testIds,
}: {
  primary: ReactNode;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  installedTargets: readonly TargetData[];
  selectedTargetId: HandoffTarget | null;
  onSelectTarget: (target: TargetData) => void;
  terminal?: { selected: boolean; onSelect: () => void };
  terminals?: readonly TerminalCliRow[];
  menuEmptyState?: ReactNode;
  onMenuOpenChange?: (open: boolean) => void;
  menuAlign?: 'start' | 'end';
  triggerAriaLabel: string;
  testIds: AgentSplitButtonTestIds;
}) {
  const { t } = useLingui();
  const showDesktop = installedTargets.length > 0;
  const cliRows = terminals && terminals.length > 0 ? terminals : null;
  const showTerminal = cliRows != null || terminal != null;
  const hasOptions = showDesktop || showTerminal;
  const terminalTestId = (cli: TerminalCli): string =>
    typeof testIds.terminal === 'function' ? testIds.terminal(cli) : testIds.terminal;

  return (
    <ButtonGroup>
      <Button
        type="button"
        variant="outline"
        className="gap-1.5"
        disabled={primaryDisabled}
        onClick={onPrimary}
        data-testid={testIds.primary}
      >
        {primary}
      </Button>
      <DropdownMenu onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={triggerAriaLabel}
            data-testid={testIds.trigger}
          >
            <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={menuAlign} className="min-w-[200px]" data-testid={testIds.menu}>
          {hasOptions ? (
            <>
              {showDesktop ? (
                <DropdownMenuGroup aria-label={t`Desktop`}>
                  <DropdownMenuLabel>
                    <Trans>Desktop</Trans>
                  </DropdownMenuLabel>
                  {installedTargets.map((target) => (
                    <DropdownMenuItem
                      key={target.id}
                      onSelect={() => onSelectTarget(target)}
                      data-testid={testIds.option(target.id)}
                    >
                      <TargetIcon id={target.id} aria-hidden="true" className="size-4" />
                      <span className="flex-1">{target.displayName}</span>
                      {selectedTargetId === target.id ? (
                        <Check aria-hidden="true" className="size-4 text-muted-foreground" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ) : null}
              {showTerminal ? (
                <>
                  {showDesktop ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuGroup aria-label={t`Terminal`}>
                    <DropdownMenuLabel>
                      <Trans>Terminal</Trans>
                    </DropdownMenuLabel>
                    {/* The visible text is the bare CLI name while the accessible
                        name carries "<name> CLI" so AT users can tell it apart
                        from a same-named Desktop row (WCAG 2.5.3 — the accessible
                        name contains the visible label). */}
                    {cliRows ? (
                      cliRows.map((row) => (
                        <DropdownMenuItem
                          key={row.cli}
                          onSelect={row.onSelect}
                          data-testid={terminalTestId(row.cli)}
                          aria-label={row.ariaLabel}
                        >
                          {/* Per-CLI brand icon (same source of truth the "Open
                              with AI" surfaces use via `cliIconTargetId`), so each
                              row is identifiable at a glance — OpenCode is
                              terminal-only and would otherwise show no brand mark.
                              The "Terminal" section header + the "(CLI)" label
                              already convey that these launch a terminal. */}
                          <TargetIcon
                            id={cliIconTargetId(row.cli)}
                            className="size-4"
                            aria-hidden="true"
                          />
                          <span className="flex-1">{row.label}</span>
                          {row.selected ? (
                            <Check aria-hidden="true" className="size-4 text-muted-foreground" />
                          ) : null}
                        </DropdownMenuItem>
                      ))
                    ) : terminal ? (
                      <DropdownMenuItem
                        onSelect={terminal.onSelect}
                        data-testid={terminalTestId('claude')}
                        aria-label={t`Claude CLI`}
                      >
                        <TargetIcon
                          id={cliIconTargetId('claude')}
                          className="size-4"
                          aria-hidden="true"
                        />
                        <span className="flex-1">
                          <Trans>Claude</Trans>
                        </span>
                        {terminal.selected ? (
                          <Check aria-hidden="true" className="size-4 text-muted-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuGroup>
                </>
              ) : null}
            </>
          ) : (
            menuEmptyState
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  );
}
