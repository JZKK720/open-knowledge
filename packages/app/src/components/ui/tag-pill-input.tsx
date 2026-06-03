'use client';

import {
  FRONTMATTER_TAG_GRAMMAR_HINT,
  isValidFrontmatterTagValue,
} from '@inkeep/open-knowledge-core';
import { useLingui } from '@lingui/react/macro';
import { XIcon } from 'lucide-react';
import { type Ref, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TagPillInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  onBlur?: () => void;
  placeholder?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}

function TagPillInput({
  value,
  onChange,
  onBlur,
  placeholder,
  id,
  disabled,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ref,
}: TagPillInputProps) {
  const { t } = useLingui();
  const [draft, setDraft] = useState('');
  const [draftRejected, setDraftRejected] = useState(false);
  const fallbackId = useId();
  const grammarHintId = `${id ?? fallbackId}-grammar-hint`;
  const resolvedPlaceholder = placeholder ?? t`Add tag`;

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (!isValidFrontmatterTagValue(tag)) {
      setDraftRejected(true);
      return;
    }
    const normalized = tag.startsWith('#') ? tag.slice(1) : tag;
    if (value.includes(normalized)) {
      setDraft('');
      setDraftRejected(false);
      return;
    }
    setDraftRejected(false);
    onChange([...value, normalized]);
    setDraft('');
  };

  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  return (
    <div
      data-slot="tag-pill-input"
      aria-invalid={draftRejected ? 'true' : ariaInvalid}
      className={cn(
        'flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1 text-sm transition-colors',
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        'dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      {value.map((tag, i) => {
        const invalid = !isValidFrontmatterTagValue(tag);
        const badge = (
          <Badge
            key={tag}
            variant={invalid ? 'destructive' : 'secondary'}
            data-tag-invalid={invalid ? 'true' : undefined}
            className={cn('gap-1 pl-2 pr-1', invalid && 'ring-1 ring-destructive/40')}
          >
            <span className="font-mono">{tag}</span>
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={t`Remove ${tag}`}
              className="rounded-sm p-0.5 hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              disabled={disabled}
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        );
        if (!invalid) return badge;
        return (
          <Tooltip key={tag}>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>{FRONTMATTER_TAG_GRAMMAR_HINT}</TooltipContent>
          </Tooltip>
        );
      })}
      <input
        id={id}
        ref={ref}
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (draftRejected) setDraftRejected(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (draft.trim()) {
              e.preventDefault();
              addTag(draft);
            }
          } else if (e.key === ',') {
            e.preventDefault();
            if (draft.trim()) {
              addTag(draft);
            }
          } else if (e.key === 'Tab') {
            if (draft.trim()) {
              e.preventDefault();
              addTag(draft);
            }
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            e.preventDefault();
            removeAt(value.length - 1);
          } else if (e.key === 'Escape') {
            if (draftRejected) {
              e.preventDefault();
              setDraftRejected(false);
            }
          }
        }}
        onBlur={() => {
          if (draft.trim()) addTag(draft);
          onBlur?.();
        }}
        placeholder={value.length === 0 ? resolvedPlaceholder : ''}
        data-tag-invalid={draftRejected ? 'true' : undefined}
        aria-describedby={
          [draftRejected ? grammarHintId : undefined, ariaDescribedBy].filter(Boolean).join(' ') ||
          undefined
        }
        aria-invalid={draftRejected ? 'true' : ariaInvalid}
        disabled={disabled}
        className={cn(
          'min-w-[8ch] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed',
          draftRejected && 'text-destructive placeholder:text-destructive/60',
        )}
      />
      {draftRejected && (
        <span
          id={grammarHintId}
          role="alert"
          data-testid="tag-pill-input-error"
          className="w-full px-1 pt-0.5 text-xs text-destructive"
        >
          {FRONTMATTER_TAG_GRAMMAR_HINT}
        </span>
      )}
    </div>
  );
}

export { TagPillInput };
