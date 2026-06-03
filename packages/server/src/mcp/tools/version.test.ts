import {
  describe as _bunDescribe,
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { bindTestUiLock } from './preview-url-test-helpers.ts';
import type { ServerInstance } from './shared.ts';
import { HOCUSPOCUS_NOT_RUNNING_ERROR } from './shared.ts';
import { DESCRIPTION, register, type VersionDeps } from './version.ts';

const describe = process.env.CI ? _bunDescribe.skip : _bunDescribe;

const BASE_CONFIG: Config = ConfigSchema.parse({});
const SHA = '0123456789abcdef0123456789abcdef01234567';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface VersionHandlerArgs {
  action: 'save' | 'rollback';
  docName?: string;
  commitSha?: string;
  summary?: string;
}

interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: VersionHandlerArgs) => Promise<ToolResult>;
}

function createFakeServer() {
  let registered: RegisteredTool | undefined;
  const server = {
    registerTool(
      name: string,
      cfg: { description?: string; inputSchema?: Record<string, unknown> },
      handler: (args: VersionHandlerArgs) => Promise<ToolResult>,
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

function makeDeps(serverUrl: string | undefined, cwdDir: string): VersionDeps {
  return {
    serverUrl,
    config: BASE_CONFIG,
    resolveCwd: async () => cwdDir,
  };
}

let testServer: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let tmpDir: string;
const seenRequests: string[] = [];
const seenBodies: Array<Record<string, unknown>> = [];
let mockRollbackWarning: Record<string, unknown> | undefined;

beforeAll(() => {
  testServer = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const body = req.method === 'POST' ? ((await req.json()) as Record<string, unknown>) : {};
      seenRequests.push(`${req.method} ${url.pathname}`);
      if (req.method === 'POST') seenBodies.push(body);

      if (url.pathname === '/api/save-version' && req.method === 'POST') {
        return Response.json({
          ok: true,
          checkpointRef: 'refs/checkpoints/2026-05-20-deadbeef',
        });
      }
      if (url.pathname.startsWith('/api/history/') && req.method === 'GET') {
        return Response.json({
          ok: true,
          author: 'Alice',
          timestamp: '2026-05-20T00:00:00Z',
        });
      }
      if (url.pathname === '/api/rollback' && req.method === 'POST') {
        const summary = body.summary;
        const summaryShape =
          summary === undefined ? undefined : { value: String(summary), hint: 'summary recorded' };
        return Response.json({
          ok: true,
          ...(summaryShape ? { summary: summaryShape } : {}),
          ...(mockRollbackWarning !== undefined ? { warning: mockRollbackWarning } : {}),
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
  tmpDir = await mkdtemp(resolve(tmpdir(), 'ok-version-test-'));
  seenRequests.length = 0;
  seenBodies.length = 0;
  mockRollbackWarning = undefined;
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('version — registration + DESCRIPTION', () => {
  test('registers exactly one tool named "version"', () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    expect(getTool().name).toBe('version');
  });

  test('DESCRIPTION enumerates both actions and their semantics', () => {
    expect(DESCRIPTION).toContain('action: "save"');
    expect(DESCRIPTION).toContain('action: "rollback"');
    expect(DESCRIPTION).toContain('docName');
    expect(DESCRIPTION).toContain('commitSha');
    expect(DESCRIPTION).toContain('get_history');
  });

  test('returns Hocuspocus-unavailable error when no serverUrl is configured', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(undefined, tmpDir));
    const result = await getTool().handler({ action: 'save' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(HOCUSPOCUS_NOT_RUNNING_ERROR);
  });
});

describe('version — action=save (project-wide checkpoint)', () => {
  test('hits POST /api/save-version with no doc parameter and returns checkpointRef + null previewUrl', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));

    const result = await getTool().handler({ action: 'save' });

    expect(seenRequests).toContain('POST /api/save-version');
    expect(result.structuredContent).toMatchObject({
      checkpointRef: 'refs/checkpoints/2026-05-20-deadbeef',
      previewUrl: null,
    });
    expect(result.content[0]?.text).toContain('Checkpoint saved');
  });

  test('save body is empty when no identity is provided', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    await getTool().handler({ action: 'save' });
    expect(seenBodies[0]).toEqual({});
  });

  test('save body includes writers array when identity is provided', async () => {
    const { server, getTool } = createFakeServer();
    register(server, {
      ...makeDeps(baseUrl, tmpDir),
      identityRef: {
        current: {
          connectionId: 'conn-42',
          displayName: 'Agent 42',
          colorSeed: 'seed-0',
          clientInfo: { name: 'claude', version: '1.0.0' },
        },
      },
    });
    await getTool().handler({ action: 'save' });
    expect(seenBodies[0]).toEqual({
      writers: [
        {
          id: 'agent-conn-42',
          name: 'Agent 42',
          email: 'agent-conn-42@openknowledge.local',
        },
      ],
    });
  });
});

describe('version — action=rollback (per-doc restore)', () => {
  test('verifies version exists, posts rollback, returns route-only previewUrl on resolved doc', async () => {
    bindTestUiLock(tmpDir);
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));

    const result = await getTool().handler({
      action: 'rollback',
      docName: 'notes',
      commitSha: SHA,
    });

    expect(seenRequests).toContain(`GET /api/history/${SHA}`);
    expect(seenRequests).toContain('POST /api/rollback');
    expect(result.structuredContent).toMatchObject({
      previewUrl: '/#/notes',
      previewUrlSource: 'lock',
    });
    expect(result.content[0]?.text).toContain('Restored "notes"');
    expect(result.content[0]?.text).toContain('01234567');
  });

  test('relays a rollback content-divergence warning as structuredContent.contentDivergence + a text line', async () => {
    bindTestUiLock(tmpDir);
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    mockRollbackWarning = {
      kind: 'content-divergence',
      intendedBytes: 40,
      actualBytes: 33,
      byteDelta: -7,
      divergenceType: 'rollback-content-mismatch',
      currentState: { kind: 'inline', content: 'restored body bytes\n' },
      hint: 'currentState carries the converged content.',
    };

    const result = await getTool().handler({
      action: 'rollback',
      docName: 'notes',
      commitSha: SHA,
    });

    expect(result.structuredContent?.contentDivergence).toMatchObject({
      kind: 'content-divergence',
      byteDelta: -7,
      divergenceType: 'rollback-content-mismatch',
      currentState: { kind: 'inline', content: 'restored body bytes\n' },
    });
    expect(result.content[0]?.text).toContain('⚠ Content divergence');
  });

  test('drops a malformed rollback warning at the safeParse boundary', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    mockRollbackWarning = {
      kind: 'content-divergence',
      intendedBytes: 40,
      actualBytes: 33,
      byteDelta: 'minus seven',
    };

    const result = await getTool().handler({
      action: 'rollback',
      docName: 'notes',
      commitSha: SHA,
    });

    expect(result.structuredContent?.contentDivergence).toBeUndefined();
    expect(result.content[0]?.text).not.toContain('⚠ Content divergence');
  });

  test('normalizes trailing .md from docName before history + rollback requests', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));

    await getTool().handler({
      action: 'rollback',
      docName: 'notes.md',
      commitSha: SHA,
    });

    expect(seenBodies[0]).toMatchObject({ docName: 'notes', commitSha: SHA });
  });

  test('rejects missing docName at the handler level', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));

    const result = await getTool().handler({ action: 'rollback', commitSha: SHA });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('action=rollback requires `docName`');
  });

  test('rejects missing commitSha at the handler level', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));

    const result = await getTool().handler({ action: 'rollback', docName: 'notes' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('action=rollback requires `commitSha`');
  });

  test('passes summary through to /api/rollback and surfaces server summary hint in result text', async () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));

    const result = await getTool().handler({
      action: 'rollback',
      docName: 'notes',
      commitSha: SHA,
      summary: 'undo Friday merge',
    });

    expect(seenBodies[0]?.summary).toBe('undo Friday merge');
    expect(result.content[0]?.text).toContain('summary recorded');
    expect(result.structuredContent?.summary).toMatchObject({ value: 'undo Friday merge' });
  });

  test('rollback body includes identity attribution when identityRef is provided', async () => {
    const { server, getTool } = createFakeServer();
    register(server, {
      ...makeDeps(baseUrl, tmpDir),
      identityRef: {
        current: {
          connectionId: 'conn-7',
          displayName: 'Cody',
          colorSeed: 'seed-12',
          clientInfo: { name: 'claude', version: '1.0.0' },
        },
      },
    });

    await getTool().handler({
      action: 'rollback',
      docName: 'notes',
      commitSha: SHA,
    });

    expect(seenBodies[0]).toMatchObject({
      docName: 'notes',
      commitSha: SHA,
      agentId: 'conn-7',
      agentName: 'Cody',
      clientName: 'claude',
      colorSeed: 'seed-12',
    });
  });

  test('commitSha schema rejects malformed values and accepts a 40-hex SHA', () => {
    const { server, getTool } = createFakeServer();
    register(server, makeDeps(baseUrl, tmpDir));
    const commitSha = getTool().schema.commitSha as {
      safeParse: (value: unknown) => { success: boolean };
    };
    expect(commitSha.safeParse('abc123').success).toBe(false); // too short
    expect(commitSha.safeParse('z'.repeat(40)).success).toBe(false); // non-hex
    expect(commitSha.safeParse(`${SHA}00`).success).toBe(false); // too long
    expect(commitSha.safeParse(SHA).success).toBe(true); // valid 40-hex
  });
});
