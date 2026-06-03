import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import {
  ContentDivergenceWarningSchema,
  normalizeBridge,
  renderInventoryFooter,
  stripFrontmatter,
} from '@inkeep/open-knowledge-core';
import { z } from 'zod';
import { resolveContentDir, resolveLockDir } from '../../config/paths.ts';
import { parentFolderOf } from '../../content/nested-folder-rules.ts';
import { applySubstitution, todayIsoUtc } from '../../content/substitution.ts';
import { resolveTemplatesAvailable } from '../../content/templates-resolver.ts';
import { SUPPORTED_DOC_EXTENSIONS } from '../../doc-extensions.ts';
import type { AgentIdentity } from '../agent-identity.ts';
import { resolveWithinRoot } from './path-safety.ts';
import { buildPreviewAttachWarning, resolvePreviewUrl, START_UI_TEXT_HINT } from './preview-url.ts';
import type { ConfigOrResolver, ServerInstance, ServerUrlOrResolver } from './shared.ts';
import {
  HOCUSPOCUS_NOT_RUNNING_ERROR,
  httpPost,
  normalizeDocName,
  ROUTED_CWD_DESCRIPTION,
  resolveProjectServerContext,
  summaryArgSchema,
  textPlusStructured,
  textResult,
} from './shared.ts';

const POSITIONS = ['append', 'prepend', 'replace'] as const;

const BASE_DESCRIPTION = [
  '[Requires: Hocuspocus server] Write markdown to a document via the CRDT layer. Content propagates to all connected editors in real-time.',
  '',
  'Frontmatter changes: 1-2 keys → prefer `edit_frontmatter` (field-level CRDT, atomic). Full rewrite (≥3-5 keys or body + frontmatter together) → this tool with `position: "replace"` and the full YAML block in the payload.',
  '',
  'Templates: `template: "<name>"` resolves against the parent folder\'s `templates_available` (see `exec("ls <folder>/")`) and becomes the new doc verbatim. `template` and `markdown` are mutually exclusive. With `template` set, `position` is forced to `"replace"`.',
  '',
  'To create several docs in one call (scaffolding a pack, seeding dossiers), pass `docs: [{docName, markdown|template, position?, summary?}, ...]` instead of the single-doc fields. Docs write in order; the response reports each.',
  '',
  '**Parameters:**',
  '- `docName` — A single document (`notes/meeting`). On create, a trailing `.mdx` authors a `.mdx` file; `.md` or no extension authors `.md`. For an existing doc the on-disk extension is preserved regardless of the suffix passed (changing it in place is not available via the MCP today).',
  '- `docs` — Batch form: array of `{docName, markdown?|template?, position?, summary?}`. Mutually exclusive with the single-doc fields.',
  '- `markdown` — Markdown payload. Required unless `template` is set. An empty string with `position: "replace"` clears the document body (frontmatter is preserved); empty `append`/`prepend` is a no-op. Empty content does NOT create a new document.',
  '- `template` — Template name. Mutually exclusive with `markdown`.',
  '- `position` — `append` | `prepend` | `replace`. Optional for a new doc (defaults to `replace`); required for an existing doc. Forced to `replace` with `template`.',
  '- `summary` — Optional one-line user-outcome (≤80 chars). Avoid secrets or PII — persisted to git history.',
  '',
  'Responses may include a content-divergence warning when the converged Y.Text doesn\'t match the bytes your payload composed to. The write still landed; you do NOT need to re-read — `currentState` carries the converged document inline (`{kind:"inline", content}`, or `{kind:"truncated", byteLength, hint}` over the soft cap). Single-doc shape: `structuredContent.contentDivergence = { kind: "content-divergence", intendedBytes, actualBytes, byteDelta, divergenceType, currentState, hint }`. Batch shape: per-doc `structuredContent.documents[].contentDivergence` with the same field set.',
].join('\n');

export const DESCRIPTION = `${BASE_DESCRIPTION}\n${renderInventoryFooter()}`;

interface WriteDocumentDeps {
  serverUrl: ServerUrlOrResolver;
  config: ConfigOrResolver;
  resolveCwd: (explicit?: string) => Promise<string>;
  identityRef?: { current: AgentIdentity };
}

interface DocSpec {
  docName: string;
  markdown?: string;
  template?: string;
  position?: string;
  summary?: string;
}

type WriteApiResult = Awaited<ReturnType<typeof httpPost>>;

type WriteOneResult =
  | {
      docName: string;
      ok: true;
      position: string;
      fromTemplate?: string;
      extensionNote?: string;
      raw: WriteApiResult;
    }
  | { docName: string; ok: false; error: string };

function frontmatterIgnoredNote(position: string, markdown: string | undefined): string | null {
  if ((position !== 'prepend' && position !== 'append') || !markdown) return null;
  if (stripFrontmatter(markdown).frontmatter.trim() === '') return null;
  return `Note: a \`---\` frontmatter block in this \`${position}\` payload was ignored — frontmatter is written only with \`position: "replace"\`. To change frontmatter, use \`edit_frontmatter\` (1-2 keys) or \`write_document({ position: "replace" })\` (full rewrite).`;
}

function emptyAppendNoOpNote(position: string, markdown: string | undefined): string | null {
  if ((position !== 'prepend' && position !== 'append') || markdown === undefined) return null;
  if (stripFrontmatter(markdown).body !== '') return null;
  return `No content to ${position} — document unchanged. To clear a document, use \`position: "replace"\` with empty \`markdown\`.`;
}

function docExtensionOnDisk(contentDir: string, docName: string): '.md' | '.mdx' | null {
  for (const ext of SUPPORTED_DOC_EXTENSIONS) {
    const contained = resolveWithinRoot(contentDir, `${docName}${ext}`);
    if (contained.ok && existsSync(contained.abs)) return ext;
  }
  return null;
}

function requestedDocExtension(rawDocName: string): '.md' | '.mdx' | null {
  const lower = rawDocName.toLowerCase();
  if (lower.endsWith('.mdx')) return '.mdx';
  if (lower.endsWith('.md')) return '.md';
  return null;
}

function extensionIgnoredNote(
  requestedExt: '.md' | '.mdx' | null,
  existingExt: '.md' | '.mdx' | null,
  docName: string,
): string | null {
  if (requestedExt === null || existingExt === null || requestedExt === existingExt) return null;
  return `Note: "${docName}" already exists as \`${docName}${existingExt}\`, so the requested \`${requestedExt}\` extension was not applied — the write went to \`${docName}${existingExt}\`. Changing a doc's on-disk extension in place isn't available via the MCP today.`;
}

async function writeOneDoc(
  spec: DocSpec,
  cwd: string,
  contentDir: string,
  url: string,
  deps: WriteDocumentDeps,
): Promise<WriteOneResult> {
  const normalized = normalizeDocName(spec.docName);
  if (!normalized.ok) return { docName: spec.docName, ok: false, error: normalized.error };
  const docName = normalized.docName;
  const identity = deps.identityRef?.current;

  if (spec.template === undefined && spec.markdown === undefined) {
    return {
      docName,
      ok: false,
      error:
        'either `markdown` or `template` must be provided — omitting both would write empty content.',
    };
  }
  if (spec.template !== undefined && spec.markdown !== undefined) {
    return {
      docName,
      ok: false,
      error:
        'TEMPLATE_AND_MARKDOWN_BOTH_SET — `template` and `markdown` are mutually exclusive. Pass one; fill placeholders via subsequent `edit_document` calls.',
    };
  }

  let effectiveMarkdown = spec.markdown ?? '';

  const existingExt = docExtensionOnDisk(contentDir, docName);
  const docExists = existingExt !== null;
  const requestedExt = requestedDocExtension(spec.docName);

  let effectivePosition: string;
  if (spec.position !== undefined) {
    effectivePosition = spec.position;
  } else if (docExists) {
    return {
      docName,
      ok: false,
      error: `"${docName}" already exists — pass \`position\` (\`append\` | \`prepend\` | \`replace\`), or use \`edit_document\` for a targeted change.`,
    };
  } else {
    effectivePosition = 'replace';
  }

  if (spec.template !== undefined) {
    const parentFolder = parentFolderOf(docName);
    const available = resolveTemplatesAvailable(cwd, parentFolder, { depth: 1 });
    const matched = available.find((t) => t.name === spec.template);
    if (!matched) {
      return {
        docName,
        ok: false,
        error: `template "${spec.template}" not found for folder "${parentFolder || '.'}". Available: ${
          available.length === 0
            ? '(none)'
            : available.map((t) => `${t.name} [${t.scope}]`).join(', ')
        }. Templates are resolved by walk-up; check the parent folder's exec listing to see the menu.`,
      };
    }
    let templateContent: string;
    try {
      templateContent = readFileSync(resolvePath(cwd, matched.path), 'utf-8');
    } catch (err) {
      return {
        docName,
        ok: false,
        error: `failed to read template at ${matched.path}: ${(err as Error).message}`,
      };
    }
    const { body: templateBody } = stripFrontmatter(templateContent);
    effectiveMarkdown = applySubstitution(templateBody, {
      date: todayIsoUtc(),
      user: identity?.displayName ?? '',
    });
    effectivePosition = 'replace';
  }

  if (!docExists && normalizeBridge(effectiveMarkdown) === '') {
    return {
      docName,
      ok: false,
      error: `"${docName}" does not exist and the content is empty — provide non-empty content to create the document.`,
    };
  }

  const result = await httpPost(url, '/api/agent-write-md', {
    docName,
    markdown: effectiveMarkdown,
    position: effectivePosition,
    ...(requestedExt !== null && !docExists ? { extension: requestedExt } : {}),
    ...(spec.summary !== undefined ? { summary: spec.summary } : {}),
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
    const detail =
      typeof result.detail === 'string' && result.detail.length > 0 ? result.detail : '';
    return {
      docName,
      ok: false,
      error: detail ? `${String(result.error)} (${detail})` : String(result.error),
    };
  }
  const extensionNote = extensionIgnoredNote(requestedExt, existingExt, docName);
  return {
    docName,
    ok: true,
    position: effectivePosition,
    ...(spec.template !== undefined ? { fromTemplate: spec.template } : {}),
    ...(extensionNote ? { extensionNote } : {}),
    raw: result,
  };
}

export function register(server: ServerInstance, deps: WriteDocumentDeps): void {
  const docSpecShape = {
    docName: z.string().describe('Document name to write to'),
    markdown: z
      .string()
      .optional()
      .describe('Markdown content to write. Optional when `template` is set.'),
    template: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Template name resolved against the parent folder's templates_available (leaf → root walk-up; closest-wins). Inspect the menu with an `exec` listing of the folder.",
      ),
    position: z
      .enum(POSITIONS)
      .optional()
      .describe(
        'Where to insert the content. Optional for a new doc (defaults to `replace`); required when the doc already exists.',
      ),
    summary: summaryArgSchema,
  };

  server.registerTool(
    'write_document',
    {
      description: DESCRIPTION,
      inputSchema: {
        docName: z.string().optional().describe('A single document to write to.'),
        markdown: z
          .string()
          .optional()
          .describe('Markdown content. Optional when `template` is set.'),
        template: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Template name resolved against the parent folder's templates_available (leaf → root walk-up; closest-wins). Inspect the menu with an `exec` listing of the folder.",
          ),
        position: z
          .enum(POSITIONS)
          .optional()
          .describe(
            'Where to insert the content. Optional for a new doc (defaults to `replace`); required when the doc already exists.',
          ),
        summary: summaryArgSchema,
        docs: z
          .array(z.object(docSpecShape))
          .min(1)
          .optional()
          .describe(
            'Batch: documents to write in one call. Mutually exclusive with the single-doc fields.',
          ),
        cwd: z.string().optional().describe(ROUTED_CWD_DESCRIPTION),
      },
    },
    async (args: {
      docName?: string;
      markdown?: string;
      template?: string;
      position?: string;
      summary?: string;
      docs?: DocSpec[];
      cwd?: string;
    }) => {
      const context = await resolveProjectServerContext(
        deps.resolveCwd,
        deps.config,
        deps.serverUrl,
        args.cwd,
      );
      if (!context.ok) return textResult(`Error: ${context.error}`, true);
      const { cwd, config, url } = context;
      if (!url) return textResult(HOCUSPOCUS_NOT_RUNNING_ERROR, true);

      const lockDir = resolveLockDir(cwd);
      const contentDir = resolveContentDir(config, cwd);
      const autoOpen = config.appearance.preview.autoOpen;

      if (args.docs !== undefined) {
        if (
          args.docName !== undefined ||
          args.markdown !== undefined ||
          args.template !== undefined ||
          args.position !== undefined ||
          args.summary !== undefined
        ) {
          return textResult(
            'Error: `docs` is the batch form — do not also pass top-level `docName` / `markdown` / `template` / `position` / `summary` (each `docs[]` entry carries its own).',
            true,
          );
        }
        const results: WriteOneResult[] = [];
        for (const spec of args.docs) {
          results.push(await writeOneDoc(spec, cwd, contentDir, url, deps));
        }
        const documents = results.map((r) => {
          if (!r.ok) return { docName: r.docName, ok: false as const, error: r.error };
          const preview = resolvePreviewUrl(r.docName, { lockDir });
          const divergenceParse = ContentDivergenceWarningSchema.safeParse(r.raw.warning);
          const divergence = divergenceParse.success ? divergenceParse.data : undefined;
          return {
            docName: r.docName,
            ok: true as const,
            position: r.position,
            ...(preview ? { previewUrl: preview.url } : {}),
            ...(divergence ? { contentDivergence: divergence } : {}),
          };
        });
        const okCount = documents.filter((d) => d.ok).length;
        const allOk = okCount === documents.length;
        const lines = args.docs.map((spec, i) => {
          const r = results[i];
          if (!r?.ok) return `Failed ${spec.docName}: ${r?.error ?? 'unknown error'}`;
          if (emptyAppendNoOpNote(r.position, spec.markdown)) {
            return `No change to ${spec.docName} — empty ${r.position}, document unchanged.`;
          }
          const d = documents[i];
          const base = `Wrote ${spec.docName} (${r.position}).`;
          return d?.ok && d.contentDivergence
            ? `${base} ⚠ Content divergence: ${d.contentDivergence.actualBytes} actual vs ${d.contentDivergence.intendedBytes} intended (byteDelta=${d.contentDivergence.byteDelta}).`
            : base;
        });
        const perDocNotes = args.docs.flatMap((spec, i) => {
          const r = results[i];
          if (!r?.ok) return [];
          const fmNote = frontmatterIgnoredNote(r.position, spec.markdown);
          const notes = [
            ...(fmNote ? [fmNote] : []),
            ...(r.extensionNote ? [r.extensionNote] : []),
          ];
          return notes.map((n) => `${spec.docName} — ${n}`);
        });
        const text = [`${okCount}/${documents.length} written.`, ...lines, ...perDocNotes].join(
          '\n',
        );
        const structured: Record<string, unknown> = { ok: allOk, documents };
        const firstOk = results.find((r): r is Extract<WriteOneResult, { ok: true }> => r.ok);
        if (firstOk && firstOk.raw.systemSubscriberCount === 0) {
          const firstPreview = resolvePreviewUrl(firstOk.docName, { lockDir });
          structured.warning = buildPreviewAttachWarning(firstPreview, autoOpen);
        }
        return textPlusStructured(text, structured, !allOk);
      }

      if (args.docName === undefined) {
        return textResult('Error: provide `docName` (single) or `docs` (batch).', true);
      }
      const w = await writeOneDoc(
        {
          docName: args.docName,
          markdown: args.markdown,
          template: args.template,
          position: args.position,
          summary: args.summary,
        },
        cwd,
        contentDir,
        url,
        deps,
      );
      if (!w.ok) return textResult(`Error: ${w.error}`, true);

      const result = w.raw;
      const preview = resolvePreviewUrl(w.docName, { lockDir });
      const subscriberCount =
        typeof result.subscriberCount === 'number' ? result.subscriberCount : undefined;
      const systemSubscriberCount =
        typeof result.systemSubscriberCount === 'number' ? result.systemSubscriberCount : undefined;
      const noPreviewAnywhere = systemSubscriberCount === 0;
      const noPreviewOnThisDoc = subscriberCount === 0;

      const hints = Array.isArray(result.hints) ? result.hints : undefined;

      const summaryResult =
        result.summary && typeof result.summary === 'object'
          ? (result.summary as { value: string; truncatedFrom?: number; hint?: string })
          : undefined;
      const summaryHint = typeof summaryResult?.hint === 'string' ? summaryResult.hint : undefined;

      const contentDivergenceParse = ContentDivergenceWarningSchema.safeParse(result.warning);
      const contentDivergence = contentDivergenceParse.success
        ? contentDivergenceParse.data
        : undefined;

      const noOpNote = emptyAppendNoOpNote(w.position, args.markdown);
      const lines: string[] = [
        noOpNote ??
          (w.fromTemplate !== undefined
            ? `Written successfully (instantiated from template "${w.fromTemplate}").`
            : `Written successfully (${w.position}).`),
      ];
      const fmNote = frontmatterIgnoredNote(w.position, args.markdown);
      if (fmNote) lines.push(fmNote);
      if (w.extensionNote) lines.push(w.extensionNote);
      if (noPreviewAnywhere && !preview) lines.push(START_UI_TEXT_HINT);
      if (summaryHint) lines.push(summaryHint);
      if (hints) {
        for (const hint of hints) {
          if (hint.message) lines.push(hint.message);
        }
      }
      if (contentDivergence) {
        lines.push(
          `⚠ Content divergence: ${contentDivergence.actualBytes} actual bytes vs ${contentDivergence.intendedBytes} intended (byteDelta=${contentDivergence.byteDelta}). ${contentDivergence.hint ?? 'currentState carries the converged content (re-read only if it is truncated).'}`,
        );
      }
      const text = lines.join('\n');

      if (
        !preview &&
        !noPreviewAnywhere &&
        !noPreviewOnThisDoc &&
        !hints &&
        !summaryResult &&
        !contentDivergence
      ) {
        return textResult(text);
      }

      const structured: Record<string, unknown> = {};
      if (preview) {
        structured.previewUrl = preview.url;
        structured.previewUrlSource = preview.source;
      }
      if (noPreviewAnywhere) {
        structured.warning = buildPreviewAttachWarning(preview, autoOpen);
      }
      if (hints) {
        structured.hints = hints;
      }
      if (summaryResult) {
        structured.summary = summaryResult;
      }
      if (contentDivergence) {
        structured.contentDivergence = contentDivergence;
      }
      return textPlusStructured(text, structured);
    },
  );
}
