import { type HandoffTarget, TERMINAL_CLIS, type TerminalCli } from '@inkeep/open-knowledge-core';
import { Trans, useLingui } from '@lingui/react/macro';
import { ArrowUpRight, Check, ChevronDown, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  clearComposerDraft,
  getComposerDraft,
  setComposerDraftDoc,
} from '@/components/composer-draft-store';
import {
  type CreateScenario,
  useCreateSuggestions,
} from '@/components/empty-state/use-create-suggestions';
import { TargetIcon } from '@/components/handoff/OpenInAgentMenuItem';
import { useTerminalLaunch } from '@/components/handoff/TerminalLaunchContext';
import { cliIconTargetId, VISIBLE_CLIS } from '@/components/handoff/terminal-cli-display';
import {
  buildCreateHandoffInput,
  getDisplayNameDefault,
  openInstallUrl,
  useHandoffDispatch,
} from '@/components/handoff/useHandoffDispatch';
import { useInstalledAgents } from '@/components/handoff/useInstalledAgents';
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
import {
  ComposerMentionInput,
  type ComposerMentionInputHandle,
} from '@/editor/ComposerMentionInput';
import { VISIBLE_TARGETS } from '@/lib/handoff/targets';
import { hasValidPromptInput } from '@/lib/has-valid-prompt-input';
import {
  readPreferredAgent,
  resolvePreferredAgent,
  writePreferredAgent,
} from '@/lib/preferred-agent-store';
import { useWorkspace } from '@/lib/use-workspace';
import { cn } from '@/lib/utils';

interface CreatePromptComposerProps {
  readonly scenario: CreateScenario;
  readonly className?: string;
}

export function CreatePromptComposer({ scenario, className }: CreatePromptComposerProps) {
  const { t } = useLingui();
  const { states, refresh } = useInstalledAgents();
  const { dispatch } = useHandoffDispatch();
  const workspace = useWorkspace();
  const terminalLaunch = useTerminalLaunch();

  const [selectedAgentId, setSelectedAgentId] = useState<HandoffTarget | null>(() =>
    readPreferredAgent(),
  );
  const userPickedRef = useRef(false);
  const [selectedCli, setSelectedCli] = useState<TerminalCli | null>(null);
  const cliSelected = selectedCli !== null && terminalLaunch !== null;

  const inputRef = useRef<ComposerMentionInputHandle>(null);

  const [initialDraftDoc] = useState(() => getComposerDraft().doc ?? undefined);

  const [isEmpty, setIsEmpty] = useState(true);

  const [showRequiredError, setShowRequiredError] = useState(false);

  function handleEmptyChange(nextEmpty: boolean) {
    setIsEmpty(nextEmpty);
    if (!nextEmpty) setShowRequiredError(false);
  }

  const suggestions = useCreateSuggestions(scenario);

  const selectableTargets = VISIBLE_TARGETS.filter(
    (target) => states[target.id]?.installed === true,
  );
  const probeSettled = VISIBLE_TARGETS.every((target) => states[target.id]?.installed != null);
  const noAgentsInstalled = probeSettled && selectableTargets.length === 0;

  useEffect(() => {
    if (!probeSettled || userPickedRef.current) return;
    const resolved = resolvePreferredAgent({ lastUsed: readPreferredAgent(), states });
    setSelectedAgentId((current) => (resolved === current ? current : resolved));
  }, [probeSettled, states]);

  function chooseAgent(targetId: HandoffTarget) {
    userPickedRef.current = true;
    setSelectedCli(null);
    setSelectedAgentId(targetId);
    writePreferredAgent(targetId);
  }

  function chooseCli(cli: TerminalCli) {
    userPickedRef.current = true;
    setSelectedCli(cli);
  }

  function launchCli() {
    if (terminalLaunch === null || selectedCli === null) return;
    const { instruction, mentions } = inputRef.current?.getContent() ?? {
      instruction: '',
      mentions: [],
    };
    if (!hasValidPromptInput(instruction, mentions, false)) {
      setShowRequiredError(true);
      return;
    }
    const input = buildCreateHandoffInput({
      workspace,
      description: instruction,
      scenario,
      mentions,
    });
    if (input === null) return; // Workspace not resolved yet — disabled-trigger contract.
    terminalLaunch.launchInTerminal(input, selectedCli);
    inputRef.current?.clear();
    clearComposerDraft();
  }

  function handleCreate(targetId: HandoffTarget) {
    const { instruction, mentions } = inputRef.current?.getContent() ?? {
      instruction: '',
      mentions: [],
    };
    if (!hasValidPromptInput(instruction, mentions, false)) {
      setShowRequiredError(true);
      return;
    }
    writePreferredAgent(targetId);
    const input = buildCreateHandoffInput({
      workspace,
      description: instruction,
      scenario,
      mentions,
    });
    if (input === null) return; // Workspace not resolved yet — disabled-trigger contract.
    void dispatch(targetId, input);
    inputRef.current?.clear();
    clearComposerDraft();
  }

  function handleSubmit() {
    if (cliSelected) {
      launchCli();
    } else if (selectedAgentId !== null) {
      handleCreate(selectedAgentId);
    }
  }

  function applySuggestion(prompt: string) {
    inputRef.current?.setText(prompt);
    inputRef.current?.focus();
  }

  if (noAgentsInstalled) {
    return (
      <div
        className={cn(
          'flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3',
          className,
        )}
        data-testid="create-no-agents"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <Sparkles aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-1sm text-muted-foreground">
            <Trans>Install an AI agent to create with AI</Trans>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {VISIBLE_TARGETS.map((target) => (
            <Button
              key={target.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openInstallUrl(target)}
              className="gap-1.5"
              data-testid={`install-agent-${target.id}`}
            >
              <TargetIcon id={target.id} aria-hidden="true" className="size-3.5" />
              {target.displayName}
              <ArrowUpRight aria-hidden="true" className="size-3" />
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const showDesktopSection = selectableTargets.length > 0;
  const showTerminalSection = terminalLaunch !== null;

  return (
    <div className={cn('flex w-full flex-col gap-3', className)}>
      <div className="flex w-full flex-col rounded-2xl border border-border/60 bg-card shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {/* The card owns the border + focus ring; the mention input is bare (no
            border/ring of its own) so the whole card lights up on focus instead
            of nesting a second outline. The `@`-typeahead reuses the workspace
            doc/file corpus to insert reference chips. */}
        <ComposerMentionInput
          ref={inputRef}
          ariaLabel={t`Describe the project you want to create`}
          placeholder={t`A team knowledge base, a personal wiki, project docs...`}
          onEmptyChange={handleEmptyChange}
          onContentChange={setComposerDraftDoc}
          onSubmit={handleSubmit}
          initialDoc={initialDraftDoc}
          className="max-h-96 overflow-y-auto px-4 py-3 text-sm leading-relaxed subtle-scrollbar [&_.ProseMirror]:min-h-16"
        />
        {/* Footer row: the input-required validation error (left) + the Create
            split button (right). The error is hidden by default and only appears
            once the user attempts to create with an empty brief — rendered in the
            app's standard inline-validation style (role="alert" text-destructive,
            matching NewItemDialog). It clears as soon as a valid brief is typed. */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
          {showRequiredError && isEmpty ? (
            <p
              role="alert"
              className="text-1sm text-destructive"
              data-testid="create-input-required"
            >
              <Trans>Describe what you want to create to continue</Trans>
            </p>
          ) : (
            <span />
          )}
          {selectedAgentId === null ? (
            <Button
              type="button"
              variant="outline"
              disabled
              className="gap-1.5"
              data-testid="create-with-agent"
            >
              <Trans>Create</Trans>
            </Button>
          ) : (
            <ButtonGroup>
              <Button
                type="button"
                onClick={() => (cliSelected ? launchCli() : handleCreate(selectedAgentId))}
                variant="outline"
                className="gap-1.5"
                data-testid="create-with-agent"
              >
                {cliSelected && selectedCli !== null ? (
                  <>
                    <TargetIcon
                      id={cliIconTargetId(selectedCli)}
                      aria-hidden="true"
                      className="size-3.5"
                    />
                    <Trans>Create with {TERMINAL_CLIS[selectedCli].displayName} CLI</Trans>
                  </>
                ) : (
                  <>
                    <TargetIcon id={selectedAgentId} aria-hidden="true" className="size-3.5" />
                    <Trans>Create with {getDisplayNameDefault(selectedAgentId)}</Trans>
                  </>
                )}
              </Button>
              <DropdownMenu
                onOpenChange={(open) => {
                  if (open) void refresh();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    aria-label={t`Choose agent`}
                    size="icon"
                    variant="outline"
                    data-testid="create-with-agent-menu"
                  >
                    <ChevronDown aria-hidden="true" className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[200px]">
                  {showDesktopSection ? (
                    <DropdownMenuGroup aria-label={t`Desktop`}>
                      <DropdownMenuLabel>
                        <Trans>Desktop</Trans>
                      </DropdownMenuLabel>
                      {selectableTargets.map((target) => (
                        <DropdownMenuItem
                          key={target.id}
                          onSelect={() => chooseAgent(target.id)}
                          data-testid={`create-agent-option-${target.id}`}
                        >
                          <TargetIcon id={target.id} aria-hidden="true" className="size-4" />
                          <span className="flex-1">{target.displayName}</span>
                          {!cliSelected && target.id === selectedAgentId ? (
                            <Check aria-hidden="true" className="size-4 text-muted-foreground" />
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  ) : null}
                  {showTerminalSection ? (
                    <>
                      {showDesktopSection ? <DropdownMenuSeparator /> : null}
                      <DropdownMenuGroup aria-label={t`Terminal`}>
                        <DropdownMenuLabel>
                          <Trans>Terminal</Trans>
                        </DropdownMenuLabel>
                        {/* Selects a docked-terminal CLI as the create target (the
                          Create button performs the launch). Visible text is the
                          brand name while the accessible name is "<Brand> CLI" so AT
                          users can tell it apart from the matching Desktop row (WCAG
                          2.5.3 — the name contains the visible label). */}
                        {VISIBLE_CLIS.map((cli) => {
                          const { displayName } = TERMINAL_CLIS[cli];
                          return (
                            <DropdownMenuItem
                              key={cli}
                              onSelect={() => chooseCli(cli)}
                              data-testid={`create-with-cli-${cli}`}
                              aria-label={t`${displayName} CLI`}
                            >
                              <TargetIcon
                                id={cliIconTargetId(cli)}
                                aria-hidden="true"
                                className="size-4"
                              />
                              <span className="flex-1">{displayName}</span>
                              {selectedCli === cli ? (
                                <Check
                                  aria-hidden="true"
                                  className="size-4 text-muted-foreground"
                                />
                              ) : null}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          )}
        </div>
      </div>
      {/* Starter-brief chips — below the card, centered. Clicking one prefills
          the field (no auto-create), so they read as suggestions rather than
          card actions. Wraps on narrow widths. Suppressed for `existing-repo`:
          the repo's own contents are the starting point, so we don't pitch
          generic prefills there (the embedded copy-list still shows them). */}
      {scenario !== 'existing-repo' && suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            return (
              <Button
                key={suggestion.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applySuggestion(suggestion.prompt)}
                className="gap-1.5 rounded-md font-normal text-muted-foreground hover:text-foreground"
                data-testid={`create-suggestion-${suggestion.id}`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {suggestion.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
