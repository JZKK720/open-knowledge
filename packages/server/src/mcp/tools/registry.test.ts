import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { registerAllTools } from './index.ts';
import type { ServerInstance } from './shared.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

const EXPECTED_TOOLS = [
  'exec',
  'search',
  'get_history',
  'links',
  'get_config',
  'get_components',
  'get_authoring_palette',
  'get_preview_url',
  'share_link',
  'write_document',
  'edit_document',
  'edit_frontmatter',
  'delete_document',
  'rename',
  'version',
  'folder_config',
  'list_conflicts',
  'get_conflict_content',
  'resolve_conflict',
  'ingest',
  'research',
  'consolidate',
  'discover',
] as const;

const RETIRED_TOOL_NAMES = [
  'get_backlinks',
  'get_forward_links',
  'get_dead_links',
  'get_orphans',
  'get_hubs',
  'suggest_links',
  'rename_document',
  'rename_folder',
  'save_version',
  'rollback_to_version',
  'set_folder_rule',
  'write_template',
  'delete_template',
  'frontmatter_patch',
  'read_document',
  'grep',
  'list_documents',
] as const;

function captureRegistered(): string[] {
  const names: string[] = [];
  const cwd = mkdtempSync(join(tmpdir(), 'ok-registry-assertion-'));
  const server = {
    registerTool(name: string, _cfg: unknown, _handler: unknown) {
      names.push(name);
    },
    tool() {
      throw new Error('legacy tool() API not expected — every tool must use registerTool');
    },
  } as unknown as ServerInstance;
  registerAllTools(server, {
    config: BASE_CONFIG,
    resolveCwd: async () => cwd,
    serverUrl: undefined,
  });
  return names;
}

describe('registerAllTools — 23-tool surface (SPEC.md §9.1 / AC8)', () => {
  test('registers exactly 23 tools', () => {
    const names = captureRegistered();
    expect(names.length).toBe(23);
  });

  test('the 23 expected tool names are all present', () => {
    const names = new Set(captureRegistered());
    for (const expected of EXPECTED_TOOLS) {
      expect(names).toContain(expected);
    }
  });

  test('none of the 17 pre-consolidation tool names are registered', () => {
    const names = new Set(captureRegistered());
    for (const retired of RETIRED_TOOL_NAMES) {
      expect(names.has(retired)).toBe(false);
    }
  });

  test('the registered set matches the expected set exactly (no extras)', () => {
    const names = new Set(captureRegistered());
    expect(names).toEqual(new Set(EXPECTED_TOOLS));
  });

  test('no duplicate registrations', () => {
    const names = captureRegistered();
    expect(names.length).toBe(new Set(names).size);
  });
});
