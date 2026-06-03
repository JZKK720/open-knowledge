import {
  describe as _bunDescribe,
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { bindTestUiLock } from './preview-url-test-helpers.ts';
import { DESCRIPTION, type RenameDeps, register } from './rename.ts';
import type { ServerInstance } from './shared.ts';
import { HOCUSPOCUS_NOT_RUNNING_ERROR } from './shared.ts';

const describe = process.env.CI ? _bunDescribe.skip : _bunDescribe;

const BASE_CONFIG: Config = ConfigSchema.parse({});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface RenameHandlerArgs {
  from: string;
  to: string;
  summary?: string;
}

interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: RenameHandlerArgs) => Promise<ToolResult>;
}

function createFakeServer() {
  let registered: RegisteredTool | undefined;
  const server = {
    registerTool(
      name: string,
      cfg: { description?: string; inputSchema?: Record<string, unknown> },
      handler: (args: RenameHandlerArgs) => Promise<ToolResult>,
    ) {
      registered = {
        name,
        description: cfg.description ?? '',
        schema: cfg.inputSchema ?? {},
        handler,
      };
    },
  } as unknown as ServerInstance;
  return {
    server,
    getTool(): RegisteredTool {
      if (!registered) throw new Error('Tool was not registered');
      return registered;
    },
  };
}

function makeDeps(serverUrl: string | undefined, cwdDir: string): RenameDeps {
  return {
    serverUrl,
    config: BASE_CONFIG,
    resolveCwd: async () => cwdDir,
  };
}

let testServer: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let tmpDir: string;
const seenRequests: Array<{ method: string; pathname: string; body: Record<string, unknown> }> = [];
let mockServerResponse: Record<string, unknown> = {};

beforeAll(() => {
  testServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const body =
        req.method === 'POST'
          ? ((await req.json()) as Record<string, unknown>)
          : ({} as Record<string, unknown>);
      seenRequests.push({ method: req.method, pathname: url.pathname, body });

      if (url.pathname === '/api/rename-path' && req.method === 'POST') {
        if (mockServerResponse.error) {
          return Response.json({ ok: false, ...mockServerResponse }, { status: 409 });
        }
        const summary = body.summary as string | undefined;
        const summaryShape =
          summary !== undefined ? { value: summary, hint: 'summary recorded' } : undefined;
        return Response.json({
          ok: true,
          renamed: mockServerResponse.renamed ?? [],
          renamedAssets: mockServerResponse.renamedAssets ?? [],
          rewrittenDocs: mockServerResponse.rewrittenDocs ?? [],
          ...(summaryShape ? { summary: summaryShape } : {}),
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

beforeEach(async () => {
  tmpDir = await mkdtemp(resolve(tmpdir(), 'ok-rename-test-'));
  await mkdir(resolve(tmpdir(), tmpDir, '.ok'), { recursive: true });
  seenRequests.length = 0;
  mockServerResponse = {};
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('rename — registration + DESCRIPTION', () => {
  test('registers exactly one tool named "rename"', () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    expect(getTool().name).toBe('rename');
  });

  test('DESCRIPTION explains both kinds and the file/folder probe behavior', () => {
    expect(DESCRIPTION).toContain('doc');
    expect(DESCRIPTION).toContain('folder');
    expect(DESCRIPTION).toContain('previewUrl');
    expect(DESCRIPTION).toContain('previewUrls');
    expect(DESCRIPTION).toContain('colliding');
  });

  test('returns Hocuspocus-unavailable error when no serverUrl is configured', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(undefined, tmpDir));
    const result = await getTool().handler({ from: 'a', to: 'b' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(HOCUSPOCUS_NOT_RUNNING_ERROR);
  });
});

describe('rename — resolveRenameKind dispatch', () => {
  test('non-existent `from` returns a tool-level error', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'ghost', to: 'phantom' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('does not exist as a doc or folder');
    expect(seenRequests).toHaveLength(0);
  });
});

describe('rename — file branch', () => {
  test('resolves `.md` file → POSTs kind:file with normalized docNames', async () => {
    await writeFile(resolve(tmpDir, 'notes.md'), '# notes');
    mockServerResponse = {
      renamed: [{ fromDocName: 'notes', toDocName: 'thoughts' }],
      rewrittenDocs: [],
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'notes.md', to: 'thoughts.md' });

    expect(result.isError).toBeUndefined();
    expect(seenRequests[0]?.body).toMatchObject({
      kind: 'file',
      fromPath: 'notes',
      toPath: 'thoughts',
    });
    const structured = result.structuredContent as { kind: string; previewUrl: string | null };
    expect(structured.kind).toBe('file');
    expect(structured.previewUrl).toBeNull();
  });

  test('emits route-only previewUrl + previousPreviewUrl when UI lock is bound', async () => {
    await writeFile(resolve(tmpDir, 'old.md'), '# old');
    bindTestUiLock(tmpDir);
    mockServerResponse = {
      renamed: [{ fromDocName: 'old', toDocName: 'new' }],
      rewrittenDocs: [{ docName: 'sibling', rewrites: 2 }],
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'old', to: 'new' });

    const structured = result.structuredContent as {
      previewUrl: string;
      previousPreviewUrl: string;
      rewrittenDocs: Array<{ docName: string; rewrites: number }>;
    };
    expect(structured.previewUrl).toBe('/#/new');
    expect(structured.previousPreviewUrl).toBe('/#/old');
    expect(structured.rewrittenDocs).toHaveLength(1);
  });

  test('threads identity passthrough into the rename body', async () => {
    await writeFile(resolve(tmpDir, 'foo.md'), '# foo');
    mockServerResponse = { renamed: [], rewrittenDocs: [] };
    const { server, getTool } = createFakeServer();
    register(server, {
      ...makeDeps(baseUrl, tmpDir),
      identityRef: {
        current: {
          connectionId: 'conn-7',
          displayName: 'Cody',
          colorSeed: 'seed-7',
          clientInfo: { name: 'claude', version: '1.0.0' },
        },
      },
    });
    await getTool().handler({ from: 'foo', to: 'bar', summary: 'Aligned naming' });

    expect(seenRequests[0]?.body).toMatchObject({
      kind: 'file',
      agentId: 'conn-7',
      agentName: 'Cody',
      colorSeed: 'seed-7',
      summary: 'Aligned naming',
    });
  });

  test('surfaces 409 collision via structured `colliding` field', async () => {
    await writeFile(resolve(tmpDir, 'src.md'), '# src');
    mockServerResponse = {
      error: 'destination exists',
      colliding: [{ existing: 'dest', incoming: 'src', to: 'dest' }],
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'src', to: 'dest' });

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      ok: boolean;
      colliding: Array<{ existing: string; incoming: string; to: string }>;
    };
    expect(structured.ok).toBe(false);
    expect(structured.colliding).toEqual([{ existing: 'dest', incoming: 'src', to: 'dest' }]);
  });
});

describe('rename — folder branch', () => {
  test('resolves directory → POSTs kind:folder with raw folder paths', async () => {
    await mkdir(resolve(tmpDir, 'notes'), { recursive: true });
    await writeFile(resolve(tmpDir, 'notes', 'a.md'), '# a');
    mockServerResponse = {
      renamed: [{ fromDocName: 'notes/a', toDocName: 'essays/a' }],
      rewrittenDocs: [{ docName: 'index', rewrites: 1 }],
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'notes', to: 'essays' });

    expect(result.isError).toBeUndefined();
    expect(seenRequests[0]?.body).toMatchObject({
      kind: 'folder',
      fromPath: 'notes',
      toPath: 'essays',
    });
    const structured = result.structuredContent as {
      kind: string;
      previewUrls: Record<string, string>;
    };
    expect(structured.kind).toBe('folder');
    expect(structured.previewUrls).toEqual({});
  });

  test('emits route-only previewUrls map for every renamed doc when UI lock is bound', async () => {
    await mkdir(resolve(tmpDir, 'notes'), { recursive: true });
    await writeFile(resolve(tmpDir, 'notes', 'a.md'), '# a');
    bindTestUiLock(tmpDir);
    mockServerResponse = {
      renamed: [
        { fromDocName: 'notes/a', toDocName: 'essays/a' },
        { fromDocName: 'notes/b', toDocName: 'essays/b' },
      ],
      rewrittenDocs: [],
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'notes', to: 'essays' });

    const structured = result.structuredContent as {
      previewUrls: Record<string, string>;
      previewUrlSource: string;
    };
    expect(structured.previewUrls['essays/a']).toBe('/#/essays/a');
    expect(structured.previewUrls['essays/b']).toBe('/#/essays/b');
    expect(structured.previewUrlSource).toBe('lock');
  });

  test('rejects folder path with leading/trailing slash', async () => {
    await mkdir(resolve(tmpDir, 'notes'), { recursive: true });
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'notes', to: '/essays' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('relative path');
  });

  test('rejects folder path with `..`', async () => {
    await mkdir(resolve(tmpDir, 'notes'), { recursive: true });
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'notes', to: '../escape' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('relative path');
  });

  test('passes summary through to the rename body', async () => {
    await mkdir(resolve(tmpDir, 'notes'), { recursive: true });
    mockServerResponse = { renamed: [], rewrittenDocs: [] };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    await getTool().handler({ from: 'notes', to: 'essays', summary: 'Reorganized layout' });

    expect(seenRequests[0]?.body).toMatchObject({
      kind: 'folder',
      summary: 'Reorganized layout',
    });
  });

  test('emits an empty-folder message when no docs were renamed', async () => {
    await mkdir(resolve(tmpDir, 'notes'), { recursive: true });
    mockServerResponse = { renamed: [], rewrittenDocs: [] };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const result = await getTool().handler({ from: 'notes', to: 'essays' });

    expect(result.content[0]?.text).toContain('No managed docs under notes/');
  });
});
