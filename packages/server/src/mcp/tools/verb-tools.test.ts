import { describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { register as registerDelete } from './delete.ts';
import { register as registerEdit } from './edit.ts';
import type { ServerInstance } from './shared.ts';
import { register as registerWrite } from './write.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: true;
}
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

function capture<D>(register: (server: ServerInstance, deps: D) => void, cwd: string): Handler {
  let handler: Handler | undefined;
  const server = {
    registerTool(_name: string, _cfg: unknown, h: Handler) {
      handler = h;
    },
  } as unknown as ServerInstance;
  register(server, {
    serverUrl: undefined,
    config: BASE_CONFIG,
    resolveCwd: async () => cwd,
  } as unknown as D);
  if (!handler) throw new Error('tool did not register');
  return handler;
}

function newProject(): string {
  return mkdtempSync(join(tmpdir(), 'ok-verb-tools-'));
}

function textOf(r: ToolResult): string {
  return r.content.map((c) => c.text).join('\n');
}

describe('write — exactly-one-target teaching error (D8/D9 mitigation)', () => {
  test('zero targets returns the corrective shape', async () => {
    const write = capture(registerWrite, newProject());
    const r = await write({});
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('Name exactly one of');
    expect(textOf(r)).toContain('document'); // the corrective example names the targets
  });

  test('two targets returns a "name exactly ONE" error', async () => {
    const write = capture(registerWrite, newProject());
    const r = await write({ document: { path: 'a', content: '# a' }, folder: { path: 'b' } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/name exactly ONE/i);
    expect(textOf(r)).toContain('document');
    expect(textOf(r)).toContain('folder');
  });
});

describe('edit — body-XOR-frontmatter + exactly-one-target teaching errors', () => {
  test('find without replace teaches the corrective shape', async () => {
    const edit = capture(registerEdit, newProject());
    const r = await edit({ document: { path: 'a', find: 'x' } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('`find` needs a `replace`');
  });

  test('body + frontmatter in one call is rejected', async () => {
    const edit = capture(registerEdit, newProject());
    const r = await edit({
      document: { path: 'a', find: 'x', replace: 'y', frontmatter: { t: 1 } },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/Pick ONE/i);
  });

  test('zero targets teaches exactly-one-target', async () => {
    const edit = capture(registerEdit, newProject());
    const r = await edit({});
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('Name exactly one of');
  });
});

describe('delete — exactly-one-target teaching error', () => {
  test('two targets rejected', async () => {
    const del = capture(registerDelete, newProject());
    const r = await del({ document: 'a', folder: 'b' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/name exactly ONE/i);
  });
});

describe('edit({ folder }) frontmatter — server-routed for attribution (PRD-6933 P2)', () => {
  test('requires a running server (attribution lives server-side)', async () => {
    const edit = capture(registerEdit, newProject());
    const r = await edit({
      folder: { path: 'meetings', frontmatter: { title: 'Meetings', tags: ['m'] } },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('Hocuspocus server is not running');
  });
});

describe('write/edit/delete({ template }) — server-routed for attribution (PRD-6933 P2)', () => {
  test('mutations require a running server (attribution lives server-side)', async () => {
    const cwd = newProject();
    const write = capture(registerWrite, cwd);
    const edit = capture(registerEdit, cwd);
    const del = capture(registerDelete, cwd);
    const results = [
      await write({
        template: {
          path: 'fishing-log/trip-log',
          content: '# x',
          frontmatter: { title: 'Trip Log' },
        },
      }),
      await edit({ template: { path: 'fishing-log/trip-log', find: 'x', replace: 'y' } }),
      await del({ template: { path: 'fishing-log/trip-log' } }),
    ];
    for (const r of results) {
      expect(r.isError).toBe(true);
      expect(textOf(r)).toContain('Hocuspocus server is not running');
    }
  });

  test('invalid template name is rejected by the name grammar', async () => {
    const cwd = newProject();
    const write = capture(registerWrite, cwd);
    const r = await write({
      template: { path: 'x/a.b', content: 'ok', frontmatter: { title: 'A' } },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('must be letters, digits');
    expect(existsSync(join(cwd, 'x', '.ok', 'templates', 'a.b.md'))).toBe(false);
  });
});

describe('edit({ template }) — fence trailing whitespace (fm-delimiter hazard)', () => {
  test('a body edit preserves frontmatter stored under trailing-whitespace fences', async () => {
    const cwd = newProject();
    mkdirSync(join(cwd, 'fishing-log', '.ok', 'templates'), { recursive: true });
    writeFileSync(
      join(cwd, 'fishing-log', '.ok', 'templates', 'trip-log.md'),
      '--- \ntitle: Trip Log\ndescription: Catch log\n---\n\n# Log\n\nFish: none\n',
    );

    let putPayload: Record<string, unknown> | undefined;
    const stub = Bun.serve({
      port: 0,
      async fetch(req) {
        if (req.method === 'PUT' && new URL(req.url).pathname === '/api/template') {
          putPayload = (await req.json()) as Record<string, unknown>;
          return Response.json({ path: 'fishing-log/.ok/templates/trip-log.md' });
        }
        return Response.json({ error: 'unexpected request' }, { status: 404 });
      },
    });
    try {
      let handler: Handler | undefined;
      const server = {
        registerTool(_name: string, _cfg: unknown, h: Handler) {
          handler = h;
        },
      } as unknown as ServerInstance;
      registerEdit(server, {
        serverUrl: `http://127.0.0.1:${stub.port}`,
        config: BASE_CONFIG,
        resolveCwd: async () => cwd,
      } as unknown as Parameters<typeof registerEdit>[1]);
      if (!handler) throw new Error('tool did not register');

      const r = await handler({
        template: { path: 'fishing-log/trip-log', find: 'none', replace: 'two bass' },
      });

      expect(r.isError).toBeUndefined();
      const fm = putPayload?.frontmatter as Record<string, unknown> | undefined;
      expect(fm?.title).toBe('Trip Log');
      expect(fm?.description).toBe('Catch log');
      const body = putPayload?.body as string | undefined;
      expect(body).toContain('two bass');
      expect(body).not.toContain('title: Trip Log');
    } finally {
      stub.stop(true);
    }
  });
});

describe('D13 migration meta-test — no retired tool name survives in the skill surface', () => {
  const RETIRED = [
    'write_document',
    'edit_document',
    'edit_frontmatter',
    'delete_document',
    'folder_config',
    'set_folder_rule',
    'write_template',
    'delete_template',
    'rename_document',
    'rename_folder',
    'get_history',
    'get_config',
    'get_preview_url',
    'get_components',
    'get_authoring_palette',
    'list_conflicts',
    'get_conflict_content',
  ];

  function mdFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) out.push(...mdFiles(p));
      else if (entry.endsWith('.md') || entry.endsWith('.mdx')) out.push(p);
    }
    return out;
  }

  test('packages/server/assets/skills/** teaches only the verb surface', () => {
    const skillsDir = fileURLToPath(new URL('../../../assets/skills', import.meta.url));
    const offenders: string[] = [];
    for (const file of mdFiles(skillsDir)) {
      const body = readFileSync(file, 'utf-8');
      for (const name of RETIRED) {
        if (body.includes(name)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
