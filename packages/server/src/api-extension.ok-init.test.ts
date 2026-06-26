import { afterEach, describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { listenOnLoopback } from './loopback-rig-test-helpers.ts';

function extractHandlerBlock(src: string, handlerNameConst: string): string {
  const anchorRe = new RegExp(`const\\s+${handlerNameConst}\\s*=`);
  const match = anchorRe.exec(src);
  if (!match) {
    throw new Error(`extractHandlerBlock: '${handlerNameConst}' anchor not found`);
  }
  return src.slice(match.index, match.index + 6400);
}

interface TestRig {
  port: number;
  projectDir: string;
  tmpRoot: string;
  server: Server;
  cleanup: () => Promise<void>;
}

function run(cwd: string, cmd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8' });
}

function initRepo(cwd: string): void {
  run(cwd, 'git init -q -b main');
  run(cwd, 'git config user.email "test@example.com"');
  run(cwd, 'git config user.name "Test"');
  run(cwd, 'git config commit.gpgsign false');
}

async function bootRig(): Promise<TestRig> {
  const tmpRoot = realpathSync(mkdtempSync(join(homedir(), '.ok-init-api-test-')));
  const projectDir = join(tmpRoot, 'host-project');
  const contentDir = join(projectDir, 'content');
  mkdirSync(contentDir, { recursive: true });
  initRepo(projectDir);
  writeFileSync(join(projectDir, 'README.md'), '# host\n');
  run(projectDir, 'git add -A');
  run(projectDir, 'git commit -q -m initial');

  const { Hocuspocus } = await import('@hocuspocus/server');
  const { AgentSessionManager } = await import('./agent-sessions.ts');
  const { createApiExtension } = await import('./api-extension.ts');

  const hocuspocus = new Hocuspocus({ quiet: true });
  const sessionManager = new AgentSessionManager(hocuspocus);
  const ext = createApiExtension({
    hocuspocus,
    sessionManager,
    contentDir,
    projectDir,
    getFileIndex: () => new Map(),
    serverInstanceId: 'test-instance',
  });

  const { createServer } = await import('node:http');
  const server = createServer((req, res) => {
    // biome-ignore lint/suspicious/noExplicitAny: test harness
    hocuspocus.hooks('onRequest', { request: req, response: res } as any).catch(() => {
      if (!res.writableEnded) {
        res.writeHead(500);
        res.end('Error');
      }
    });
  });
  hocuspocus.configuration.extensions.push(ext);

  const { port } = await listenOnLoopback(server);

  return {
    port,
    projectDir,
    tmpRoot,
    server,
    cleanup: async () => {
      await new Promise<void>((res) => server.close(() => res()));
      rmSync(tmpRoot, { recursive: true, force: true });
    },
  };
}

async function postOkInit(
  port: number,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${port}/api/local-op/ok-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // biome-ignore lint/suspicious/noExplicitAny: test
  const json = (await res.json()) as any;
  return { status: res.status, json };
}

let rig: TestRig | null = null;

afterEach(async () => {
  if (rig) {
    await rig.cleanup();
    rig = null;
  }
});

describe('POST /api/local-op/ok-init', () => {
  test('scaffolds .ok/config.yml on a fresh git worktree → {ok:true}', async () => {
    rig = await bootRig();
    const target = join(rig.tmpRoot, 'fresh-worktree');
    mkdirSync(target);
    initRepo(target);
    writeFileSync(join(target, 'README.md'), '# fresh\n');
    run(target, 'git add -A');
    run(target, 'git commit -q -m initial');

    expect(existsSync(join(target, '.ok'))).toBe(false);

    const res = await postOkInit(rig.port, { projectPath: target });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.json.projectPath).toBe(target);
    expect(existsSync(join(target, '.ok/config.yml'))).toBe(true);
    expect(existsSync(join(target, '.ok/.gitignore'))).toBe(true);
    expect(existsSync(join(target, '.okignore'))).toBe(true);
  });

  test('idempotent: re-call on already-initialized project returns {ok:true} without rewriting config.yml', async () => {
    rig = await bootRig();
    const target = join(rig.tmpRoot, 'existing');
    mkdirSync(target);
    initRepo(target);
    writeFileSync(join(target, 'README.md'), '# x\n');
    run(target, 'git add -A');
    run(target, 'git commit -q -m initial');

    const first = await postOkInit(rig.port, { projectPath: target });
    expect(first.json.ok).toBe(true);

    const configPath = join(target, '.ok/config.yml');
    writeFileSync(configPath, 'custom: true\n');

    const second = await postOkInit(rig.port, { projectPath: target });
    expect(second.json.ok).toBe(true);
    expect(readFileSync(configPath, 'utf8')).toBe('custom: true\n');
  });

  test('non-git path returns {ok:false, reason:"not-a-git-worktree"}', async () => {
    rig = await bootRig();
    const target = join(rig.tmpRoot, 'not-a-repo');
    mkdirSync(target);

    const res = await postOkInit(rig.port, { projectPath: target });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(false);
    expect(res.json.reason).toBe('not-a-git-worktree');
    expect(existsSync(join(target, '.ok'))).toBe(false);
  });

  test('non-existent path returns {ok:false, reason:"not-a-git-worktree"}', async () => {
    rig = await bootRig();
    const target = join(rig.tmpRoot, 'does-not-exist');

    const res = await postOkInit(rig.port, { projectPath: target });
    expect(res.json.ok).toBe(false);
    expect(res.json.reason).toBe('not-a-git-worktree');
  });

  test('projectPath outside home returns 400 (urn:ok:error:dir-outside-home) without scaffolding', async () => {
    rig = await bootRig();
    const outsideRoot = realpathSync(mkdtempSync(join(tmpdir(), 'ok-init-outside-home-')));
    try {
      mkdirSync(join(outsideRoot, 'repo'));
      const target = join(outsideRoot, 'repo');
      initRepo(target);
      writeFileSync(join(target, 'README.md'), '# outside\n');
      run(target, 'git add -A');
      run(target, 'git commit -q -m initial');

      const res = await postOkInit(rig.port, { projectPath: target });
      expect(res.status).toBe(400);
      expect(res.json.type).toBe('urn:ok:error:dir-outside-home');
      expect(existsSync(join(target, '.ok'))).toBe(false);
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test('relative path returns 400 problem+json (urn:ok:error:invalid-request)', async () => {
    rig = await bootRig();
    const res = await postOkInit(rig.port, { projectPath: 'relative/path' });
    expect(res.status).toBe(400);
    expect(res.json.type).toBe('urn:ok:error:invalid-request');
  });

  test('429 problem+json contract — handler is wired through localOpGuard with the ok-init key', () => {
    const apiExtensionSrc = readFileSync(join(__dirname, 'api-extension.ts'), 'utf8');

    expect(apiExtensionSrc).toMatch(/LOCAL_OP_OK_INIT_KEY\s*=\s*['"]\/api\/local-op\/ok-init['"]/);

    expect(apiExtensionSrc).toMatch(/localOpGuard\.tryAcquire\(LOCAL_OP_OK_INIT_KEY\)/);

    const okInitBlock = extractHandlerBlock(apiExtensionSrc, 'HANDLE_LOCAL_OP_OK_INIT');
    expect(okInitBlock).toContain('429');
    expect(okInitBlock).toContain("'urn:ok:error:concurrent-operation'");
    expect(okInitBlock).toContain("'Retry-After'");

    expect(okInitBlock).toMatch(/finally\s*\{[^}]*localOpGuard\.release\(LOCAL_OP_OK_INIT_KEY\)/s);
  });

  test('scaffolds inside a linked worktree (FR13 + D12 spirit)', async () => {
    rig = await bootRig();
    const main = join(rig.tmpRoot, 'main-repo');
    mkdirSync(main);
    initRepo(main);
    writeFileSync(join(main, 'README.md'), '# main\n');
    run(main, 'git add -A');
    run(main, 'git commit -q -m initial');
    const wt = join(rig.tmpRoot, 'wt-feat');
    run(main, `git worktree add -b feat ${wt}`);

    const res = await postOkInit(rig.port, { projectPath: wt });
    expect(res.json.ok).toBe(true);
    expect(existsSync(join(wt, '.ok/config.yml'))).toBe(true);
  });
});
