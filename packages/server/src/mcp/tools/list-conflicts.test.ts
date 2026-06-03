import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { register } from './list-conflicts.ts';
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
  tmpDir = await mkdtemp(resolve(tmpdir(), 'ok-list-conflicts-'));
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

describe('list_conflicts MCP tool', () => {
  test('returns empty conflicts array when none are tracked', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, conflicts: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'list_conflicts');
    const result = await tool.handler({});

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ conflicts: [] });
    expect(result.content[0]?.text).toContain('No conflicts tracked');
  });

  test('returns populated conflicts with full entry shape', async () => {
    const { server, registrations } = createCapturingServer();
    const seeded = [
      {
        file: 'notes/alpha.md',
        detectedAt: '2026-05-19T10:00:00.000Z',
        oursSha: 'aaa111',
        theirsSha: 'bbb222',
        baseSha: 'ccc333',
      },
      {
        file: 'docs/beta.md',
        detectedAt: '2026-05-19T11:30:00.000Z',
      },
    ];
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, conflicts: seeded }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'list_conflicts');
    const result = await tool.handler({});

    expect(result.isError).toBeUndefined();
    const sc = result.structuredContent as { conflicts: Array<Record<string, unknown>> };
    expect(sc.conflicts).toHaveLength(2);
    expect(sc.conflicts[0]).toMatchObject({
      file: 'notes/alpha.md',
      oursSha: 'aaa111',
      theirsSha: 'bbb222',
      baseSha: 'ccc333',
    });
    expect(sc.conflicts[1]).toMatchObject({
      file: 'docs/beta.md',
    });
    expect(result.content[0]?.text).toContain('notes/alpha.md');
    expect(result.content[0]?.text).toContain('docs/beta.md');
  });

  test('surfaces HTTP error to the agent', async () => {
    const { server, registrations } = createCapturingServer();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, error: 'Sync engine not active.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    register(server, makeDeps('http://localhost:4321'));
    const tool = getTool(registrations, 'list_conflicts');
    const result = await tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Sync engine not active');
  });

  test('uses the shared Hocuspocus-not-running error when no server URL is available', async () => {
    const { server, registrations } = createCapturingServer();
    register(server, makeDeps(undefined));
    const tool = getTool(registrations, 'list_conflicts');
    const result = await tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe(HOCUSPOCUS_NOT_RUNNING_ERROR);
  });
});
