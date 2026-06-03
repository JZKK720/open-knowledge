import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { stripFrontmatter } from '@inkeep/open-knowledge-core';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { bindTestUiLock } from './preview-url-test-helpers.ts';
import type { ServerInstance } from './shared.ts';
import { register } from './write-document.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: true;
}

interface RegisteredTool {
  name: string;
  handler: (args: {
    docName?: string;
    markdown?: string;
    template?: string;
    position?: 'append' | 'prepend' | 'replace';
    docs?: Array<{
      docName: string;
      markdown?: string;
      template?: string;
      position?: 'append' | 'prepend' | 'replace';
    }>;
  }) => Promise<ToolResult>;
}

function createFakeServer() {
  let registeredTool: RegisteredTool | undefined;
  const server = {
    registerTool(name: string, _config: unknown, handler: RegisteredTool['handler']) {
      registeredTool = { name, handler };
    },
  } as unknown as ServerInstance;
  return {
    server,
    getTool(): RegisteredTool {
      if (!registeredTool) throw new Error('Tool was not registered');
      return registeredTool;
    },
  };
}

let testServer: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let mockSubscriberCount: number | undefined = 1;
let mockSystemSubscriberCount: number | undefined = 1;
let lastWriteRequest: Record<string, unknown> | undefined;
let mockErrorEnvelope: { status: number; body: Record<string, unknown> } | undefined;
let mockWarning: Record<string, unknown> | undefined;

beforeAll(() => {
  testServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/api/agent-write-md') {
        lastWriteRequest = (await req.json()) as Record<string, unknown>;
        if (mockErrorEnvelope) {
          return Response.json(mockErrorEnvelope.body, { status: mockErrorEnvelope.status });
        }
        return Response.json({
          ok: true,
          timestamp: '2026-04-15T00:00:00.000Z',
          ...(mockSubscriberCount !== undefined ? { subscriberCount: mockSubscriberCount } : {}),
          ...(mockSystemSubscriberCount !== undefined
            ? { systemSubscriberCount: mockSystemSubscriberCount }
            : {}),
          ...(mockWarning !== undefined ? { warning: mockWarning } : {}),
        });
      }
      return new Response('Not found', { status: 404 });
    },
  });
  baseUrl = `http://localhost:${testServer.port}`;
});

afterAll(() => {
  testServer.stop();
});

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(resolve(tmpdir(), 'ok-write-doc-'));
  mockSubscriberCount = 1;
  mockSystemSubscriberCount = 1;
  lastWriteRequest = undefined;
  mockErrorEnvelope = undefined;
  mockWarning = undefined;
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeDeps() {
  return {
    serverUrl: baseUrl,
    config: BASE_CONFIG,
    resolveCwd: async () => tmpDir,
  };
}

describe('write_document — previewUrl emission', () => {
  test('emits route-only previewUrl + source when resolver resolves', async () => {
    bindTestUiLock(tmpDir);
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent).toMatchObject({
      previewUrl: '/#/docs/test',
      previewUrlSource: 'lock',
    });
    expect(result.content[0]?.text).toContain('Written successfully (append)');
  });

  test('omits structuredContent when nothing resolves AND subscribers>0', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'hello',
      position: 'replace',
    });

    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0]?.text).toBe('Written successfully (replace).');
  });

  test('emits attach-preview-once hint with previewUrl + autoOpen=true (default) when systemSubscriberCount=0', async () => {
    bindTestUiLock(tmpDir);
    mockSubscriberCount = 0;
    mockSystemSubscriberCount = 0;
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent).toMatchObject({
      previewUrl: '/#/docs/test',
      previewUrlSource: 'lock',
      warning: {
        action: 'attach-preview-once',
        message:
          'No browser is attached to the preview. Open it with preview_start, or call get_preview_url for the URL.',
        previewUrl: '/#/docs/test',
        autoOpen: true,
      },
    });
  });

  test('emits start-ui hint with null previewUrl + autoOpen=true (default) when systemSubscriberCount=0 and no resolver', async () => {
    mockSubscriberCount = 0;
    mockSystemSubscriberCount = 0;
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent).toMatchObject({
      warning: {
        action: 'start-ui',
        previewUrl: null,
        autoOpen: true,
      },
    });
    const warning = (result.structuredContent as { warning: { message: string } }).warning;
    expect(warning.message).toContain('ok ui');
    expect(warning.message).toContain('preview_start');
    expect(warning.message).toContain('OK Electron');
    expect(result.structuredContent).not.toHaveProperty('previewUrl');
  });

  test('no warning when systemSubscriberCount>0 even if per-doc subscriberCount=0 (second doc, server-push follows)', async () => {
    mockSubscriberCount = 0;
    mockSystemSubscriberCount = 1;
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/second',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent?.warning).toBeUndefined();
    expect(result.content[0]?.text).not.toContain('No preview attached');
  });

  test('no warning when server omits systemSubscriberCount (legacy server)', async () => {
    mockSubscriberCount = undefined;
    mockSystemSubscriberCount = undefined;
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0]?.text).toBe('Written successfully (append).');
  });

  test('strips .md extension before building the preview route', async () => {
    bindTestUiLock(tmpDir);
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/test.md',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent).toMatchObject({
      previewUrl: '/#/docs/test',
      previewUrlSource: 'lock',
    });
  });
});

describe('write_document — autoOpen field on PreviewAttachWarning', () => {
  test('attach-preview-once warning carries autoOpen=false when user disabled it', async () => {
    bindTestUiLock(tmpDir);
    mockSubscriberCount = 0;
    mockSystemSubscriberCount = 0;
    const { server, getTool } = createFakeServer();
    const config = ConfigSchema.parse({ appearance: { preview: { autoOpen: false } } });
    register(server, {
      serverUrl: baseUrl,
      config,
      resolveCwd: async () => tmpDir,
    });

    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent).toMatchObject({
      warning: {
        action: 'attach-preview-once',
        previewUrl: '/#/docs/test',
        autoOpen: false,
      },
    });
  });

  test('start-ui warning carries autoOpen=false when user disabled it', async () => {
    mockSubscriberCount = 0;
    mockSystemSubscriberCount = 0;
    const { server, getTool } = createFakeServer();
    const config = ConfigSchema.parse({ appearance: { preview: { autoOpen: false } } });
    register(server, {
      serverUrl: baseUrl,
      config,
      resolveCwd: async () => tmpDir,
    });

    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'hello',
      position: 'append',
    });

    expect(result.structuredContent).toMatchObject({
      warning: {
        action: 'start-ui',
        previewUrl: null,
        autoOpen: false,
      },
    });
  });

  test('reads autoOpen fresh per call (resolver invoked each time — mid-session toggle propagates)', async () => {
    mockSubscriberCount = 0;
    mockSystemSubscriberCount = 0;
    bindTestUiLock(tmpDir);

    let currentAutoOpen = true;
    const configResolver = async () =>
      ConfigSchema.parse({ appearance: { preview: { autoOpen: currentAutoOpen } } });

    const { server, getTool } = createFakeServer();
    register(server, {
      serverUrl: baseUrl,
      config: configResolver,
      resolveCwd: async () => tmpDir,
    });

    const first = await getTool().handler({
      docName: 'docs/test',
      markdown: 'a',
      position: 'append',
    });
    expect((first.structuredContent as { warning: { autoOpen: boolean } }).warning.autoOpen).toBe(
      true,
    );

    currentAutoOpen = false;

    const second = await getTool().handler({
      docName: 'docs/test',
      markdown: 'b',
      position: 'append',
    });
    expect((second.structuredContent as { warning: { autoOpen: boolean } }).warning.autoOpen).toBe(
      false,
    );
  });

  test('batch path: warning carries autoOpen=false when user disabled it', async () => {
    bindTestUiLock(tmpDir);
    mockSubscriberCount = 0;
    mockSystemSubscriberCount = 0;
    const { server, getTool } = createFakeServer();
    const config = ConfigSchema.parse({ appearance: { preview: { autoOpen: false } } });
    register(server, {
      serverUrl: baseUrl,
      config,
      resolveCwd: async () => tmpDir,
    });

    const result = await getTool().handler({
      docs: [{ docName: 'docs/test', markdown: 'hello', position: 'append' }],
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.structuredContent).toMatchObject({
      warning: {
        action: 'attach-preview-once',
        previewUrl: '/#/docs/test',
        autoOpen: false,
      },
    });
  });
});

describe('write_document — template instantiation (FR5)', () => {
  test('instantiates from a local template — markdown payload is template body', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(resolve(tmpDir, 'meetings', '.ok', 'templates'), { recursive: true });
    const templateContent =
      '---\ntitle: Meeting Prep\ndescription: Use before a meeting.\ntags: [meeting, prep]\n---\n# {Meeting Title}\n\n**Attendees:** \n';
    await writeFile(
      resolve(tmpDir, 'meetings', '.ok', 'templates', 'prep-notes.md'),
      templateContent,
    );

    const fakeServer = createFakeServer();
    register(fakeServer.server, makeDeps());

    const result = await fakeServer.getTool().handler({
      docName: 'meetings/2026-05-01-foo',
      template: 'prep-notes',
      position: 'replace',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest).toBeDefined();
    expect(lastWriteRequest?.markdown).toBe(stripFrontmatter(templateContent).body);
    expect(lastWriteRequest?.position).toBe('replace');
    expect(lastWriteRequest?.docName).toBe('meetings/2026-05-01-foo');
  });

  test('inherits template from ancestor folder (walk-up)', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(resolve(tmpDir, 'meetings', '.ok', 'templates'), { recursive: true });
    const templateContent = '---\ntitle: Inherited\n---\nbody\n';
    await writeFile(resolve(tmpDir, 'meetings', '.ok', 'templates', 'shared.md'), templateContent);

    const fakeServer = createFakeServer();
    register(fakeServer.server, makeDeps());

    const result = await fakeServer.getTool().handler({
      docName: 'meetings/prep-notes/foo',
      template: 'shared',
      position: 'replace',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.markdown).toBe(stripFrontmatter(templateContent).body);
  });

  test('rejects unknown template name with helpful menu', async () => {
    const fakeServer = createFakeServer();
    register(fakeServer.server, makeDeps());

    const result = await fakeServer.getTool().handler({
      docName: 'meetings/foo',
      template: 'nonexistent',
      position: 'replace',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('not found');
    expect(lastWriteRequest).toBeUndefined();
  });

  test('rejects descendant-scoped template at parent folder', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(resolve(tmpDir, 'meetings', 'prep-notes', '.ok', 'templates'), {
      recursive: true,
    });
    await writeFile(
      resolve(tmpDir, 'meetings', 'prep-notes', '.ok', 'templates', 'agenda.md'),
      '---\ntitle: Agenda\n---\nb\n',
    );

    const fakeServer = createFakeServer();
    register(fakeServer.server, makeDeps());

    const result = await fakeServer.getTool().handler({
      docName: 'meetings/foo',
      template: 'agenda',
      position: 'replace',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('not found');
  });

  test('without template arg, behavior unchanged (markdown passes through)', async () => {
    const fakeServer = createFakeServer();
    register(fakeServer.server, makeDeps());

    const result = await fakeServer.getTool().handler({
      docName: 'foo',
      markdown: 'plain content',
      position: 'append',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.markdown).toBe('plain content');
    expect(lastWriteRequest?.position).toBe('append');
  });

  test('strips the template frontmatter so it does not leak into the new doc', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(resolve(tmpDir, 'meetings', '.ok', 'templates'), { recursive: true });
    await writeFile(
      resolve(tmpDir, 'meetings', '.ok', 'templates', 'dossier.md'),
      '---\ntitle: Dossier template\ntags: [tpl]\n---\n## Summary\n\nbody\n',
    );

    const fakeServer = createFakeServer();
    register(fakeServer.server, makeDeps());

    const result = await fakeServer.getTool().handler({
      docName: 'meetings/new-dossier',
      template: 'dossier',
      position: 'replace',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.markdown).not.toContain('title: Dossier template');
    expect(lastWriteRequest?.markdown).not.toContain('tags:');
    expect(lastWriteRequest?.markdown).toContain('## Summary');
  });
});

describe('write_document — content-divergence relay', () => {
  test('single-doc: relays the server warning as structuredContent.contentDivergence + a text line', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    mockWarning = {
      kind: 'content-divergence',
      intendedBytes: 18,
      actualBytes: 25,
      byteDelta: 7,
      divergenceType: 'replace-content-mismatch',
      currentState: { kind: 'inline', content: 'what actually landed\n' },
      hint: 'currentState carries the converged content.',
    };

    const result = await getTool().handler({
      docName: 'notes',
      markdown: 'hello',
      position: 'replace',
    });

    expect(result.structuredContent?.contentDivergence).toMatchObject({
      kind: 'content-divergence',
      byteDelta: 7,
      divergenceType: 'replace-content-mismatch',
      currentState: { kind: 'inline', content: 'what actually landed\n' },
    });
    expect(result.content[0]?.text).toContain('⚠ Content divergence');
  });

  test('batch: surfaces per-doc contentDivergence from the r.raw.warning path', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    mockWarning = {
      kind: 'content-divergence',
      intendedBytes: 10,
      actualBytes: 14,
      byteDelta: 4,
      divergenceType: 'append-content-mismatch',
      currentState: { kind: 'inline', content: 'batch landed\n' },
      hint: 'currentState carries the converged content.',
    };

    const result = await getTool().handler({
      docs: [{ docName: 'docs/test', markdown: 'hello', position: 'append' }],
    } as Parameters<RegisteredTool['handler']>[0]);

    const s = result.structuredContent as {
      documents: Array<{ docName: string; contentDivergence?: Record<string, unknown> }>;
    };
    expect(s.documents[0]?.contentDivergence).toMatchObject({
      kind: 'content-divergence',
      byteDelta: 4,
      divergenceType: 'append-content-mismatch',
    });
  });

  test('drops a malformed server warning at the safeParse boundary (single-doc)', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    mockWarning = {
      kind: 'content-divergence',
      intendedBytes: 18,
      actualBytes: 25,
      byteDelta: 'seven',
    };

    const result = await getTool().handler({
      docName: 'notes',
      markdown: 'hello',
      position: 'replace',
    });

    expect(result.structuredContent?.contentDivergence).toBeUndefined();
  });
});

describe('write_document — batch (docs)', () => {
  test('writes each doc in the batch and reports per-doc results', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docs: [
        { docName: 'a', markdown: 'A', position: 'replace' },
        { docName: 'notes/b', markdown: 'B', position: 'append' },
      ],
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    const s = result.structuredContent as {
      ok: boolean;
      documents: Array<{ docName: string; ok: boolean }>;
    };
    expect(s.ok).toBe(true);
    expect(s.documents.map((d) => d.docName)).toEqual(['a', 'notes/b']);
    expect(s.documents.every((d) => d.ok)).toBe(true);
    expect(result.content[0]?.text).toContain('2/2 written');
  });

  test('a per-doc failure surfaces without blocking the rest', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docs: [
        { docName: 'good', markdown: 'ok', position: 'replace' },
        { docName: 'bad', markdown: 'x', template: 'y', position: 'replace' },
      ],
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBe(true);
    const s = result.structuredContent as {
      ok: boolean;
      documents: Array<{ docName: string; ok: boolean; error?: string }>;
    };
    expect(s.ok).toBe(false);
    expect(s.documents.find((d) => d.docName === 'good')?.ok).toBe(true);
    expect(s.documents.find((d) => d.docName === 'bad')?.error).toContain('mutually exclusive');
  });

  test('docs together with a top-level single-doc field is rejected', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'x',
      markdown: 'y',
      position: 'replace',
      docs: [{ docName: 'a', markdown: 'A', position: 'replace' }],
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('batch form');
  });

  test('batch entries default omitted position to replace (new) or fail (existing)', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'already-here.md'), '# Existing\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docs: [
        { docName: 'brand-new', markdown: 'A' },
        { docName: 'already-here', markdown: 'B' },
      ],
    } as Parameters<RegisteredTool['handler']>[0]);

    const s = result.structuredContent as {
      ok: boolean;
      documents: Array<{ docName: string; ok: boolean; position?: string; error?: string }>;
    };
    expect(s.ok).toBe(false);
    const fresh = s.documents.find((d) => d.docName === 'brand-new');
    const existing = s.documents.find((d) => d.docName === 'already-here');
    expect(fresh?.ok).toBe(true);
    expect(fresh?.position).toBe('replace');
    expect(existing?.ok).toBe(false);
    expect(existing?.error).toContain('already exists');
  });
});

describe('write_document — prepend/append frontmatter warning (PRD-6660)', () => {
  test('warns when a prepend payload carries a frontmatter block', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: '---\ntags: [test]\n---\n\nbody',
      position: 'prepend',
    });
    expect(result.content[0]?.text).toContain(
      'frontmatter block in this `prepend` payload was ignored',
    );
    expect(result.content[0]?.text).toContain('edit_frontmatter');
  });

  test('no warning for a plain-text prepend (no frontmatter)', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: 'just body text',
      position: 'prepend',
    });
    expect(result.content[0]?.text).not.toContain('was ignored');
  });

  test('no warning for replace with frontmatter — replace writes it', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: '---\ntags: [test]\n---\n\nbody',
      position: 'replace',
    });
    expect(result.content[0]?.text).not.toContain('was ignored');
  });

  test('warns when an append payload carries a frontmatter block', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    const result = await getTool().handler({
      docName: 'docs/test',
      markdown: '---\ntags: [test]\n---\n\nbody',
      position: 'append',
    });
    expect(result.content[0]?.text).toContain(
      'frontmatter block in this `append` payload was ignored',
    );
  });

  test('warns per-doc in a batch when a spec prepends frontmatter', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());
    const result = await getTool().handler({
      docs: [
        { docName: 'docs/plain', markdown: 'body', position: 'append' },
        { docName: 'docs/fm', markdown: '---\ntags: [test]\n---\n\nbody', position: 'prepend' },
      ],
    });
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('docs/fm — Note:');
    expect(text).toContain('was ignored');
    expect(text).not.toContain('docs/plain — Note:');
  });
});

describe('write_document — position defaulting', () => {
  test('a new doc defaults position to replace when omitted', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'fresh-doc',
      markdown: 'hello',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.position).toBe('replace');
    expect(result.content[0]?.text).toBe('Written successfully (replace).');
  });

  test('an existing doc requires an explicit position', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'existing-doc.md'), '# Existing\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'existing-doc',
      markdown: 'new body',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('already exists');
    expect(lastWriteRequest).toBeUndefined();
  });

  test('existing-doc guard anchors on contentDir, not the project root', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(resolve(tmpDir, 'docs'), { recursive: true });
    await writeFile(resolve(tmpDir, 'docs', 'existing-doc.md'), '# Existing\n');

    const config = ConfigSchema.parse({ content: { dir: 'docs' } });
    const { server, getTool } = createFakeServer();
    register(server, { serverUrl: baseUrl, config, resolveCwd: async () => tmpDir });

    const result = await getTool().handler({
      docName: 'existing-doc',
      markdown: 'new body',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('already exists');
    expect(lastWriteRequest).toBeUndefined();
  });

  test('a template instantiation defaults position to replace when omitted', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(resolve(tmpDir, 'meetings', '.ok', 'templates'), { recursive: true });
    await writeFile(
      resolve(tmpDir, 'meetings', '.ok', 'templates', 'prep-notes.md'),
      '---\ntitle: Prep\n---\nbody\n',
    );

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'meetings/2026-05-21-sync',
      template: 'prep-notes',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.position).toBe('replace');
  });

  test('template instantiation onto an existing doc still requires an explicit position', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(resolve(tmpDir, 'meetings', '.ok', 'templates'), { recursive: true });
    await writeFile(
      resolve(tmpDir, 'meetings', '.ok', 'templates', 'prep-notes.md'),
      '---\ntitle: Prep\n---\nbody\n',
    );
    await writeFile(resolve(tmpDir, 'meetings', 'standup.md'), '# Existing standup\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'meetings/standup',
      template: 'prep-notes',
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('already exists');
    expect(lastWriteRequest).toBeUndefined();
  });
});

describe('write_document — empty / whitespace content (PRD-6835)', () => {
  for (const empty of ['', ' ', '\n', '  \n ']) {
    test(`new doc + whitespace-only markdown ${JSON.stringify(empty)} is rejected before POST`, async () => {
      const { server, getTool } = createFakeServer();
      register(server, makeDeps());

      const result = await getTool().handler({
        docName: 'brand-new',
        markdown: empty,
        position: 'replace',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('does not exist and the content is empty');
      expect(lastWriteRequest).toBeUndefined();
    });
  }

  test('new-doc empty rejection fires for any position (explicit append does not skip the existence check)', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'brand-new',
      markdown: '',
      position: 'append',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('does not exist and the content is empty');
    expect(lastWriteRequest).toBeUndefined();
  });

  test('new doc + frontmatter-only payload is NOT rejected (it creates a real doc)', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'fresh-fm',
      markdown: '---\ntitle: New\n---',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.markdown).toBe('---\ntitle: New\n---');
  });

  test('clearing an EXISTING doc with empty markdown + replace is allowed (posts empty body)', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'existing.md'), '---\ntitle: Keep\n---\n# Body\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'existing',
      markdown: '',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.markdown).toBe('');
    expect(lastWriteRequest?.position).toBe('replace');
  });

  test('empty append on an existing doc reports "document unchanged" (not "Written successfully")', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'existing.md'), '# Existing\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'existing',
      markdown: '',
      position: 'append',
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('No content to append — document unchanged');
    expect(text).not.toContain('Written successfully');
  });

  test('empty prepend on an existing doc reports "document unchanged"', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'existing.md'), '# Existing\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'existing',
      markdown: '',
      position: 'prepend',
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('No content to prepend — document unchanged');
    expect(text).not.toContain('Written successfully');
  });

  test('a server validation error surfaces the field-level detail, not just the title', async () => {
    mockErrorEnvelope = {
      status: 400,
      body: {
        type: 'urn:ok:error:invalid-request',
        title: 'Request body is invalid.',
        status: 400,
        detail: 'summary: String must contain at most 80 character(s)',
      },
    };

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'docs/will-fail',
      markdown: 'hello',
      position: 'replace',
    });

    expect(result.isError).toBe(true);
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('Request body is invalid.');
    expect(text).toContain('summary: String must contain at most 80 character(s)');
  });
});

describe('write_document — explicit .mdx extension (PRD-6836)', () => {
  test('a new doc with a .mdx docName forwards extension: ".mdx" to the write API', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'guides/widget.mdx',
      markdown: '# Widget\n',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.extension).toBe('.mdx');
    expect(lastWriteRequest?.docName).toBe('guides/widget');
  });

  test('a new doc with a .md docName forwards extension: ".md" (explicit, matches default)', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'guides/widget.md',
      markdown: '# Widget\n',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.extension).toBe('.md');
  });

  test('a doubled .md.md docName fully normalizes — keys the bare name, lands a single .md file (PRD-6837 #2)', async () => {
    bindTestUiLock(tmpDir);
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'guides/widget.md.md',
      markdown: '# Widget\n',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.docName).toBe('guides/widget');
    expect(lastWriteRequest?.extension).toBe('.md');
    expect(result.structuredContent).toMatchObject({ previewUrl: '/#/guides/widget' });
  });

  test('an extension-less docName forwards no extension hint', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'guides/widget',
      markdown: '# Widget\n',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest).toBeDefined();
    expect(lastWriteRequest).not.toHaveProperty('extension');
  });

  test('a .mdx request against a doc that already exists as .md omits the hint and surfaces a note', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'widget.md'), '# Existing\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'widget.mdx',
      markdown: '# New body\n',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest).not.toHaveProperty('extension');
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('already exists as `widget.md`');
    expect(text).toContain('was not applied');
    expect(text).not.toContain('rename(');
  });

  test('no rename note when the requested suffix matches the on-disk extension', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'widget.mdx'), '# Existing\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docName: 'widget.mdx',
      markdown: '# New body\n',
      position: 'replace',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text ?? '').not.toContain('was not applied');
  });

  test('batch: a .mdx request against an existing .md doc surfaces a per-doc rename note', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(resolve(tmpDir, 'widget.md'), '# Existing\n');

    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docs: [{ docName: 'widget.mdx', markdown: '# New\n', position: 'replace' }],
    } as Parameters<RegisteredTool['handler']>[0]);

    const text = result.content[0]?.text ?? '';
    expect(text).toContain('widget.mdx — Note:');
    expect(text).toContain('already exists as `widget.md`');
  });

  test('batch: a new doc with a .mdx docName forwards extension: ".mdx" on the wire', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps());

    const result = await getTool().handler({
      docs: [{ docName: 'batch/widget.mdx', markdown: '# Widget\n', position: 'replace' }],
    } as Parameters<RegisteredTool['handler']>[0]);

    expect(result.isError).toBeUndefined();
    expect(lastWriteRequest?.extension).toBe('.mdx');
    expect(lastWriteRequest?.docName).toBe('batch/widget');
  });
});
