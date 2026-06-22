'use client';

import { Check, ChevronDown, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clipboardCopyOutcome } from '@/lib/share-splash';
import { cn } from '@/lib/utils';

interface SplashCliBlockProps {
  installCommand: string;
  cloneCommand: string;
  disclosureSummary?: { lead: string; action: string };
  initialOpen?: boolean;
}

const COPY_RESET_MS = 2000;
const FAILED_RESET_MS = 5000;

type CopyStatus = 'idle' | 'copied' | 'failed';

export function SplashCliBlock({
  installCommand,
  cloneCommand,
  disclosureSummary,
  initialOpen,
}: SplashCliBlockProps) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const [failureSelected, setFailureSelected] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  function scheduleStatusReset(ms: number) {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      setStatus('idle');
      resetTimerRef.current = null;
    }, ms);
  }

  const payload = `${installCommand}\n${cloneCommand}`;

  const handleCopy = async () => {
    let succeeded = true;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      succeeded = false;
    }
    const outcome = clipboardCopyOutcome(succeeded);
    if (outcome.kind === 'copied') {
      setStatus('copied');
      scheduleStatusReset(COPY_RESET_MS);
      return;
    }
    let selected = false;
    if (codeRef.current) {
      const range = document.createRange();
      range.selectNodeContents(codeRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      selected = true;
    }
    setFailureSelected(selected);
    setStatus('failed');
    scheduleStatusReset(FAILED_RESET_MS);
  };

  const statusLabel =
    status === 'copied'
      ? 'Copied'
      : status === 'failed'
        ? failureSelected
          ? "Couldn't copy — text is selected"
          : "Couldn't copy"
        : 'Copy';

  const body = (
    <div className="not-prose relative" data-testid="splash-cli-body">
      <pre
        ref={codeRef}
        className="overflow-x-auto whitespace-pre rounded-lg border border-slide-border bg-slide-bg-elevated py-3.5 pr-12 pl-4 font-mono text-sm leading-relaxed text-slide-text"
      >
        <code className="block">{installCommand}</code>
        <code className="block">{cloneCommand}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        data-testid="splash-cli-copy"
        aria-label="Copy install and clone commands to clipboard"
        title={statusLabel}
        data-copy-status={status}
        className={cn(
          'absolute top-2.5 right-2.5 inline-flex size-7 items-center justify-center rounded-md text-slide-muted transition',
          'hover:bg-black/5 hover:text-slide-text dark:hover:bg-white/10',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slide-accent',
          status === 'copied' && 'text-slide-accent-strong',
        )}
      >
        {status === 'copied' ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {/* Status stays announced to assistive tech (the clipboard-failure
            recovery) while the visible affordance is icon-only. */}
        <span className="sr-only" aria-live="polite">
          {statusLabel}
        </span>
      </button>
    </div>
  );

  if (!disclosureSummary) {
    return <div className="mt-12">{body}</div>;
  }

  return (
    <details className="group mt-6" data-testid="splash-cli-disclosure" open={initialOpen ?? false}>
      <summary
        className={cn(
          'group/cli inline-flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm text-slide-muted',
          'focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slide-accent',
          '[&::-webkit-details-marker]:hidden',
        )}
        data-testid="splash-cli-disclosure-summary"
      >
        <span>
          {disclosureSummary.lead}{' '}
          <span className="font-medium text-slide-text underline underline-offset-4 transition-colors group-hover/cli:text-slide-accent-strong">
            {disclosureSummary.action}
          </span>
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-slide-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-3">{body}</div>
    </details>
  );
}
