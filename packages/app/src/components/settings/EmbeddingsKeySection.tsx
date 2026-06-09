import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSemanticSearchStatus } from '@/hooks/use-semantic-search-status';
import {
  type EmbeddingsKeyTransport,
  httpEmbeddingsKeyTransport,
} from '@/lib/transports/embeddings-key-transport';

export function EmbeddingsKeySection({ transport }: { transport?: EmbeddingsKeyTransport }) {
  const { t } = useLingui();
  const resolved = transport ?? httpEmbeddingsKeyTransport();
  const { status, refresh } = useSemanticSearchStatus();
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keyPresent = status?.keyPresent ?? false;
  const keySource = status?.keySource ?? null;

  async function onSave() {
    const key = keyInput.trim();
    if (!key || busy) return;
    setBusy(true);
    setError(null);
    const result = await resolved.setKey(key);
    setBusy(false);
    if (result.ok) {
      setKeyInput(''); // Don't keep the secret in component state after it lands.
      refresh();
    } else {
      setError(result.error ?? t`Couldn't save the key — please try again.`);
    }
  }

  async function onClear() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await resolved.clearKey();
    setBusy(false);
    if (result.ok) refresh();
    else setError(result.error ?? t`Couldn't clear the key — please try again.`);
  }

  return (
    <section
      aria-labelledby="settings-embeddings-key-title"
      className="space-y-3"
      data-testid="settings-embeddings-key"
    >
      <div className="space-y-1">
        <h3 id="settings-embeddings-key-title" className="text-base font-semibold">
          <Trans>Embeddings provider key</Trans>
        </h3>
        <p className="text-sm text-muted-foreground">
          <Trans>
            The API key semantic search uses to embed your content. Stored once for this machine and
            shared across all projects. Turn the feature on per project in This project → Search.
          </Trans>
        </p>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        {keySource === 'env' ? (
          <p className="text-muted-foreground text-1sm" data-testid="settings-embeddings-key-env">
            <Trans>
              Using the{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                OK_EMBEDDINGS_API_KEY
              </code>{' '}
              environment variable (managed outside Open Knowledge).
            </Trans>
          </p>
        ) : (
          <>
            {keyPresent ? (
              <div
                className="flex items-center justify-between gap-3"
                data-testid="settings-embeddings-key-set"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    <Trans>API key set</Trans>
                  </div>
                  <p className="text-muted-foreground text-1sm">
                    <Trans>Stored on this machine.</Trans>
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void onClear()}
                  disabled={busy}
                  data-testid="settings-embeddings-key-clear"
                >
                  <Trans>Clear</Trans>
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="settings-embeddings-key-input" className="text-sm font-medium">
                {keyPresent ? <Trans>Replace key</Trans> : <Trans>Add a key</Trans>}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="settings-embeddings-key-input"
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={t`Paste your API key`}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  data-testid="settings-embeddings-key-input"
                  className="h-8 font-mono text-sm"
                />
                <Button
                  onClick={() => void onSave()}
                  disabled={busy || keyInput.trim().length === 0}
                  data-testid="settings-embeddings-key-save"
                >
                  {busy ? <Trans>Saving</Trans> : <Trans>Save</Trans>}
                </Button>
              </div>
            </div>
          </>
        )}

        {error ? (
          <p
            role="alert"
            className="text-sm text-destructive"
            data-testid="settings-embeddings-key-error"
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
