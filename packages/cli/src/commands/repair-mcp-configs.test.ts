import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildManagedServerEntry, resolveClaudeCodeConfigPath } from './editors.ts';
import { type RepairLogEvent, repairMcpConfigs } from './repair-mcp-configs.ts';

const CHAIN_ENTRY = buildManagedServerEntry({ mode: 'published' });
const LEGACY_BARE = { command: 'npx', args: ['@inkeep/open-knowledge', 'mcp'] };
const LEGACY_NPX_AT_LATEST = {
  command: 'npx',
  args: ['-y', '@inkeep/open-knowledge@latest', 'mcp'],
};
const BUNDLE_ABSOLUTE = {
  command: '/Applications/OpenKnowledge.app/Contents/Resources/cli/bin/ok.sh',
  args: ['mcp'],
};
const SYMLINK = { command: '/usr/local/bin/ok', args: ['mcp'] };

describe('repairMcpConfigs', () => {
  let testDir: string;
  let fakeHome: string;
  let projectDir: string;
  const originalPlatform = process.platform;
  let logEvents: RepairLogEvent[];

  beforeEach(() => {
    testDir = resolve(
      tmpdir(),
      `repair-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    fakeHome = join(testDir, 'home');
    projectDir = join(testDir, 'project');
    mkdirSync(join(fakeHome, '.claude'), { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    logEvents = [];
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    rmSync(testDir, { recursive: true, force: true });
  });

  function writeClaude(entry: Record<string, unknown>): string {
    const path = resolveClaudeCodeConfigPath({ home: fakeHome });
    writeFileSync(path, JSON.stringify({ mcpServers: { 'open-knowledge': entry } }, null, 2));
    return path;
  }

  it('rewrites legacy bare-npx, npx-@latest, bundle-direct, and symlink entries to the chain', () => {
    for (const entry of [LEGACY_BARE, LEGACY_NPX_AT_LATEST, BUNDLE_ABSOLUTE, SYMLINK]) {
      const configPath = writeClaude(entry);
      logEvents = [];

      const result = repairMcpConfigs({
        projectDir,
        home: fakeHome,
        logger: (event) => logEvents.push(event),
      });

      expect(result.repairedCount).toBe(1);
      expect(result.outcomes.find((o) => o.editorId === 'claude')?.outcome).toBe('repaired');
      const written = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(written.mcpServers['open-knowledge']).toEqual(CHAIN_ENTRY);
      expect(logEvents).toContainEqual({
        event: 'mcp-config-migrate',
        scope: 'user',
        surface: 'cli-repair',
        editorId: 'claude',
        configPath,
        priorCommand: typeof entry.command === 'string' ? entry.command : null,
        priorArgs: Array.isArray(entry.args) ? entry.args : null,
      });
    }
  });

  it('idempotent once the entry is the chain (no mtime change on re-run)', async () => {
    const configPath = writeClaude(CHAIN_ENTRY);
    const after1 = statSync(configPath).mtimeMs;

    const first = repairMcpConfigs({ projectDir, home: fakeHome });
    await new Promise<void>((r) => setTimeout(r, 5));
    const second = repairMcpConfigs({ projectDir, home: fakeHome });
    const after2 = statSync(configPath).mtimeMs;

    expect(first.repairedCount).toBe(0);
    expect(second.repairedCount).toBe(0);
    expect(second.outcomes.find((o) => o.editorId === 'claude')?.outcome).toBe('canonical');
    expect(after2).toBe(after1);
  });

  it('leaves configs without an open-knowledge entry untouched', () => {
    const configPath = resolveClaudeCodeConfigPath({ home: fakeHome });
    writeFileSync(configPath, JSON.stringify({ mcpServers: { other: { command: 'x' } } }));

    const result = repairMcpConfigs({ projectDir, home: fakeHome });

    expect(result.repairedCount).toBe(0);
    expect(result.outcomes.find((o) => o.editorId === 'claude')?.outcome).toBe('no-entry');
    expect(JSON.parse(readFileSync(configPath, 'utf-8')).mcpServers.other).toEqual({
      command: 'x',
    });
  });

  it('OK_RECLAIM_DISABLE=1 short-circuits with a structured event and no IO', () => {
    const configPath = writeClaude(LEGACY_BARE);
    const before = readFileSync(configPath, 'utf-8');

    const result = repairMcpConfigs({
      projectDir,
      home: fakeHome,
      reclaimDisableEnv: '1',
      logger: (event) => logEvents.push(event),
    });

    expect(result.repairedCount).toBe(0);
    expect(result.outcomes).toEqual([]);
    expect(readFileSync(configPath, 'utf-8')).toBe(before);
    expect(logEvents).toEqual([{ event: 'mcp-config-repair-skipped', reason: 'reclaim-disabled' }]);
  });

  it('OK_RECLAIM_DISABLE values other than "1" do NOT disable the sweep', () => {
    writeClaude(LEGACY_BARE);

    for (const env of ['0', 'true', '', null, undefined]) {
      const result = repairMcpConfigs({
        projectDir,
        home: fakeHome,
        reclaimDisableEnv: env as string | null | undefined,
      });
      expect(['repaired', 'canonical']).toContain(
        result.outcomes.find((o) => o.editorId === 'claude')?.outcome,
      );
    }
  });
});
