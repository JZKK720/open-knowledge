import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { register } from './get-conflict-content.ts';
import { HOCUSPOCUS_NOT_RUNNING_ERROR, type ServerInstance } from './shared.ts';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface RegisteredTool {
  name: string;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

function createCapturingServer() {
  const registrations: RegisteredTool[] = [];
  const server = {
    registerTool(name: string, _cfg: unknown, handler: RegisteredTool['handler']) {
      registrations.push({ name, handler });
    },
  } as unknown as ServerInstance;
  return { server, registrations };
}

function getTool(registrations: RegisteredTool[], name: string): RegisteredTool {
  const tool = registrations.find((r) => r.name === name);
  expect(tool).toBeDefined();
  return tool as RegisteredTool;
}

const originalFetch = globalThis.fetch;
let tmpDir: string;
const BASE_CONFIG: Config = ConfigSchema.parse({});

beforeEach(async () => {
  tmpDir = await mkdtemp(resolve(tmpdir(), 'ok-get-conflict-content-'));
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await rm(tmpDir, { recursive: true, force: true });
});

function makeDeps(serverUrl: string | undefined) {
  return {
    serverUrl,
    config: BASE_CONFIG,
    resolveCwd: async () => tmpDir,
  };
}

describe('get_conflict_content MCP tool', () => {
  test('always passes ?source=ytext and forwards `file` verbatim (with .md)', async () => {
    const { server, registrations } = createCapturingServer();
    const fetchCalls: Array<{ input: RequestInfo | URL }> = [];

    globalThis.fetch = (async (input) => {
      fetchCalls.push({ input });
      return new Response(
        JSON.stringify({
          ok: true,
          file: 'notes/sso.md',
          base: 'baseBytes',
          ours: 'oursBytes',
          theirs: 'theirsBytes',
          lifecycleStatus: 'conflict',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'notes/sso.md' });

    expect(fetchCalls).toHaveLength(1);
    const url = String(fetchCalls[0]?.input ?? '');
    expect(url).toBe(
      'http://localhost:4321/api/sync/conflict-content?file=notes%2Fsso.md&source=ytext',
    );
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      file: 'notes/sso.md',
      base: 'baseBytes',
      ours: 'oursBytes',
      theirs: 'theirsBytes',
      lifecycleStatus: 'conflict',
    });
  });

  test('propagates the kind discriminator into structured + text output (both-modified)', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          file: 'a.md',
          base: 'b',
          ours: 'o',
          theirs: 't',
          kind: 'both-modified',
          lifecycleStatus: 'conflict',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'a.md' });

    expect(result.structuredContent).toMatchObject({ kind: 'both-modified' });
    expect(result.content[0]?.text).toContain('kind: both-modified');
  });

  test('propagates kind: delete-modify (DU) so agents know to dispatch strategy: delete', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          file: 'a.md',
          base: 'b',
          ours: '',
          theirs: 't',
          kind: 'delete-modify',
          lifecycleStatus: 'conflict',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'a.md' });

    expect(result.structuredContent).toMatchObject({ kind: 'delete-modify' });
    expect(result.content[0]?.text).toContain('kind: delete-modify');
  });

  test('propagates kind: modify-delete (UD) so agents know to dispatch strategy: delete', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          file: 'a.md',
          base: 'b',
          ours: 'o',
          theirs: '',
          kind: 'modify-delete',
          lifecycleStatus: 'conflict',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'a.md' });

    expect(result.structuredContent).toMatchObject({ kind: 'modify-delete' });
    expect(result.content[0]?.text).toContain('kind: modify-delete');
  });

  test('falls back to kind: both-modified when server omits the field (stale-server safety)', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          file: 'a.md',
          base: 'b',
          ours: 'o',
          theirs: 't',
          lifecycleStatus: 'conflict',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'a.md' });

    expect(result.structuredContent).toMatchObject({ kind: 'both-modified' });
  });

  test('returns lifecycleStatus: null when the server omits it (e.g. doc unloaded)', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          file: 'a.md',
          base: '',
          ours: 'fromGitIndex',
          theirs: '',
          lifecycleStatus: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'a.md' });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      file: 'a.md',
      ours: 'fromGitIndex',
      lifecycleStatus: null,
    });
  });

  test('surfaces 404 (or other HTTP error) to the agent', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          type: 'urn:ok:error:no-conflict-tracked',
          title: 'No conflict is tracked for this path.',
          status: 404,
        }),
        { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
      )) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'missing.md' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('No conflict is tracked');
  });

  test('concatenates RFC 9457 detail into the agent error when the server provides one', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          type: 'urn:ok:error:internal-server-error',
          title: 'Failed to read conflict content.',
          status: 500,
          detail: 'simple-git: fatal: ambiguous argument',
        }),
        { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
      )) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'a.md' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Failed to read conflict content.');
    expect(result.content[0]?.text).toContain('simple-git: fatal: ambiguous argument');
  });

  test('uses the shared Hocuspocus-not-running error when no server URL is available', async () => {
    const { server, registrations } = createCapturingServer();
    register(server, makeDeps(undefined));
    const tool = getTool(registrations, 'get_conflict_content');
    const result = await tool.handler({ file: 'a.md' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(HOCUSPOCUS_NOT_RUNNING_ERROR);
  });
});
