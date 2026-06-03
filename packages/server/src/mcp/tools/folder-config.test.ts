import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeObjectSchema,
  safeParseAsync,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { DESCRIPTION, register } from './folder-config.ts';
import type { ServerInstance } from './shared.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

interface CapturedTool {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema: unknown;
  annotations: { readOnlyHint: boolean; idempotentHint: boolean; destructiveHint: boolean };
  handler: Handler;
}

function newProject(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'ok-folder-config-'));
  mkdirSync(join(cwd, '.ok'), { recursive: true });
  return cwd;
}

function captureRegistration(cwd: string): CapturedTool {
  let captured: CapturedTool | null = null;
  const server = {
    registerTool(
      name: string,
      cfg: {
        description?: string;
        inputSchema?: unknown;
        outputSchema?: unknown;
        annotations?: {
          readOnlyHint: boolean;
          idempotentHint: boolean;
          destructiveHint: boolean;
        };
      },
      handler: Handler,
    ) {
      captured = {
        name,
        description: cfg.description ?? '',
        inputSchema: cfg.inputSchema,
        outputSchema: cfg.outputSchema,
        annotations: cfg.annotations ?? {
          readOnlyHint: false,
          idempotentHint: false,
          destructiveHint: false,
        },
        handler,
      };
    },
    tool() {
      throw new Error('legacy tool() API not expected');
    },
  } as unknown as ServerInstance;
  register(server, { config: BASE_CONFIG, resolveCwd: async () => cwd });
  if (!captured) throw new Error('tool did not register');
  return captured;
}

async function parseArgs(
  inputSchema: unknown,
  args: Record<string, unknown>,
): Promise<{ success: boolean; errorText: string }> {
  const normalized = normalizeObjectSchema(
    inputSchema as Parameters<typeof normalizeObjectSchema>[0],
  );
  if (!normalized) throw new Error('inputSchema did not normalize');
  const result = await safeParseAsync(normalized, args);
  if (result.success) return { success: true, errorText: '' };
  const errAny = (result as { error?: unknown }).error;
  const errorText =
    errAny && typeof errAny === 'object' && 'message' in errAny
      ? String((errAny as { message: unknown }).message)
      : JSON.stringify(errAny);
  return { success: false, errorText };
}

function readNestedFm(cwd: string, folder: string): string | null {
  const p = folder
    ? join(cwd, folder, '.ok', 'frontmatter.yml')
    : join(cwd, '.ok', 'frontmatter.yml');
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
}

describe('folder_config — registration + DESCRIPTION', () => {
  test('registers exactly one tool named "folder_config" with the three-action surface', () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    expect(tool.name).toBe('folder_config');
  });

  test('DESCRIPTION enumerates the three actions and their parameter contracts', () => {
    expect(DESCRIPTION).toContain('action: "set-rule"');
    expect(DESCRIPTION).toContain('action: "write-template"');
    expect(DESCRIPTION).toContain('action: "delete-template"');
    expect(DESCRIPTION).not.toContain('declare-field');
    expect(DESCRIPTION).not.toContain('remove-field');
    expect(DESCRIPTION).toContain('rules');
    expect(DESCRIPTION).toContain('folder');
    expect(DESCRIPTION).toContain('name');
    expect(DESCRIPTION).toContain('body');
    expect(DESCRIPTION).toContain('frontmatter');
    expect(DESCRIPTION).toContain('open-shape');
  });

  test('annotations: readOnlyHint=false, idempotentHint=true, destructiveHint=true', () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    expect(tool.annotations.readOnlyHint).toBe(false);
    expect(tool.annotations.idempotentHint).toBe(true);
    expect(tool.annotations.destructiveHint).toBe(true);
  });

  test('outputSchema admits the auto-injected `text` mirror field', () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    expect(tool.outputSchema).toBeDefined();
  });
});

describe('folder_config — input-schema strictness per action', () => {
  test('action=set-rule: accepts a well-formed rules payload', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'set-rule',
      rules: [{ match: 'specs/**', frontmatter: { description: 'Specs' } }],
    });
    expect(r.errorText).toBe('');
    expect(r.success).toBe(true);
  });

  test('action=set-rule: extra keys are rejected by the strict outer schema (tightens vs retired set_folder_rule)', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'set-rule',
      rules: [{ match: 'specs/**', frontmatter: {} }],
      legacyExtra: 'ignored',
    });
    expect(r.success).toBe(false);
    expect(r.errorText).toMatch(/legacyExtra/);
  });

  test('action=write-template: accepts a well-formed payload', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'write-template',
      folder: '',
      name: 'foo',
      body: '# hi',
      frontmatter: { title: 'Hello' },
    });
    expect(r.errorText).toBe('');
    expect(r.success).toBe(true);
  });

  test('action=write-template: rejects stale `target` key (preserves write_template strictness)', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'write-template',
      folder: '',
      name: 'foo',
      body: '# hi',
      frontmatter: { title: 'Hello' },
      target: 'user',
    });
    expect(r.success).toBe(false);
    expect(r.errorText).toMatch(/target/i);
  });

  test('action=delete-template: accepts a well-formed payload', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'delete-template',
      folder: '',
      name: 'foo',
    });
    expect(r.errorText).toBe('');
    expect(r.success).toBe(true);
  });

  test('action=delete-template: rejects stale `target` key (preserves delete_template strictness)', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'delete-template',
      folder: '',
      name: 'foo',
      target: 'project',
    });
    expect(r.success).toBe(false);
    expect(r.errorText).toMatch(/target/i);
  });

  test('rejects unknown action values', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'bogus',
      rules: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('folder_config — action=set-rule re-routes to applyNestedFolderRulesUpsert', () => {
  test('writes nested <folder>/.ok/frontmatter.yml for `specs/**`', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const result = await tool.handler({
      action: 'set-rule',
      rules: [{ match: 'specs/**', frontmatter: { description: 'Specs', tags: ['spec'] } }],
    });
    expect(result.isError).toBeUndefined();
    const yaml = readNestedFm(cwd, 'specs');
    expect(yaml).not.toBeNull();
    expect(yaml).toContain('description: Specs');
    expect(yaml).toContain('- spec');
  });

  test('supports new_match rule-move semantics', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    await tool.handler({
      action: 'set-rule',
      rules: [{ match: 'oldspecs/**', frontmatter: { description: 'Old' } }],
    });
    await tool.handler({
      action: 'set-rule',
      rules: [
        {
          match: 'oldspecs/**',
          new_match: 'newspecs/**',
          frontmatter: { description: 'Old' },
        },
      ],
    });
    expect(readNestedFm(cwd, 'oldspecs')).toBeNull();
    expect(readNestedFm(cwd, 'newspecs')).toContain('description: Old');
  });

  test('multi-folder glob is rejected with MULTI_FOLDER_GLOB', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const result = await tool.handler({
      action: 'set-rule',
      rules: [{ match: 'specs/*/evidence/**', frontmatter: {} }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('MULTI_FOLDER_GLOB');
  });
});

describe('folder_config — action=write-template re-routes to applyTemplateWrite', () => {
  test('creates a template at <folder>/.ok/templates/<name>.md', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const result = await tool.handler({
      action: 'write-template',
      folder: 'meetings',
      name: 'standup',
      body: '# Standup {{date}}',
      frontmatter: { title: 'Standup notes' },
    });
    expect(result.isError).toBeUndefined();
    const path = join(cwd, 'meetings', '.ok', 'templates', 'standup.md');
    expect(existsSync(path)).toBe(true);
    const body = readFileSync(path, 'utf-8');
    expect(body).toContain('Standup notes');
    expect(body).toContain('{{date}}');
  });

  test('rejects body with unknown substitution token', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const result = await tool.handler({
      action: 'write-template',
      folder: '',
      name: 'bad',
      body: '# {{secret}}',
      frontmatter: { title: 'Bad' },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('TEMPLATE_UNKNOWN_VARIABLE');
  });
});

describe('folder_config — action=delete-template re-routes to applyTemplateDelete', () => {
  test('removes <folder>/.ok/templates/<name>.md', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    await tool.handler({
      action: 'write-template',
      folder: 'meetings',
      name: 'standup',
      body: '# Standup',
      frontmatter: { title: 'Standup notes' },
    });
    const path = join(cwd, 'meetings', '.ok', 'templates', 'standup.md');
    expect(existsSync(path)).toBe(true);

    const result = await tool.handler({
      action: 'delete-template',
      folder: 'meetings',
      name: 'standup',
    });
    expect(result.isError).toBeUndefined();
    expect(existsSync(path)).toBe(false);
  });

  test('idempotent: deleting a non-existent template returns success with existed:false', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const result = await tool.handler({
      action: 'delete-template',
      folder: 'meetings',
      name: 'ghost',
    });
    expect(result.isError).toBeUndefined();
    const payload = result.structuredContent as { result: { ok: boolean; existed: boolean } };
    expect(payload.result.ok).toBe(true);
    expect(payload.result.existed).toBe(false);
  });
});

describe('folder_config — batch (operations)', () => {
  test('applies a set-rule + write-template in one call', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const result = await tool.handler({
      operations: [
        {
          action: 'set-rule',
          rules: [{ match: 'specs/**', frontmatter: { description: 'Specs', tags: ['spec'] } }],
        },
        {
          action: 'write-template',
          folder: 'specs',
          name: 'SPEC',
          body: '# {{date}}',
          frontmatter: { title: 'Spec' },
        },
      ],
    });
    expect(result.isError).toBeUndefined();
    expect(readNestedFm(cwd, 'specs')).toContain('description: Specs');
    expect(existsSync(join(cwd, 'specs', '.ok', 'templates', 'SPEC.md'))).toBe(true);
    const payload = result.structuredContent as {
      result: { ok: boolean; operations: Array<{ action: string; result: { ok: boolean } }> };
    };
    expect(payload.result.ok).toBe(true);
    expect(payload.result.operations).toHaveLength(2);
    expect(payload.result.operations.every((o) => o.result.ok)).toBe(true);
  });

  test('a failing operation surfaces in the batch result without blocking the rest', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const result = await tool.handler({
      operations: [
        { action: 'set-rule', rules: [{ match: 'docs/**', frontmatter: { description: 'Docs' } }] },
        { action: 'set-rule', rules: [{ match: 'a/*/b/**', frontmatter: {} }] },
      ],
    });
    expect(result.isError).toBe(true);
    expect(readNestedFm(cwd, 'docs')).toContain('description: Docs');
    const payload = result.structuredContent as {
      result: { ok: boolean; operations: Array<{ result: { ok: boolean } }> };
    };
    expect(payload.result.ok).toBe(false);
    expect(payload.result.operations[0]?.result.ok).toBe(true);
    expect(payload.result.operations[1]?.result.ok).toBe(false);
  });

  test('rejects `action` and `operations` together', async () => {
    const cwd = newProject();
    const tool = captureRegistration(cwd);
    const r = await parseArgs(tool.inputSchema, {
      action: 'set-rule',
      rules: [{ match: 'x/**', frontmatter: {} }],
      operations: [{ action: 'delete-template', folder: '', name: 'foo' }],
    });
    expect(r.success).toBe(false);
    expect(r.errorText).toMatch(/mutually exclusive/i);
  });
});
