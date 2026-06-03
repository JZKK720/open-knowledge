import { Trans } from '@lingui/react/macro';
import { Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { NewTemplateDialog } from '@/components/NewTemplateDialog';
import { TemplateDeleteDialog } from '@/components/TemplateDeleteDialog';
import { TemplateEditDialog } from '@/components/TemplateEditDialog';
import { TemplateRow } from '@/components/TemplateRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type TemplateMenuEntry, useFolderConfig } from '@/hooks/use-folder-config';

interface TemplatesManagerConfig {
  scope: TemplateMenuEntry['scope'];
  title: string;
  description: ReactNode;
  emptyMessage: ReactNode;
  loadErrorTitle: string;
  badge: { label: string; variant: 'primary' | 'gray' };
  settingsId: string;
  testIdPrefix: string;
}

export function TemplatesManagerSection({ config }: { config: TemplatesManagerConfig }) {
  const { state, refresh } = useFolderConfig('');
  const [editTarget, setEditTarget] = useState<TemplateMenuEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateMenuEntry | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const templates: TemplateMenuEntry[] =
    state.status === 'ready'
      ? (state.data.folder.templates_available ?? [])
          .filter((tpl) => tpl.scope === config.scope)
          .sort((a, b) =>
            (a.title ?? a.name).toLowerCase().localeCompare((b.title ?? b.name).toLowerCase()),
          )
      : [];

  if (state.status === 'error') {
    const { loadErrorTitle } = config;
    const { message } = state;
    return (
      <section
        className="space-y-3"
        aria-labelledby={config.settingsId}
        data-testid={`settings-${config.testIdPrefix}-section`}
      >
        <SectionHeader config={config} onNewClick={() => setNewOpen(true)} />
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          role="alert"
        >
          <Trans>
            {loadErrorTitle}: {message}
          </Trans>
        </div>
        <NewTemplateDialog
          folderPath=""
          existingNames={new Set()}
          open={newOpen}
          onOpenChange={setNewOpen}
          onCreated={refresh}
        />
      </section>
    );
  }

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <section
        className="space-y-3"
        aria-labelledby={config.settingsId}
        data-testid={`settings-${config.testIdPrefix}-section`}
      >
        <SectionHeader config={config} />
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </section>
    );
  }

  return (
    <section
      className="space-y-3"
      aria-labelledby={config.settingsId}
      data-testid={`settings-${config.testIdPrefix}-section`}
    >
      <SectionHeader config={config} onNewClick={() => setNewOpen(true)} />
      <div className="rounded-lg border bg-card">
        {templates.length === 0 ? (
          <p
            className="px-3 py-4 text-sm text-muted-foreground"
            data-testid={`settings-${config.testIdPrefix}-empty`}
          >
            {config.emptyMessage}
          </p>
        ) : (
          <ul className="space-y-1 p-2" data-testid={`settings-${config.testIdPrefix}-list`}>
            {templates.map((tpl) => (
              <TemplateRow
                key={tpl.name}
                template={tpl}
                onEdit={() => setEditTarget(tpl)}
                onDelete={() => setDeleteTarget(tpl)}
                badge={
                  <Badge variant={config.badge.variant} className="text-2xs">
                    {config.badge.label}
                  </Badge>
                }
              />
            ))}
          </ul>
        )}
      </div>

      <NewTemplateDialog
        folderPath=""
        existingNames={new Set(templates.map((tpl) => tpl.name))}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={refresh}
      />
      <TemplateEditDialog
        folderPath=""
        template={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        onSaved={refresh}
      />
      <TemplateDeleteDialog
        template={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onDeleted={refresh}
      />
    </section>
  );
}

function SectionHeader({
  config,
  onNewClick,
}: {
  config: TemplatesManagerConfig;
  onNewClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 id={config.settingsId} className="text-base font-semibold">
          {config.title}
        </h3>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
      {onNewClick ? (
        <Button
          variant="outline"
          size="sm"
          className="font-mono uppercase shrink-0"
          onClick={onNewClick}
          data-testid={`settings-${config.testIdPrefix}-new-button`}
        >
          <Plus className="size-3.5" aria-hidden />
          <Trans>New template</Trans>
        </Button>
      ) : null}
    </div>
  );
}
