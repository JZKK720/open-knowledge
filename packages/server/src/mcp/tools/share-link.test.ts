import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { register, type ShareLinkDeps } from './share-link.ts';
import type { ServerInstance } from './shared.ts';
import { HOCUSPOCUS_NOT_RUNNING_ERROR } from './shared.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface RegisteredTool {
  name: string;
  description: string;
  handler: (args: { docName: string; cwd?: string }) => Promise<ToolResult>;
}

function createFakeServer() {
  let registered: RegisteredTool | undefined;
  const server = {
    registerTool(name: string, cfg: { description?: string }, handler: RegisteredTool['handler']) {
      registered = { name, description: cfg.description ?? '', handler };
    },
  } as unknown as ServerInstance;
  return {
    server,
    getTool(): RegisteredTool {
      if (!registered) throw new Error('share_link was not registered');
      return registered;
    },
  };
}

let testServer: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let tmpDir: string;
const seenRequests: Array<{ pathname: string; body: Record<string, unknown> }> = [];
let mockResponse: { status: number; body: Record<string, unknown> } = {
  status: 200,
  body: {},
};
let mockRawResponse: Response | null = null;

beforeAll(() => {
  testServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const body = req.method === 'POST' ? ((await req.json()) as Record<string, unknown>) : {};
      seenRequests.push({ pathname: url.pathname, body });
      if (url.pathname === '/api/share/construct-url') {
        if (mockRawResponse) return mockRawResponse.clone();
        return new Response(JSON.stringify(mockResponse.body), {
          status: mockResponse.status,
          headers: { 'Content-Type': 'application/json' },
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
  tmpDir = await mkdtemp(resolve(tmpdir(), 'ok-share-link-test-'));
  await mkdir(resolve(tmpDir, '.ok'), { recursive: true });
  seenRequests.length = 0;
  mockResponse = { status: 200, body: {} };
  mockRawResponse = null;
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeDeps(serverUrl: string | undefined): ShareLinkDeps {
  return {
    serverUrl,
    config: BASE_CONFIG,
    resolveCwd: async () => tmpDir,
  };
}

describe('share_link — registration + preconditions', () => {
  test('registers a single tool named `share_link`', () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    expect(getTool().name).toBe('share_link');
  });

  test('description states publishing is not agent-initiated', () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    expect(getTool().description).toContain('Publishing is a user act');
  });

  test('errors when Hocuspocus URL is unset', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(undefined));
    await writeFile(resolve(tmpDir, 'notes.md'), '# notes');
    const result = await getTool().handler({ docName: 'notes' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(HOCUSPOCUS_NOT_RUNNING_ERROR);
  });
});

describe('share_link — doc resolution', () => {
  test('returns doc-not-found when neither `.md` nor `.mdx` exists', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'missing' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: 'doc-not-found' });
    expect(result.content[0]?.text).toContain('does not exist');
    expect(seenRequests).toHaveLength(0);
  });

  test('strips trailing `.md` from docName before probing', async () => {
    await writeFile(resolve(tmpDir, 'notes.md'), '# notes');
    mockResponse = {
      status: 200,
      body: {
        ok: true,
        shareUrl: 'https://openknowledge.ai/d/abc',
        blobUrl: 'https://github.com/o/r/blob/main/notes.md',
        branch: 'main',
      },
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'notes.md' });
    expect(result.isError).toBeUndefined();
    expect(seenRequests[0]?.body).toEqual({ docPath: 'notes.md' });
  });

  test('probes `.mdx` when `.md` is absent', async () => {
    await writeFile(resolve(tmpDir, 'guide.mdx'), '# guide');
    mockResponse = {
      status: 200,
      body: {
        ok: true,
        shareUrl: 'https://openknowledge.ai/d/xyz',
        blobUrl: 'https://github.com/o/r/blob/main/guide.mdx',
        branch: 'main',
      },
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'guide' });
    expect(result.isError).toBeUndefined();
    expect(seenRequests[0]?.body).toEqual({ docPath: 'guide.mdx' });
  });

  test('`.mdx` wins over `.md` when both exist (matches SUPPORTED_DOC_EXTENSIONS precedence)', async () => {
    await writeFile(resolve(tmpDir, 'collide.md'), '# md');
    await writeFile(resolve(tmpDir, 'collide.mdx'), '# mdx');
    mockResponse = {
      status: 200,
      body: {
        ok: true,
        shareUrl: 'https://openknowledge.ai/d/collide',
        blobUrl: 'https://github.com/o/r/blob/main/collide.mdx',
        branch: 'main',
      },
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'collide' });
    expect(result.isError).toBeUndefined();
    expect(seenRequests[0]?.body).toEqual({ docPath: 'collide.mdx' });
  });

  test('rejects paths escaping the content root', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: '../escaped' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('invalid');
    expect(seenRequests).toHaveLength(0);
  });
});

describe('share_link — happy path', () => {
  test('returns shareUrl + branch + blobUrl on success', async () => {
    await writeFile(resolve(tmpDir, 'meeting.md'), '# meeting');
    mockResponse = {
      status: 200,
      body: {
        ok: true,
        shareUrl: 'https://openknowledge.ai/d/encoded',
        blobUrl: 'https://github.com/inkeep/wiki/blob/main/meeting.md',
        branch: 'main',
      },
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'meeting' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      ok: true,
      shareUrl: 'https://openknowledge.ai/d/encoded',
      blobUrl: 'https://github.com/inkeep/wiki/blob/main/meeting.md',
      branch: 'main',
    });
    expect(result.content[0]?.text).toContain('https://openknowledge.ai/d/encoded');
    expect(result.content[0]?.text).toContain('main');
  });
});

describe('share_link — business-logic errors', () => {
  test('no-remote: directs user at publishing, does NOT run it', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockResponse = { status: 200, body: { ok: false, error: 'no-remote' } };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: 'no-remote' });
    const message = (result.structuredContent as { message: string }).message;
    expect(message).toContain('no GitHub remote');
    expect(message).toContain('push');
    expect(message).toContain('Agents do not publish');
  });

  test('detached-head: tells the user to check out a branch', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockResponse = { status: 200, body: { ok: false, error: 'detached-head' } };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: 'detached-head' });
    expect((result.structuredContent as { message: string }).message).toContain('detached');
  });

  test('branch-not-on-origin: names the branch and asks for a push', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockResponse = {
      status: 200,
      body: { ok: false, error: 'branch-not-on-origin', branch: 'feat/share' },
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      error: 'branch-not-on-origin',
      branch: 'feat/share',
    });
    const message = (result.structuredContent as { message: string }).message;
    expect(message).toContain('feat/share');
    expect(message).toContain('git push');
  });

  test('non-github-remote: explains GitHub-only constraint', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockResponse = { status: 200, body: { ok: false, error: 'non-github-remote' } };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: 'non-github-remote' });
    expect((result.structuredContent as { message: string }).message).toContain('GitHub');
  });

  test('invalid-path: closed-enum coverage for the remaining business-error variant', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockResponse = { status: 200, body: { ok: false, error: 'invalid-path' } };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: 'invalid-path' });
    expect((result.structuredContent as { message: string }).message).toContain('not shareable');
  });

  test('branch-not-on-origin: message carries the stale-fetch recovery hint', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockResponse = {
      status: 200,
      body: { ok: false, error: 'branch-not-on-origin', branch: 'feat/share' },
    };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    const message = (result.structuredContent as { message: string }).message;
    expect(message).toContain('git fetch origin');
  });

  test('transport error: surfaces a tool-level error when the server is down', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    const { server, getTool } = createFakeServer();
    register(server, makeDeps('http://127.0.0.1:1')); // unreachable
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { ok: boolean }).ok).toBe(false);
  });
});

describe('share_link — transport / protocol error paths', () => {
  test('non-JSON 200 body: tool-level error mentions the parse failure', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockRawResponse = new Response('<html>not json</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: 'unknown' });
    expect(result.content[0]?.text).toMatch(/non-JSON/i);
  });

  test('non-2xx with RFC 9457 body: forwards both `title` and `detail`', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockRawResponse = new Response(
      JSON.stringify({
        type: 'urn:ok:error:internal-server-error',
        title: 'Internal server error',
        detail: 'origin lookup failed: ENETUNREACH',
        status: 500,
      }),
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
    );
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Internal server error');
    expect(result.content[0]?.text).toContain('ENETUNREACH');
  });

  test('non-2xx with title-only RFC 9457: forwards title without `:` separator', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockRawResponse = new Response(
      JSON.stringify({
        type: 'urn:ok:error:internal-server-error',
        title: 'Internal server error',
        status: 500,
      }),
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
    );
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Internal server error');
    expect(result.content[0]?.text).not.toContain('Internal server error:');
    expect(result.content[0]?.text).not.toContain('HTTP 500');
  });

  test('non-2xx with detail-only RFC 9457: forwards detail (title-less)', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockRawResponse = new Response(
      JSON.stringify({
        type: 'urn:ok:error:internal-server-error',
        detail: 'origin lookup failed: ENETUNREACH',
        status: 500,
      }),
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
    );
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('ENETUNREACH');
    expect(result.content[0]?.text).not.toContain('HTTP 500');
  });

  test('non-2xx without title/detail: falls back to bare HTTP status', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockRawResponse = new Response(JSON.stringify({ msg: 'down' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('HTTP 503');
  });

  test('200 with unexpected JSON shape: Zod parse failure → tool-level error', async () => {
    await writeFile(resolve(tmpDir, 'page.md'), '# page');
    mockResponse = { status: 200, body: { unexpected: 'shape', no_ok_field: true } };
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl));
    const result = await getTool().handler({ docName: 'page' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ ok: false, error: 'unknown' });
    expect(result.content[0]?.text).toContain('unexpected share-construct-url response shape');
  });
});
