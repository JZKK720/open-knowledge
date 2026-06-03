import { DerivedViewChannelSchema } from '@inkeep/open-knowledge-core';
import type { DerivedViewChannel } from '@/lib/cc1';

const DOCUMENTS_CHANGED_EVENT = 'open-knowledge:documents-changed';
const DERIVED_VIEW_CHANNELS = new Set(DerivedViewChannelSchema.options);

interface DocumentsChangedDetail {
  channels: DerivedViewChannel[];
}

function normalizeChannels(channels: unknown): DerivedViewChannel[] {
  if (channels === undefined || !Array.isArray(channels)) return ['files'];
  return [
    ...new Set(
      channels.filter((channel): channel is DerivedViewChannel =>
        DERIVED_VIEW_CHANNELS.has(channel),
      ),
    ),
  ];
}

export function emitDocumentsChanged(channels: DerivedViewChannel[] = ['files']): void {
  window.dispatchEvent(
    new CustomEvent<DocumentsChangedDetail>(DOCUMENTS_CHANGED_EVENT, {
      detail: { channels: normalizeChannels(channels) },
    }),
  );
}

export function subscribeToDocumentsChanged(
  onChange: (channels: DerivedViewChannel[]) => void,
): () => void {
  const listener = (event: Event) => {
    const channels =
      event instanceof CustomEvent
        ? (event as CustomEvent<DocumentsChangedDetail>).detail?.channels
        : undefined;
    onChange(normalizeChannels(channels));
  };
  window.addEventListener(DOCUMENTS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(DOCUMENTS_CHANGED_EVENT, listener);
}

const BRANCH_CHANGED_EVENT = 'open-knowledge:branch-changed';

interface BranchChangedDetail {
  branch: string | null;
}

export function emitBranchChanged(branch: string | null): void {
  window.dispatchEvent(
    new CustomEvent<BranchChangedDetail>(BRANCH_CHANGED_EVENT, {
      detail: { branch },
    }),
  );
}

export function subscribeToBranchChanged(onChange: (branch: string | null) => void): () => void {
  const listener = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = (event as CustomEvent<BranchChangedDetail>).detail;
    onChange(detail?.branch ?? null);
  };
  window.addEventListener(BRANCH_CHANGED_EVENT, listener);
  return () => window.removeEventListener(BRANCH_CHANGED_EVENT, listener);
}

const TEMPLATES_CHANGED_EVENT = 'open-knowledge:templates-changed';

export function emitTemplatesChanged(): void {
  window.dispatchEvent(new CustomEvent(TEMPLATES_CHANGED_EVENT));
}

export function subscribeToTemplatesChanged(onChange: () => void): () => void {
  const listener = () => onChange();
  window.addEventListener(TEMPLATES_CHANGED_EVENT, listener);
  return () => window.removeEventListener(TEMPLATES_CHANGED_EVENT, listener);
}
