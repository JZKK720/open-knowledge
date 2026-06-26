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
  type McpWiringDispatchTarget,
  type McpWiringFsOps,
  readMcpStatusMarker,
  runMcpWiringOnFirstLaunch,
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

const PACKAGED_EXE = '/Applications/OpenKnowledge.app/Contents/MacOS/OpenKnowledge';

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

type WiringOpts = Parameters<typeof runMcpWiringOnFirstLaunch>[0];

function stubIpcMain(): WiringOpts['ipcMain'] & {
  handlers: Map<string, (...args: unknown[]) => unknown>;
} {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handlers,
    handle(channel: string, fn: (...args: unknown[]) => unknown) {
      handlers.set(channel, fn);
    },
    removeHandler(channel: string) {
      handlers.delete(channel);
    },
  } as unknown as WiringOpts['ipcMain'] & {
    handlers: Map<string, (...args: unknown[]) => unknown>;
  };
}

function fakeWebContents(
  id: number,
  opts: { failSend?: boolean } = {},
): McpWiringDispatchTarget & { sent: Array<{ channel: string; payload: unknown }> } {
  const sent: Array<{ channel: string; payload: unknown }> = [];
  return {
    id,
    sent,
    send(channel: string, payload?: unknown) {
      if (opts.failSend) throw new Error('WebContents was destroyed');
      sent.push({ channel, payload });
    },
  };
}

function buildFirstLaunchCli(): { cli: McpWiringCliSurface; writes: McpWiringEditorId[][] } {
  const target = fakeTarget('claude' as McpWiringEditorId);
  const writes: McpWiringEditorId[][] = [];
  const cli: McpWiringCliSurface = {
    detectInstalledEditors: () => ['claude' as McpWiringEditorId],
    classifyExistingMcpEntry: () => ({ kind: 'absent' }) as McpEntryClassification,
    readExistingMcpEntry: () => null,
    allEditorIds: ['claude' as McpWiringEditorId],
    editorTargets: { claude: target } as Record<McpWiringEditorId, EditorMcpTarget>,
    writeUserMcpConfigs: async ({ editors }) => {
      writes.push([...editors]);
      return editors.map((editorId) => ({
        editorId,
        label: editorId,
        action: 'written' as const,
        configPath: target.configPath('', '/home/u'),
        serverName: 'open-knowledge',
      }));
    },
  };
  return { cli, writes };
}

const SILENT_LOGGER = { info() {}, warn() {}, error() {}, event() {} };

function buildWiringOpts(overrides: Partial<WiringOpts> = {}): WiringOpts {
  const { cli } = buildFirstLaunchCli();
  return {
    isPackaged: true,
    executablePath: PACKAGED_EXE,
    home: '/home/u',
    platform: 'darwin',
    ipcMain: stubIpcMain(),
    cli,
    fs: memoryFs(),
    logger: SILENT_LOGGER,
    ...overrides,
  };
}

describe('runMcpWiringOnFirstLaunch — mid-session immediate dispatch', () => {
  test('show dispatches to the provided target and binds confirm to its sender', async () => {
    const ipcMain = stubIpcMain();
    const wc = fakeWebContents(11);
    const fs = memoryFs();
    const { cli, writes } = buildFirstLaunchCli();
    const handle = runMcpWiringOnFirstLaunch(
      buildWiringOpts({ ipcMain, cli, fs, immediateDispatchTarget: wc }),
    );

    expect(handle.armed).toBe(true);
    expect(wc.sent).toEqual([
      {
        channel: 'ok:mcp-wiring:show',
        payload: {
          detectedEditors: [{ id: 'claude', label: 'claude', detected: true, willReplace: false }],
        },
      },
    ]);
    expect(ipcMain.handlers.has('ok:mcp-wiring:renderer-ready')).toBe(false);

    const confirm = ipcMain.handlers.get('ok:mcp-wiring:confirm');
    expect(confirm).toBeDefined();
    const result = await confirm?.({ sender: { id: 11 } }, { editorIds: ['claude'] });
    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([['claude' as McpWiringEditorId]]);
    expect(readMcpStatusMarker('/home/u', fs)).toMatchObject({
      configured: true,
      editors: ['claude'],
    });
  });

  test('confirm from a window other than the dispatch target is rejected', async () => {
    const ipcMain = stubIpcMain();
    const wc = fakeWebContents(11);
    const { cli, writes } = buildFirstLaunchCli();
    runMcpWiringOnFirstLaunch(buildWiringOpts({ ipcMain, cli, immediateDispatchTarget: wc }));

    const confirm = ipcMain.handlers.get('ok:mcp-wiring:confirm');
    const result = (await confirm?.({ sender: { id: 99 } }, { editorIds: ['claude'] })) as {
      ok: boolean;
    };
    expect(result.ok).toBe(false);
    expect(writes).toEqual([]);
  });

  test('skip from the dispatch target writes the skip marker without touching configs', async () => {
    const ipcMain = stubIpcMain();
    const wc = fakeWebContents(11);
    const fs = memoryFs();
    const { cli, writes } = buildFirstLaunchCli();
    runMcpWiringOnFirstLaunch(
      buildWiringOpts({
        ipcMain,
        cli,
        fs,
        immediateDispatchTarget: wc,
        now: () => new Date('2026-06-10T00:00:00.000Z'),
      }),
    );

    const skip = ipcMain.handlers.get('ok:mcp-wiring:skip');
    expect(skip).toBeDefined();
    const result = await skip?.({ sender: { id: 11 } });
    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([]);
    expect(readMcpStatusMarker('/home/u', fs)).toEqual({
      configured: false,
      skippedAt: '2026-06-10T00:00:00.000Z',
    });
  });

  test('skip from a window other than the dispatch target is rejected', async () => {
    const ipcMain = stubIpcMain();
    const wc = fakeWebContents(11);
    const fs = memoryFs();
    runMcpWiringOnFirstLaunch(buildWiringOpts({ ipcMain, fs, immediateDispatchTarget: wc }));

    const skip = ipcMain.handlers.get('ok:mcp-wiring:skip');
    const result = (await skip?.({ sender: { id: 99 } })) as { ok: boolean };
    expect(result.ok).toBe(false);
    expect(readMcpStatusMarker('/home/u', fs)).toBeNull();
  });

  test('forceShow + immediate target re-fires the dialog over a prior skip marker', () => {
    const ipcMain = stubIpcMain();
    const wc = fakeWebContents(7);
    const fs = memoryFs({
      '/home/u/.ok/mcp-status.json': JSON.stringify({
        configured: false,
        skippedAt: '2026-05-26T00:00:00.000Z',
      }),
    });
    const handle = runMcpWiringOnFirstLaunch(
      buildWiringOpts({ ipcMain, fs, forceShow: true, immediateDispatchTarget: wc }),
    );
    expect(handle.armed).toBe(true);
    expect(wc.sent.map((s) => s.channel)).toEqual(['ok:mcp-wiring:show']);
    expect(ipcMain.handlers.has('ok:mcp-wiring:renderer-ready')).toBe(false);
  });

  test('failed immediate dispatch leaves the mount-ack fallback armed', async () => {
    const ipcMain = stubIpcMain();
    const broken = fakeWebContents(11, { failSend: true });
    const fs = memoryFs();
    const { cli, writes } = buildFirstLaunchCli();
    runMcpWiringOnFirstLaunch(
      buildWiringOpts({ ipcMain, cli, fs, immediateDispatchTarget: broken }),
    );

    const ready = ipcMain.handlers.get('ok:mcp-wiring:renderer-ready');
    expect(ready).toBeDefined();

    const wc2 = fakeWebContents(22);
    ready?.({ sender: wc2 });
    expect(wc2.sent.map((s) => s.channel)).toEqual(['ok:mcp-wiring:show']);
    expect(ipcMain.handlers.has('ok:mcp-wiring:renderer-ready')).toBe(false);

    const confirm = ipcMain.handlers.get('ok:mcp-wiring:confirm');
    const result = await confirm?.({ sender: { id: 22 } }, { editorIds: ['claude'] });
    expect(result).toEqual({ ok: true });
    expect(writes).toEqual([['claude' as McpWiringEditorId]]);
    expect(readMcpStatusMarker('/home/u', fs)).toMatchObject({
      configured: true,
      editors: ['claude'],
    });
  });

  test('no immediate target preserves the boot-path mount-ack behavior', () => {
    const ipcMain = stubIpcMain();
    runMcpWiringOnFirstLaunch(buildWiringOpts({ ipcMain }));

    expect(ipcMain.handlers.has('ok:mcp-wiring:renderer-ready')).toBe(true);
    const wc = fakeWebContents(5);
    ipcMain.handlers.get('ok:mcp-wiring:renderer-ready')?.({ sender: wc });
    expect(wc.sent.map((s) => s.channel)).toEqual(['ok:mcp-wiring:show']);
  });
});
