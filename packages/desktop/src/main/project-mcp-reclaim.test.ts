import { describe, expect, test } from 'bun:test';
import {
  buildManagedServerEntry,
  type EditorMcpTarget,
  type McpEntryClassification,
} from '@inkeep/open-knowledge';
import type { McpWiringEditorId } from '../shared/ipc-channels.ts';
import {
  checkAndRepairProjectMcpOnProjectOpen,
  type ProjectMcpReclaimCliSurface,
} from './project-mcp-reclaim.ts';

const EXE = '/Applications/OpenKnowledge.app/Contents/MacOS/OpenKnowledge';
const CHAIN_ENTRY = buildManagedServerEntry({ mode: 'published' });

function fakeTarget(id: McpWiringEditorId, projectConfigPath?: string): EditorMcpTarget {
  return {
    id,
    label: id,
    format: 'json',
    topLevelKey: 'mcpServers',
    serverName: () => 'open-knowledge',
    configPath: () => `/home/${id}/config.json`,
    buildEntry: () => CHAIN_ENTRY,
    scope: 'global',
    ...(projectConfigPath ? { projectConfigPath: () => projectConfigPath } : {}),
  };
}

function buildCli(
  perEditor: Record<
    string,
    {
      target: EditorMcpTarget;
      classification?: McpEntryClassification;
      readThrows?: Error;
      writeOutcome?: { action: 'overwritten' | 'failed'; error?: string };
    }
  >,
): { cli: ProjectMcpReclaimCliSurface; writes: string[] } {
  const writes: string[] = [];
  const allEditorIds = Object.keys(perEditor) as McpWiringEditorId[];
  const editorTargets: Record<McpWiringEditorId, EditorMcpTarget> = {} as Record<
    McpWiringEditorId,
    EditorMcpTarget
  >;
  for (const id of allEditorIds) {
    editorTargets[id] = perEditor[id]?.target as EditorMcpTarget;
  }
  return {
    cli: {
      editorTargets,
      allEditorIds,
      classifyExistingProjectMcpConfig: (editorId) => {
        const entry = perEditor[editorId];
        if (entry?.readThrows) throw entry.readThrows;
        return entry?.classification ?? { kind: 'absent' };
      },
      writeProjectMcpConfig: ({ editorId }) => {
        writes.push(editorId);
        return perEditor[editorId]?.writeOutcome ?? { action: 'overwritten' };
      },
    },
    writes,
  };
}

describe('checkAndRepairProjectMcpOnProjectOpen', () => {
  test('skipped on non-darwin', async () => {
    const { cli } = buildCli({});
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'linux',
      cli,
    });
    expect(r.status).toBe('skipped');
    if (r.status === 'skipped') expect(r.reason).toBe('platform');
  });

  test('skipped when reclaim disabled', async () => {
    const { cli } = buildCli({});
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
      reclaimDisableEnv: '1',
    });
    expect(r.status).toBe('skipped');
  });

  test('editors without projectConfigPath report unsupported', async () => {
    const { cli, writes } = buildCli({
      'claude-desktop': { target: fakeTarget('claude-desktop' as McpWiringEditorId) },
    });
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      expect(r.perEditor[0]?.status).toBe('unsupported');
    }
    expect(writes).toEqual([]);
  });

  test('absent file → no-token (no write, no create)', async () => {
    const { cli, writes } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: { kind: 'absent' },
      },
    });
    const events: Array<Record<string, unknown>> = [];
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
      logger: { event: (e) => events.push(e) },
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') expect(r.perEditor[0]?.status).toBe('no-token');
    expect(writes).toEqual([]);
    expect(events.some((e) => e.event === 'project-mcp-reclaim-no-token')).toBe(true);
  });

  test('valid file with no entry → no-token (do not author into unrelated tool file)', async () => {
    const { cli, writes } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: { kind: 'no-entry' },
      },
    });
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') expect(r.perEditor[0]?.status).toBe('no-token');
    expect(writes).toEqual([]);
  });

  test('compatible entry → healthy-current, no write', async () => {
    const { cli, writes } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: { kind: 'present', entry: CHAIN_ENTRY },
      },
    });
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') expect(r.perEditor[0]?.status).toBe('healthy-current');
    expect(writes).toEqual([]);
  });

  test('incompatible entry → reclaimed (write occurs, no rename)', async () => {
    const { cli, writes } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: {
          kind: 'present',
          entry: { command: 'npx', args: ['-y', '@inkeep/open-knowledge', 'mcp'] },
        },
      },
    });
    const renames: Array<{ oldPath: string; newPath: string }> = [];
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
      backupFs: { renameSync: (o, n) => renames.push({ oldPath: o, newPath: n }) },
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') expect(r.perEditor[0]?.status).toBe('reclaimed');
    expect(writes).toEqual(['claude']);
    expect(renames).toEqual([]);
  });

  test('incompatible entry emits mcp-config-migrate before the write', async () => {
    const order: string[] = [];
    const target = fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json');
    const baseCli: ProjectMcpReclaimCliSurface = {
      editorTargets: { claude: target } as Record<McpWiringEditorId, EditorMcpTarget>,
      allEditorIds: ['claude' as McpWiringEditorId],
      classifyExistingProjectMcpConfig: () => ({
        kind: 'present',
        entry: { command: 'npx', args: ['-y', '@inkeep/open-knowledge', 'mcp'] },
      }),
      writeProjectMcpConfig: () => {
        order.push('write');
        return { action: 'overwritten' };
      },
    };
    const events: Array<Record<string, unknown>> = [];
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli: baseCli,
      logger: {
        event: (e) => {
          if (e.event === 'mcp-config-migrate') order.push('migrate-event');
          events.push(e);
        },
      },
    });
    expect(r.status).toBe('done');
    expect(order).toEqual(['migrate-event', 'write']);
    const migrate = events.find((e) => e.event === 'mcp-config-migrate');
    expect(migrate).toMatchObject({
      event: 'mcp-config-migrate',
      scope: 'project',
      surface: 'desktop-project-open',
      editorId: 'claude',
      configPath: '/p/.mcp.json',
      priorCommand: 'npx',
      priorArgs: ['-y', '@inkeep/open-knowledge', 'mcp'],
    });
  });

  test('corrupt file → renamed to .broken-<iso> sidecar then fresh write', async () => {
    const { cli, writes } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: { kind: 'corrupt', error: 'file is empty' },
      },
    });
    const renames: Array<{ oldPath: string; newPath: string }> = [];
    const events: Array<Record<string, unknown>> = [];
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
      backupFs: { renameSync: (o, n) => renames.push({ oldPath: o, newPath: n }) },
      now: () => new Date('2026-05-19T20:00:00.000Z'),
      logger: { event: (e) => events.push(e) },
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      const e = r.perEditor[0];
      expect(e?.status).toBe('reclaimed-from-corrupt');
      if (e?.status === 'reclaimed-from-corrupt') {
        expect(e.backupPath).toBe('/p/.mcp.json.broken-2026-05-19T20-00-00-000Z');
      }
    }
    expect(renames).toEqual([
      { oldPath: '/p/.mcp.json', newPath: '/p/.mcp.json.broken-2026-05-19T20-00-00-000Z' },
    ]);
    expect(writes).toEqual(['claude']);
    expect(events.some((e) => e.event === 'project-mcp-reclaim-corrupt-backup')).toBe(true);
    expect(events.some((e) => e.event === 'project-mcp-reclaim-reclaimed-from-corrupt')).toBe(true);
  });

  test('corrupt file with backup rename failure → failed, no write attempted', async () => {
    const { cli, writes } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: { kind: 'corrupt', error: 'invalid JSON' },
      },
    });
    const events: Array<Record<string, unknown>> = [];
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
      backupFs: {
        renameSync: () => {
          throw new Error('EROFS: read-only filesystem');
        },
      },
      logger: { event: (e) => events.push(e) },
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      const e = r.perEditor[0];
      expect(e?.status).toBe('failed');
      if (e?.status === 'failed') expect(e.error).toContain('EROFS');
    }
    expect(writes).toEqual([]);
    expect(events.some((e) => e.event === 'project-mcp-reclaim-backup-failed')).toBe(true);
  });

  test('write failure surfaces as failed entry', async () => {
    const { cli } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: { kind: 'present', entry: { command: 'old' } },
        writeOutcome: { action: 'failed', error: 'EACCES' },
      },
    });
    const events: Array<Record<string, unknown>> = [];
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
      logger: { event: (e) => events.push(e) },
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      const e = r.perEditor[0];
      expect(e?.status).toBe('failed');
      if (e?.status === 'failed') expect(e.error).toBe('EACCES');
    }
    expect(events.some((e) => e.event === 'project-mcp-reclaim-write-failed')).toBe(true);
  });

  test('one editor failing does not block others', async () => {
    const { cli, writes } = buildCli({
      claude: {
        target: fakeTarget('claude' as McpWiringEditorId, '/p/.mcp.json'),
        classification: { kind: 'present', entry: { command: 'old' } },
        writeOutcome: { action: 'failed', error: 'EACCES' },
      },
      cursor: {
        target: fakeTarget('cursor' as McpWiringEditorId, '/p/.cursor/mcp.json'),
        classification: { kind: 'present', entry: { command: 'old' } },
        writeOutcome: { action: 'overwritten' },
      },
    });
    const r = await checkAndRepairProjectMcpOnProjectOpen({
      projectDir: '/p',
      executablePath: EXE,
      isPackaged: true,
      platform: 'darwin',
      cli,
    });
    expect(r.status).toBe('done');
    if (r.status === 'done') {
      expect(r.perEditor.find((e) => e.editor === 'claude')?.status).toBe('failed');
      expect(r.perEditor.find((e) => e.editor === 'cursor')?.status).toBe('reclaimed');
    }
    expect(writes).toEqual(['claude', 'cursor']);
  });
});
