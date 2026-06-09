import type { SemanticIndexStatus } from '@inkeep/open-knowledge-core';
import { useEffect, useState } from 'react';
import { subscribeToDocumentsChanged } from '@/lib/documents-events';

async function fetchSemanticStatus(): Promise<SemanticIndexStatus | null> {
  try {
    const res = await fetch('/api/semantic-status');
    if (!res.ok) {
      console.debug('[semantic-status] probe returned', res.status);
      return null;
    }
    return (await res.json()) as SemanticIndexStatus;
  } catch (err) {
    console.debug('[semantic-status] probe failed', err);
    return null;
  }
}

interface UseSemanticSearchStatusResult {
  status: SemanticIndexStatus | null;
  refresh: () => void;
}

export function useSemanticSearchStatus(): UseSemanticSearchStatusResult {
  const [status, setStatus] = useState<SemanticIndexStatus | null>(null);

  function refresh() {
    void fetchSemanticStatus().then((next) => {
      if (next) setStatus(next);
    });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is intentionally stable (defined in component scope)
  useEffect(() => {
    refresh();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is intentionally stable (defined in component scope)
  useEffect(() => {
    return subscribeToDocumentsChanged((channels) => {
      if (channels.includes('files')) refresh();
    });
  }, []);

  return { status, refresh };
}
