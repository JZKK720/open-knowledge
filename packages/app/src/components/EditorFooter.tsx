import { Plural, useLingui } from '@lingui/react/macro';
import { GitBranch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type EditorFooterIdentity,
  useEditorFooterIdentity,
} from '@/hooks/use-editor-footer-identity';
import type { DocumentStats } from '@/lib/document-stats';

interface EditorFooterProps {
  stats: DocumentStats;
  /** Stats group renders only when there's a real doc scope. When false and
   *  identity is also empty, the footer renders nothing. */
  showStats?: boolean;
}

export function EditorFooter({ stats, showStats = true }: EditorFooterProps) {
  const { t } = useLingui();
  const identity = useEditorFooterIdentity();
  if (!showStats && identity === null) return null;
  const { words, chars, tokens } = stats;
  return (
    <section
      aria-label={showStats ? t`Document statistics` : t`Editor status bar`}
      className="relative flex h-6 shrink-0 items-center justify-between gap-3 bg-background px-3 text-2xs text-muted-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full h-2 bg-linear-to-t from-background to-transparent"
      />
      <span className="flex min-w-0 items-center gap-3">
        {identity !== null ? <IdentityRow identity={identity} /> : null}
      </span>
      {showStats ? (
        <span className="flex items-center shrink-0 gap-3">
          <span>
            <span className="tabular-nums">{stats.words.toLocaleString()}</span>{' '}
            <Plural value={words} one="word" other="words" />
          </span>
          <span>
            <span className="tabular-nums">{stats.chars.toLocaleString()}</span>{' '}
            <Plural value={chars} one="char" other="chars" />
          </span>
          <span>
            {stats.tokens > 0 ? '~' : ''}
            <span className="tabular-nums">{stats.tokens.toLocaleString()}</span>{' '}
            <Plural value={tokens} one="token" other="tokens" />
          </span>
        </span>
      ) : null}
    </section>
  );
}

function IdentityRow({ identity }: { identity: EditorFooterIdentity }) {
  const { projectName, projectPath, branch } = identity;
  return (
    <>
      {projectName !== null ? (
        projectPath ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* biome-ignore lint/a11y/noNoninteractiveTabindex: tooltip-on-static-text pattern — focusable span lets keyboard users surface the full project path that mouse users see on hover. */}
              <span tabIndex={0} className="truncate" data-testid="editor-footer-project-name">
                {projectName}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs break-all">
              {projectPath}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="truncate" data-testid="editor-footer-project-name">
            {projectName}
          </span>
        )
      ) : null}
      {branch !== null ? (
        <span className="flex min-w-0 items-center gap-1" data-testid="editor-footer-branch">
          <GitBranch aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{branch}</span>
        </span>
      ) : null}
    </>
  );
}
