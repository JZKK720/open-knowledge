import type { TemplatesListEntry } from '@inkeep/open-knowledge-core';
import { Trans, useLingui } from '@lingui/react/macro';
import { FilePlus2, Plus } from 'lucide-react';
import { AgentHandoffGrid } from '@/components/empty-state/AgentHandoffGrid';
import { EmptyStateHeader } from '@/components/empty-state/EmptyStateHeader';
import { KeyboardHintsFooter } from '@/components/empty-state/KeyboardHintsFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { useAllTemplates } from '@/hooks/use-folder-config';
import { useIsEmbedded } from '@/hooks/use-is-embedded';
import { emitCreateTopLevelFile } from '@/lib/create-file-events';
import { formatShortcut } from '@/lib/keyboard-shortcuts';

interface CreateViewProps {
  readonly celebrateSignal: number;
  readonly onAddStarterPack: () => void;
}

export function CreateView({ celebrateSignal, onAddStarterPack }: CreateViewProps) {
  const { t } = useLingui();
  const isEmbedded = useIsEmbedded();
  const templatesState = useAllTemplates();
  const initialDir = '';

  const templates = templatesState.status === 'ready' ? templatesState.data : [];
  const templatesLoading = templatesState.status === 'loading' || templatesState.status === 'idle';
  const templatesError = templatesState.status === 'error';
  const shortcut = formatShortcut('new-item');

  return (
    <div className="flex w-full flex-col gap-10 py-12 max-w-5xl my-auto">
      <EmptyStateHeader
        title={t`Create something great.`}
        subtitle={t`Start a blank file, scaffold from a template, or open this folder in your AI editor.`}
        celebrateSignal={celebrateSignal}
      />

      <div className="flex w-full flex-col gap-8">
        <PrimaryNewFileCard
          shortcutLabel={shortcut}
          onClick={() => emitCreateTopLevelFile({ initialDir })}
        />

        {templatesLoading || templatesError || templates.length > 0 ? (
          <TemplatesSection
            templates={templates}
            loading={templatesLoading}
            error={templatesError}
            onSelect={(folder, name) => emitCreateTopLevelFile({ template: { folder, name } })}
          />
        ) : null}

        {isEmbedded ? null : <WithAiSection />}

        <div className="flex w-full items-center justify-between gap-4">
          <Button
            onClick={onAddStarterPack}
            variant="link"
            size="xs"
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-normal hover:text-foreground hover:no-underline"
          >
            <Plus aria-hidden="true" className="size-3" />
            <Trans>Add a starter pack</Trans>
          </Button>
          <KeyboardHintsFooter />
        </div>
      </div>
    </div>
  );
}

interface PrimaryNewFileCardProps {
  readonly shortcutLabel: string;
  readonly onClick: () => void;
}

function PrimaryNewFileCard({ shortcutLabel, onClick }: PrimaryNewFileCardProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="group flex h-auto w-full items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-center gap-3">
        <FilePlus2 aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium leading-tight text-foreground">
          <Trans>New file</Trans>
        </span>
      </div>
      <Kbd>{shortcutLabel}</Kbd>
    </Button>
  );
}

interface TemplatesSectionProps {
  readonly templates: readonly TemplatesListEntry[];
  readonly loading: boolean;
  readonly error: boolean;
  readonly onSelect: (folder: string, name: string) => void;
}

function TemplatesSection({ templates, loading, error, onSelect }: TemplatesSectionProps) {
  const { t } = useLingui();
  return (
    <section aria-label={t`From template`} className="flex w-full flex-col gap-3">
      <header className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-muted-foreground">
        <span>
          <Trans>From template</Trans>
        </span>
        {loading || error ? null : (
          <Badge
            className="text-2xs"
            variant="gray"
            aria-label={t`${templates.length} templates available`}
          >
            {templates.length}
          </Badge>
        )}
      </header>
      {/* Cap at ~5 rows so With AI stays in the viewport regardless of
          template count. */}
      <div className="w-full overflow-hidden rounded-xl border border-border/60 bg-card">
        <section
          aria-busy={loading}
          aria-label={t`Template list`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable scroll region per WCAG 2.1.1 (keyboard-operable)
          tabIndex={0}
          className="subtle-scrollbar scroll-fade-mask flex max-h-[260px] w-full flex-col overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {loading ? (
            <p className="p-4 text-1sm text-muted-foreground">
              <Trans>Loading templates</Trans>
            </p>
          ) : error ? (
            <p role="alert" className="p-4 text-1sm text-destructive">
              <Trans>Could not load templates. Try again later.</Trans>
            </p>
          ) : (
            templates.map((tpl) => {
              const targetLabel = tpl.source_folder === '' ? '/' : `${tpl.source_folder}/`;
              return (
                <TemplateRow
                  key={`${tpl.source_folder}/${tpl.name}`}
                  template={tpl}
                  targetLabel={targetLabel}
                  onClick={() => onSelect(tpl.source_folder, tpl.name)}
                />
              );
            })
          )}
        </section>
      </div>
    </section>
  );
}

interface TemplateRowProps {
  readonly template: TemplatesListEntry;
  readonly targetLabel: string;
  readonly onClick: () => void;
}

function TemplateRow({ template, targetLabel, onClick }: TemplateRowProps) {
  const { t } = useLingui();
  const displayTitle = template.title?.trim() || template.name;
  const fileName = `${template.name}.md`;
  const targetIsRoot = template.source_folder === '';
  const accessibleName = targetIsRoot
    ? t`New file from template "${displayTitle}" (${fileName}) in the project root`
    : t`New file from template "${displayTitle}" (${fileName}) in ${targetLabel}`;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-label={accessibleName}
      className="group flex h-auto w-full items-center justify-between gap-4 rounded-none p-4 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm font-medium leading-tight text-foreground/80">
          {displayTitle}
        </span>
        <span className="truncate font-mono text-1sm font-normal text-muted-foreground">
          {fileName}
        </span>
      </span>
      <span
        className={`shrink-0 font-mono text-1sm ${
          targetIsRoot ? 'text-muted-foreground/70' : 'text-muted-foreground'
        }`}
      >
        {targetLabel}
      </span>
    </Button>
  );
}

function WithAiSection() {
  const { t } = useLingui();
  return (
    <section aria-label={t`With AI`} className="flex w-full flex-col gap-3">
      <header className="font-mono text-2xs uppercase tracking-wider text-muted-foreground">
        <Trans>With AI</Trans>
      </header>
      <AgentHandoffGrid />
    </section>
  );
}
