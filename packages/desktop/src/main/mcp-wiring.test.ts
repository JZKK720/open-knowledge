import { describe, expect, test } from 'bun:test';
import {
  buildManagedServerEntry,
  type EditorMcpTarget,
  type McpEntryClassification,
} from '@inkeep/open-knowledge';
import type { McpWiringEditorId } from '../shared/ipc-channels.ts';
import {
  checkAndRepairMcpWiringOnStartup,
  type McpStatusMarker,
  type McpWiringCliSurface,
  type McpWiringFsOps,
  readMcpStatusMarker,
  writeMcpStatusMarker,
} from './mcp-wiring.ts';

function memoryFs(
  initial: Record<string, string> = {},
): McpWiringFsOps & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    existsSync: (path) => Object.hasOwn(files, path),
    readFileSync: (path) => files[path] ?? '',
    writeFileSync: (path, content) => {
      files[path] = content;
    },
    mkdirSync: () => {},
    renameSync: (from, to) => {
      files[to] = files[from] ?? '';
      delete files[from];
    },
    unlinkSync: (path) => {
      delete files[path];
    },
  };
}

const PACKAGED_EXE = '/Applications/Open Knowledge.app/Contents/MacOS/Open Knowledge';

function fakeTarget(id: McpWiringEditorId): EditorMcpTarget {
  return {
    id,
    label: id,
    format: 'json',
    topLevelKey: 'mcpServers',
    serverName: () => 'open-knowledge',
    configPath: (_cwd, home) => `${home}/.config-for-${id}.json`,
    buildEntry: () => buildManagedServerEntry({ mode: 'published' }),
    scope: 'global',
  };
}

interface BuildStartupCliOptions {
  classify: McpEntryClassification;
  writeOutcome?: 'written' | 'overwritten' | 'failed';
  writeError?: string;
}

function buildStartupCli(opts: BuildStartupCliOptions): {
  cli: McpWiringCliSurface;
  events: Array<Record<string, unknown>>;
  order: string[];
} {
  const events: Array<Record<string, unknown>> = [];
  const order: string[] = [];
  const target = fakeTarget('claude' as McpWiringEditorId);
  const cli: McpWiringCliSurface = {
    detectInstalledEditors: () => ['claude' as McpWiringEditorId],
    classifyExistingMcpEntry: () => opts.classify,
    readExistingMcpEntry: () => (opts.classify.kind === 'present' ? opts.classify.entry : null),
    allEditorIds: ['claude' as McpWiringEditorId],
    editorTargets: { claude: target } as Record<McpWiringEditorId, EditorMcpTarget>,
    writeUserMcpConfigs: async ({ editors }) => {
      order.push('write');
      return editors.map((editorId) => ({
        editorId,
        label: editorId,
        action: opts.writeOutcome ?? 'overwritten',
        configPath: target.configPath('', '/home'),
        serverName: 'open-knowledge',
        ...(opts.writeError ? { error: opts.writeError } : {}),
      }));
    },
  };
  return { cli, events, order };
}

describe('checkAndRepairMcpWiringOnStartup — migrate event ordering', () => {
  test('legacy entry → mcp-config-migrate fires before the write', async () => {
    const { cli, events, order } = buildStartupCli({
      classify: {
        kind: 'present',
        entry: { command: 'npx', args: ['-y', '@inkeep/open-knowledge', 'mcp'] },
      },
    });
    const result = await checkAndRepairMcpWiringOnStartup({
      isPackaged: true,
      executablePath: PACKAGED_EXE,
      home: '/home',
      platform: 'darwin',
      ipcMain: { handle() {}, removeHandler() {} } as unknown as Parameters<
        typeof checkAndRepairMcpWiringOnStartup
      >[0]['ipcMain'],
      cli,
      logger: {
        info() {},
        warn() {},
        error() {},
        event: (e) => {
          if (e.event === 'mcp-config-migrate') order.push('migrate-event');
          events.push(e);
        },
      },
    });
    expect(result.status).toBe('repaired');
    expect(order).toEqual(['migrate-event', 'write']);
    const migrate = events.find((e) => e.event === 'mcp-config-migrate');
    expect(migrate).toMatchObject({
      event: 'mcp-config-migrate',
      scope: 'user',
      surface: 'desktop-startup',
      editorId: 'claude',
      configPath: '/home/.config-for-claude.json',
      priorCommand: 'npx',
      priorArgs: ['-y', '@inkeep/open-knowledge', 'mcp'],
    });
  });

  test('canonical chain entry → no migrate event, no write', async () => {
    const { cli, events, order } = buildStartupCli({
      classify: {
        kind: 'present',
        entry: buildManagedServerEntry({ mode: 'published' }),
      },
    });
    const result = await checkAndRepairMcpWiringOnStartup({
      isPackaged: true,
      executablePath: PACKAGED_EXE,
      home: '/home',
      platform: 'darwin',
      ipcMain: { handle() {}, removeHandler() {} } as unknown as Parameters<
        typeof checkAndRepairMcpWiringOnStartup
      >[0]['ipcMain'],
      cli,
      logger: {
        info() {},
        warn() {},
        error() {},
        event: (e) => events.push(e),
      },
    });
    expect(result.status).toBe('ok');
    expect(order).toEqual([]);
    expect(events.some((e) => e.event === 'mcp-config-migrate')).toBe(false);
  });
});

describe('MCP status marker', () => {
  test('writes confirmed marker without cliPath', () => {
    const fs = memoryFs();
    const marker: McpStatusMarker = {
      configured: true,
      configuredAt: '2026-05-26T00:00:00.000Z',
      editors: ['claude'],
    };
    writeMcpStatusMarker('/home/alice', marker, fs);
    expect(JSON.parse(fs.files['/home/alice/.ok/mcp-status.json'])).toEqual(marker);
  });

  test('reader accepts legacy confirmed marker carrying cliPath', () => {
    const fs = memoryFs({
      '/home/alice/.ok/mcp-status.json': JSON.stringify({
        configured: true,
        configuredAt: '2026-05-26T00:00:00.000Z',
        editors: [],
        cliPath: '/old/path',
      }),
    });
    expect(readMcpStatusMarker('/home/alice', fs)).toEqual({
      configured: true,
      configuredAt: '2026-05-26T00:00:00.000Z',
      editors: [],
      cliPath: '/old/path',
    });
  });
});
