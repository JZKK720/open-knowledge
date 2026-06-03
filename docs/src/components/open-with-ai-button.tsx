import { ChevronRight, Sparkles } from 'lucide-react';

export function OpenWithAiButton() {
  return (
    <span className="not-prose mx-0.5 inline-flex select-none items-center gap-1.5 rounded-md border border-fd-border bg-fd-muted px-2 py-0.5 align-middle text-sm font-medium text-fd-foreground">
      <Sparkles className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
      Open with AI
      <ChevronRight className="size-3 text-fd-muted-foreground" aria-hidden="true" />
    </span>
  );
}
