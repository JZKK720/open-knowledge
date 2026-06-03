import { ContentDivergenceWarningSchema } from '@inkeep/open-knowledge-core';
import { z } from 'zod';
import type { AgentIdentity } from '../agent-identity.ts';
import { resolvePreviewUrlForTool } from './preview-url.ts';
import type { ConfigOrResolver, ServerInstance, ServerUrlOrResolver } from './shared.ts';
import {
  HOCUSPOCUS_NOT_RUNNING_ERROR,
  httpGet,
  httpPost,
  normalizeDocName,
  ROUTED_CWD_DESCRIPTION,
  resolveProjectServerContext,
  summaryArgSchema,
  textPlusStructured,
  textResult,
} from './shared.ts';

const ACTIONS = ['save', 'rollback'] as const;
type VersionAction = (typeof ACTIONS)[number];

export const DESCRIPTION = [
  '[Requires: Hocuspocus server] Project version management. Dispatches on `action`:',
  '',
  '- `action: "save"` — Project-wide checkpoint of every document. No `docName`. Returns `{checkpointRef, previewUrl: null}`. Find checkpoints later via `get_history`.',
  '- `action: "rollback"` — Restore one document to a historical version via the CRDT layer (append-only — creates a new version with the old content; all connected editors see the change in real-time). Requires `docName` and `commitSha`. Find `commitSha` via `get_history`.',
  '',
  '**Parameters:**',
  '- `action` — `save` | `rollback`.',
  '- `docName` — Required for `rollback`. Document name, typically without extension; trailing `.md`/`.mdx` is stripped.',
  '- `commitSha` — Required for `rollback`. 40-character SHA from the shadow-repo timeline.',
  '- `summary` — Optional rollback summary (≤80 chars). If omitted, defaults to "Restored to <sha-short>". Avoid secrets or PII — summaries persist to git history.',
  '',
  'A `rollback` response may include `structuredContent.contentDivergence` (`{kind: "content-divergence", intendedBytes, actualBytes, byteDelta, divergenceType, currentState, hint}`) when the restored `Y.Text` does not byte-match the target-version bytes. The rollback still landed; `currentState` carries the converged document inline (or a truncation marker over the soft cap), so you do NOT need to re-read.',
].join('\n');

export interface VersionDeps {
  serverUrl: ServerUrlOrResolver;
  config: ConfigOrResolver;
  resolveCwd: (explicit?: string) => Promise<string>;
  /** Identity passthrough. MCP-driven save + rollback both participate
   *  in attribution via this ref; UI-driven counterparts stay anonymous. */
  identityRef?: { current: AgentIdentity };
}

interface VersionArgs {
  action: VersionAction;
  docName?: string;
  commitSha?: string;
  summary?: string;
  cwd?: string;
}

export function register(server: ServerInstance, deps: VersionDeps): void {
  server.registerTool(
    'version',
    {
      description: DESCRIPTION,
      inputSchema: {
        action: z.enum(ACTIONS).describe('Which version action to perform.'),
        docName: z.string().optional().describe('Document name. Required for action=rollback.'),
        commitSha: z
          .string()
          .length(40)
          .regex(/^[0-9a-f]+$/i)
          .optional()
          .describe(
            '40-character commit SHA from the shadow-repo timeline. Required for action=rollback. Find via get_history.',
          ),
        summary: summaryArgSchema.describe(
          'Optional rollback summary (≤80 chars). Defaults to "Restored to <sha-short>". Appears as a bullet in the timeline.',
        ),
        cwd: z.string().optional().describe(ROUTED_CWD_DESCRIPTION),
      },
    },
    async (args: VersionArgs) => {
      const context = await resolveProjectServerContext(
        deps.resolveCwd,
        deps.config,
        deps.serverUrl,
        args.cwd,
      );
      if (!context.ok) return textResult(`Error: ${context.error}`, true);
      const { cwd, url } = context;
      if (!url) return textResult(HOCUSPOCUS_NOT_RUNNING_ERROR, true);

      switch (args.action) {
        case 'save':
          return handleSave(url, deps);
        case 'rollback':
          return handleRollback(args, url, cwd, deps);
        default:
          return textResult('Error: unknown version action.', true);
      }
    },
  );
}

async function handleSave(url: string, deps: VersionDeps) {
  const identity = deps.identityRef?.current;
  const result = await httpPost(
    url,
    '/api/save-version',
    identity
      ? {
          writers: [
            {
              id: `agent-${identity.connectionId}`,
              name: identity.displayName,
              email: `agent-${identity.connectionId}@openknowledge.local`,
            },
          ],
        }
      : {},
  );
  if (!result.ok) return textResult(`Error: ${result.error}`, true);

  return textPlusStructured(`Checkpoint saved. Checkpoint ref: ${result.checkpointRef}`, {
    checkpointRef: result.checkpointRef,
    previewUrl: null,
  });
}

async function handleRollback(args: VersionArgs, url: string, cwd: string, deps: VersionDeps) {
  if (!args.docName) {
    return textResult('Error: action=rollback requires `docName`.', true);
  }
  if (!args.commitSha) {
    return textResult('Error: action=rollback requires `commitSha`.', true);
  }
  const normalized = normalizeDocName(args.docName);
  if (!normalized.ok) return textResult(normalized.error, true);
  const docName = normalized.docName;

  const versionResult = await httpGet(
    url,
    `/api/history/${args.commitSha}?docName=${encodeURIComponent(docName)}`,
  );
  if (!versionResult.ok) {
    return textResult(`Error: ${versionResult.error ?? 'Version not found'}`, true);
  }

  const identity = deps.identityRef?.current;
  const result = await httpPost(url, '/api/rollback', {
    docName,
    commitSha: args.commitSha,
    ...(args.summary !== undefined ? { summary: args.summary } : {}),
    ...(identity
      ? {
          agentId: identity.connectionId,
          agentName: identity.displayName,
          clientName: identity.clientInfo?.name,
          colorSeed: identity.colorSeed,
        }
      : {}),
  });
  if (!result.ok) return textResult(`Error: ${result.error}`, true);

  const summaryResult =
    result.summary && typeof result.summary === 'object'
      ? (result.summary as { value: string; truncatedFrom?: number; hint?: string })
      : undefined;
  const summaryHint = typeof summaryResult?.hint === 'string' ? summaryResult.hint : undefined;

  const contentDivergenceParse = ContentDivergenceWarningSchema.safeParse(result.warning);
  const contentDivergence = contentDivergenceParse.success
    ? contentDivergenceParse.data
    : undefined;

  const author = typeof versionResult.author === 'string' ? versionResult.author : undefined;
  const timestamp =
    typeof versionResult.timestamp === 'string' ? versionResult.timestamp : undefined;
  const provenance = author && timestamp ? ` (${author}, ${timestamp})` : '';
  const textLines = [
    `Restored "${docName}" to version ${args.commitSha.slice(0, 8)}${provenance}. The change has been applied to all connected editors.`,
  ];
  if (summaryHint) textLines.push(summaryHint);
  if (contentDivergence) {
    textLines.push(
      `⚠ Content divergence: ${contentDivergence.actualBytes} actual bytes vs ${contentDivergence.intendedBytes} intended (byteDelta=${contentDivergence.byteDelta}). ${contentDivergence.hint ?? 'currentState carries the converged content (re-read only if it is truncated).'}`,
    );
  }

  const preview = await resolvePreviewUrlForTool(
    docName,
    {
      config: deps.config,
      resolveCwd: deps.resolveCwd,
    },
    cwd,
  );
  return textPlusStructured(textLines.join('\n'), {
    previewUrl: preview?.url ?? null,
    ...(preview ? { previewUrlSource: preview.source } : {}),
    ...(summaryResult ? { summary: summaryResult } : {}),
    ...(contentDivergence ? { contentDivergence } : {}),
  });
}
