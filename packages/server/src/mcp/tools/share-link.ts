import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ShareConstructUrlErrorCode,
  ShareConstructUrlResponseSchema,
} from '@inkeep/open-knowledge-core';
import { z } from 'zod';
import { resolveWithinRoot } from './path-safety.ts';
import { resolvePreviewUrlForTool } from './preview-url.ts';
import type { ConfigOrResolver, ServerInstance, ServerUrlOrResolver } from './shared.ts';
import {
  HOCUSPOCUS_NOT_RUNNING_ERROR,
  normalizeDocName,
  outputSchemaWithText,
  ROUTED_CWD_DESCRIPTION,
  resolveProjectServerContext,
  textPlusStructured,
  textResult,
} from './shared.ts';

export const DESCRIPTION = [
  "[Requires: Hocuspocus server] Build a shareable GitHub-substrate URL (`https://openknowledge.ai/d/...`) pinned to the project's current branch + the focused doc. Read-only against the working tree — no commits, no pushes, no `git fetch`.",
  '',
  'Use this when the user asks for a share link / shareable link / URL to send to a teammate. Recipients open the link to receive the doc into their own Open Knowledge install.',
  '',
  '**Publishing is a user act.** Agents do NOT publish projects to GitHub from this tool. When the project has no GitHub remote, this tool returns an error pointing the user at the Share wizard (or `gh repo create` + `git push`) — it does not run those steps itself.',
  '',
  '**Parameters:**',
  '- `docName` — Document name, extension-less. Trailing `.md`/`.mdx` is stripped; the on-disk file is probed automatically.',
  '- `cwd` (optional) — Project root (see `cwd` description below).',
  '',
  '**Preconditions:** project on a named branch (not detached HEAD); origin set to a `github.com` remote; the branch already pushed to origin.',
].join('\n');

export interface ShareLinkDeps {
  serverUrl: ServerUrlOrResolver;
  config: ConfigOrResolver;
  resolveCwd: (explicit?: string) => Promise<string>;
}

interface ShareLinkSuccess {
  ok: true;
  shareUrl: string;
  blobUrl: string;
  branch: string;
}

interface ShareLinkError {
  ok: false;
  error: ShareConstructUrlErrorCode | 'doc-not-found' | 'unknown';
  message: string;
  branch?: string;
}

function messageForShareError(error: ShareConstructUrlErrorCode, branch?: string): string {
  switch (error) {
    case 'no-remote':
      return 'This project has no GitHub remote. Ask the user to push it to GitHub first (e.g. `gh repo create` then `git push -u origin <branch>`), or use the Share button in the editor to run the Publish wizard. Agents do not publish projects from this tool.';
    case 'detached-head':
      return 'HEAD is detached (no branch checked out). Ask the user to check out a branch (`git checkout <branch>`) before sharing.';
    case 'branch-not-on-origin': {
      const fetchHint =
        ' (If the user says it is already pushed, ask them to `git fetch origin` first to refresh the local mirror, then retry.)';
      return branch
        ? `Branch \`${branch}\` is not on origin yet. Ask the user to push it (\`git push -u origin ${branch}\`), then retry.${fetchHint}`
        : `The current branch is not on origin yet. Ask the user to push it (\`git push -u origin <branch>\`), then retry.${fetchHint}`;
    }
    case 'non-github-remote':
      return 'Origin is not a `github.com` remote. Share links are GitHub-only in v1.';
    case 'invalid-path':
      return 'The resolved document path is not shareable (escapes the project root or names the `.git` subtree). Pass a normal docName under the content directory.';
    default: {
      const _exhaustive: never = error;
      return `Unknown share-construct-url error: ${String(_exhaustive)}`;
    }
  }
}

function resolveDocSharePath(
  projectDir: string,
  contentDir: string,
  docName: string,
): string | null {
  const contained = resolveWithinRoot(contentDir, docName);
  if (!contained.ok) return null;
  for (const ext of ['.mdx', '.md'] as const) {
    const absWithExt = `${contained.abs}${ext}`;
    if (existsSync(absWithExt)) {
      const projectContained = resolveWithinRoot(projectDir, absWithExt);
      if (!projectContained.ok) return null;
      return projectContained.rel;
    }
  }
  return null;
}

const OutputSchema = outputSchemaWithText({
  ok: z.boolean().describe('Success discriminator.'),
  shareUrl: z.string().optional().describe('Marketing share URL (success only).'),
  blobUrl: z.string().optional().describe('Unencoded GitHub blob URL (success only).'),
  branch: z.string().optional().describe('Branch the share URL pins to (success only).'),
  error: z
    .enum([
      'no-remote',
      'detached-head',
      'branch-not-on-origin',
      'non-github-remote',
      'invalid-path',
      'doc-not-found',
      'unknown',
    ])
    .optional()
    .describe('Failure code (error path only).'),
  message: z.string().optional().describe('Agent-actionable error message (error path only).'),
  previewUrl: z
    .string()
    .nullable()
    .optional()
    .describe('Route-only preview URL `/#/<doc>` (no host:port). `null` when no UI is running.'),
  previewUrlSource: z.string().optional().describe('Internal: preview-URL provenance.'),
});

export function register(server: ServerInstance, deps: ShareLinkDeps): void {
  server.registerTool(
    'share_link',
    {
      description: DESCRIPTION,
      inputSchema: {
        docName: z
          .string()
          .describe('Document to share, extension-less. Trailing `.md`/`.mdx` is stripped.'),
        cwd: z.string().optional().describe(ROUTED_CWD_DESCRIPTION),
      },
      outputSchema: OutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async (args: { docName: string; cwd?: string }) => {
      const context = await resolveProjectServerContext(
        deps.resolveCwd,
        deps.config,
        deps.serverUrl,
        args.cwd,
      );
      if (!context.ok) return textResult(`Error: ${context.error}`, true);
      const { cwd, config, url } = context;
      if (!url) return textResult(HOCUSPOCUS_NOT_RUNNING_ERROR, true);

      const normalized = normalizeDocName(args.docName);
      if (!normalized.ok) return textResult(normalized.error, true);

      const contentDir = join(cwd, config.content.dir);
      const docPath = resolveDocSharePath(cwd, contentDir, normalized.docName);
      if (docPath === null) {
        const structured: ShareLinkError = {
          ok: false,
          error: 'doc-not-found',
          message: `Document \`${normalized.docName}\` does not exist under the content directory (looked for \`.md\` and \`.mdx\`).`,
        };
        return textPlusStructured(`Error: ${structured.message}`, structured, true);
      }

      let res: Response;
      try {
        res = await fetch(`${url}/api/share/construct-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docPath }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (err) {
        const errMessage = `Server unreachable: ${err instanceof Error ? err.message : String(err)}`;
        return textPlusStructured(
          `Error: ${errMessage}`,
          { ok: false, error: 'unknown', message: errMessage } satisfies ShareLinkError,
          true,
        );
      }
      let rawBody: unknown;
      try {
        rawBody = await res.json();
      } catch (parseErr) {
        const errMessage = `Server returned non-JSON body: ${
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        }`;
        return textPlusStructured(
          `Error: ${errMessage}`,
          { ok: false, error: 'unknown', message: errMessage } satisfies ShareLinkError,
          true,
        );
      }
      if (!res.ok) {
        let message: string;
        if (rawBody && typeof rawBody === 'object') {
          const record = rawBody as Record<string, unknown>;
          const title = typeof record.title === 'string' ? record.title : undefined;
          const detail = typeof record.detail === 'string' ? record.detail : undefined;
          if (title && detail) {
            message = `${title}: ${detail}`;
          } else if (title) {
            message = title;
          } else if (detail) {
            message = detail;
          } else {
            message = `HTTP ${res.status}`;
          }
        } else {
          message = `HTTP ${res.status}`;
        }
        return textPlusStructured(
          `Error: ${message}`,
          { ok: false, error: 'unknown', message } satisfies ShareLinkError,
          true,
        );
      }
      const parsed = ShareConstructUrlResponseSchema.safeParse(rawBody);
      if (!parsed.success) {
        const errMessage = 'Server returned an unexpected share-construct-url response shape.';
        return textPlusStructured(
          `Error: ${errMessage}`,
          { ok: false, error: 'unknown', message: errMessage } satisfies ShareLinkError,
          true,
        );
      }
      const body = parsed.data;

      if (!body.ok) {
        const message = messageForShareError(body.error, body.branch);
        const structured: ShareLinkError = {
          ok: false,
          error: body.error,
          message,
          ...(body.branch ? { branch: body.branch } : {}),
        };
        return textPlusStructured(`Error: ${message}`, structured, true);
      }

      const { shareUrl, blobUrl, branch } = body;
      const structured: ShareLinkSuccess = { ok: true, shareUrl, blobUrl, branch };
      const preview = await resolvePreviewUrlForTool(
        normalized.docName,
        { config: deps.config, resolveCwd: deps.resolveCwd },
        cwd,
      );
      return textPlusStructured(
        `Share link for \`${normalized.docName}\` on branch \`${branch}\`:\n${shareUrl}`,
        {
          ...structured,
          previewUrl: preview?.url ?? null,
          ...(preview ? { previewUrlSource: preview.source } : {}),
        },
      );
    },
  );
}
