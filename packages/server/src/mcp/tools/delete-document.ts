import { z } from 'zod';
import type { AgentIdentity } from '../agent-identity.ts';
import { resolvePreviewUrlForTool } from './preview-url.ts';
import type { ConfigOrResolver, ServerInstance, ServerUrlOrResolver } from './shared.ts';
import {
  HOCUSPOCUS_NOT_RUNNING_ERROR,
  httpPost,
  normalizeDocName,
  ROUTED_CWD_DESCRIPTION,
  resolveProjectServerContext,
  textPlusStructured,
  textResult,
} from './shared.ts';

interface DeleteDocumentSuccess {
  ok: true;
  deletedDocNames: string[];
  /** Preview URL that used to resolve to the now-deleted doc. Lets agents
   *  close the stale preview tab. Mirrors `rename`'s `previousPreviewUrl`. */
  previousPreviewUrl?: string;
}

interface DeleteDocumentError {
  ok: false;
  error: string;
}

export const DESCRIPTION = [
  '[Requires: Hocuspocus server] Delete a document through the managed delete flow at `POST /api/delete-path` (kind: file).',
  'Closes all open agent sessions for the doc, unloads it from Hocuspocus, and removes the file from disk.',
  '',
  '**Parameters:**',
  '- `docName` — A single document to delete, typically extension-less. A trailing `.md` or `.mdx` is stripped automatically.',
  '- `docNames` — Batch form: an array of documents to delete in one call. Mutually exclusive with `docName`. Each is deleted independently; the response reports per-doc status.',
  '',
  '**Notes:**',
  '- Inbound wiki-links to the deleted doc become dead links (redlinks) — they are NOT rewritten. Call `links({ kind: "backlinks", docName: "your-doc" })` BEFORE deleting to see which docs link here, then update or remove those references first.',
  '- Deletion is irreversible from this tool. Use `version({ action: "save" })` beforehand if you may need to roll back.',
  '- The structured response includes `previousPreviewUrl` (when a preview source resolves) so agents can close any stale preview tab pointing at the deleted doc.',
  '',
  '**Errors:**',
  '- 400 — `docName` is not a valid relative content path.',
  '- 404 — document does not exist.',
].join('\n');

export interface DeleteDocumentDeps {
  serverUrl: ServerUrlOrResolver;
  config: ConfigOrResolver;
  resolveCwd: (explicit?: string) => Promise<string>;
  /** Identity passthrough for attribution threading. The server-side handler
   *  calls `extractAgentIdentity(body)` even though it does not currently
   *  surface the agent in the response — keep the field so future
   *  timeline/audit work picks up MCP-driven deletes correctly. */
  identityRef?: { current: AgentIdentity };
}

interface DeleteOneResult {
  docName: string;
  ok: boolean;
  deletedDocNames?: string[];
  previousPreviewUrl?: string;
  error?: string;
}

function parseDeletedDocNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

async function deleteOne(
  rawDocName: string,
  url: string,
  cwd: string,
  deps: DeleteDocumentDeps,
): Promise<DeleteOneResult> {
  const normalized = normalizeDocName(rawDocName);
  if (!normalized.ok) return { docName: rawDocName, ok: false, error: normalized.error };

  const identity = deps.identityRef?.current;
  const result = await httpPost(url, '/api/delete-path', {
    kind: 'file',
    path: normalized.docName,
    ...(identity
      ? {
          agentId: identity.connectionId,
          agentName: identity.displayName,
          clientName: identity.clientInfo?.name,
          colorSeed: identity.colorSeed,
        }
      : {}),
  });

  if (!result.ok) {
    return { docName: normalized.docName, ok: false, error: result.error as string };
  }

  const deletedDocNames = parseDeletedDocNames(result.deletedDocNames);
  const previousPreview = await resolvePreviewUrlForTool(
    normalized.docName,
    { config: deps.config, resolveCwd: deps.resolveCwd },
    cwd,
  );
  return {
    docName: normalized.docName,
    ok: true,
    deletedDocNames: deletedDocNames.length > 0 ? deletedDocNames : [normalized.docName],
    ...(previousPreview ? { previousPreviewUrl: previousPreview.url } : {}),
  };
}

export function register(server: ServerInstance, deps: DeleteDocumentDeps): void {
  server.registerTool(
    'delete_document',
    {
      description: DESCRIPTION,
      inputSchema: {
        docName: z.string().optional().describe('A single document to delete.'),
        docNames: z
          .array(z.string())
          .min(1)
          .optional()
          .describe('Batch: documents to delete in one call. Mutually exclusive with `docName`.'),
        cwd: z.string().optional().describe(ROUTED_CWD_DESCRIPTION),
      },
    },
    async (args: { docName?: string; docNames?: string[]; cwd?: string }) => {
      const context = await resolveProjectServerContext(
        deps.resolveCwd,
        deps.config,
        deps.serverUrl,
        args.cwd,
      );
      if (!context.ok) return textResult(`Error: ${context.error}`, true);
      const { cwd, url } = context;
      if (!url) return textResult(HOCUSPOCUS_NOT_RUNNING_ERROR, true);

      if (args.docName === undefined && args.docNames === undefined) {
        return textResult('Error: provide `docName` (single) or `docNames` (batch).', true);
      }
      if (args.docName !== undefined && args.docNames !== undefined) {
        return textResult('Error: `docName` and `docNames` are mutually exclusive.', true);
      }

      if (args.docNames !== undefined) {
        const results = await Promise.all(args.docNames.map((d) => deleteOne(d, url, cwd, deps)));
        const okCount = results.filter((r) => r.ok).length;
        const allOk = okCount === results.length;
        const lines = results.map((r) =>
          r.ok ? `Deleted ${r.docName}.` : `Failed ${r.docName}: ${r.error}`,
        );
        const text = `${okCount}/${results.length} deleted.\n${lines.join('\n')}`;
        return textPlusStructured(text, { ok: allOk, documents: results }, !allOk);
      }

      const r = await deleteOne(args.docName as string, url, cwd, deps);
      if (!r.ok) {
        const structured: DeleteDocumentError = { ok: false, error: r.error ?? 'unknown error' };
        return textPlusStructured(`Error: ${structured.error}`, structured, true);
      }
      const deletedDocNames = r.deletedDocNames ?? [r.docName];
      const structured: DeleteDocumentSuccess = {
        ok: true,
        deletedDocNames,
        ...(r.previousPreviewUrl ? { previousPreviewUrl: r.previousPreviewUrl } : {}),
      };
      const text =
        deletedDocNames.length === 1
          ? `Deleted ${deletedDocNames[0]}.`
          : `Deleted ${deletedDocNames.length} documents: ${deletedDocNames.join(', ')}.`;
      return textPlusStructured(text, structured);
    },
  );
}
