import type { Document } from 'yaml';
import type { ConfigIssueSource, ConfigValidationError } from './errors.ts';
import { locateIssue } from './source-locator.ts';

export interface RemovedKey {
  path: string[];
  redirect: string;
}

const MIGRATE_HINT =
  'Run `ok config migrate` to strip the obsolete key from config.yml automatically, or remove it by hand.';

export const REMOVED_KEYS: readonly RemovedKey[] = [
  {
    path: ['content', 'include'],
    redirect: [
      'content.include has been removed.',
      'For subdirectory scoping, set content.dir in .ok/config.yml instead.',
      'For pattern-based filtering, use .okignore (gitignore syntax — exclude-only; do not copy include patterns directly).',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['content', 'exclude'],
    redirect: [
      'Move these patterns to .okignore at the project root (gitignore syntax, 1:1 migration).',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['folders'],
    redirect: [
      'folders is no longer a top-level config field.',
      "A folder's own frontmatter (open-shape, like a doc's) lives in nested `<folder>/.ok/frontmatter.yml`; new-doc starting properties come from templates in `<folder>/.ok/templates/`.",
      'Edit via the folder overview in the editor sidebar, or `edit({ folder: { path, frontmatter } })` via the MCP.',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['appearance', 'editorModeDefault'],
    redirect: [
      'appearance.editorModeDefault was removed and is never read — new docs always open in WYSIWYG; toggle mode via the editor mode button.',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['upload', 'maxBytes'],
    redirect: [
      'streaming uploads have no user-facing cap; the value is hardcoded in @inkeep/open-knowledge-core.',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['github', 'oauthAppClientId'],
    redirect: [
      'Use the OPEN_KNOWLEDGE_GITHUB_CLIENT_ID environment variable instead.',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['server', 'host'],
    redirect: [
      'Use the --host CLI flag or the HOST environment variable instead.',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['server', 'openOnAgentEdit'],
    redirect: ['This behavior was removed; the value is hardcoded.', MIGRATE_HINT].join(' '),
  },
  {
    path: ['mcp', 'autoStart'],
    redirect: ['To disable MCP auto-start, set OK_MCP_AUTOSTART=0.', MIGRATE_HINT].join(' '),
  },
  {
    path: ['mcp', 'tools', 'read_document', 'historyDepth'],
    redirect: ['This value is hardcoded in @inkeep/open-knowledge-core.', MIGRATE_HINT].join(' '),
  },
  {
    path: ['mcp', 'tools', 'grep', 'maxResults'],
    redirect: ['This value is hardcoded in @inkeep/open-knowledge-core.', MIGRATE_HINT].join(' '),
  },
  {
    path: ['mcp', 'tools', 'search', 'maxResults'],
    redirect: [
      'The search result cap is hardcoded in @inkeep/open-knowledge-core; this config key was removed.',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['preview', 'baseUrl'],
    redirect: [
      'preview URLs now resolve only to the running UI process — start one with `ok ui`.',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['preview', 'scriptSrc'],
    redirect: [
      'preview.scriptSrc has been removed.',
      'The code-block preview iframe now runs a fixed open network policy (it is no longer configurable).',
      MIGRATE_HINT,
    ].join(' '),
  },
  {
    path: ['appearance', 'sidebar', 'showAllFiles'],
    redirect: [
      'appearance.sidebar.showAllFiles has been removed.',
      'The sidebar now always lists every file on disk; dot-prefixed entries are still gated by appearance.sidebar.showHiddenFiles. There is no longer a way to scope the tree to indexed/linked content.',
      MIGRATE_HINT,
    ].join(' '),
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasLeaf(value: unknown, path: readonly string[]): boolean {
  let cursor: unknown = value;
  for (let i = 0; i < path.length - 1; i++) {
    if (!isPlainObject(cursor)) return false;
    cursor = cursor[path[i] as string];
  }
  if (!isPlainObject(cursor)) return false;
  return (path[path.length - 1] as string) in cursor;
}

export interface DetectRemovedKeysInput {
  value: unknown;
  file?: string | null;
  source?: string | null;
  doc?: Document | null;
}

export function detectRemovedKeys(input: DetectRemovedKeysInput): ConfigValidationError[] {
  const { value, file, source, doc } = input;
  if (!isPlainObject(value)) return [];
  const errors: ConfigValidationError[] = [];
  for (const entry of REMOVED_KEYS) {
    if (!hasLeaf(value, entry.path)) continue;
    let located: ConfigIssueSource | undefined;
    if (doc != null && source != null && file != null) {
      located = locateIssue({ file, source, doc, path: entry.path });
    }
    errors.push({
      code: 'REMOVED_KEY',
      path: entry.path,
      redirect: entry.redirect,
      ...(located !== undefined ? { source: located } : {}),
    });
  }
  return errors;
}
