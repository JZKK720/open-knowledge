import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import { MAX_FILE_SIZE } from './file-logger.ts';

const TEST_DIR = join(tmpdir(), `ok-file-logger-test-${process.pid}`);

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
});

describe('file logger', () => {
  test('pino.destination writes NDJSON to file', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, 'test.log');
    const dest = pino.destination({ dest: filePath, sync: true });
    const logger = pino(
      { base: { project: 'my-project' }, timestamp: pino.stdTimeFunctions.isoTime },
      dest,
    );
    logger.info({ foo: 'bar' }, 'hello');
    dest.flushSync();
    const content = Bun.file(filePath).text();
    expect(content).resolves.toContain('"msg":"hello"');
  });

  test('project field is included in records', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, 'test-project.log');
    const dest = pino.destination({ dest: filePath, sync: true });
    const logger = pino(
      { base: { project: 'test-slug' }, timestamp: pino.stdTimeFunctions.isoTime },
      dest,
    );
    logger.info({}, 'check');
    dest.flushSync();
    const content = Bun.file(filePath).text();
    expect(content).resolves.toContain('"project":"test-slug"');
  });

  test('redact config censors sensitive top-level fields', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, 'test-redact.log');
    const dest = pino.destination({ dest: filePath, sync: true });
    const logger = pino(
      {
        redact: { paths: ['authorization', '*.authorization'], censor: '[REDACTED]' },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      dest,
    );
    logger.info({ authorization: 'Bearer sk-secret123' }, 'auth check');
    dest.flushSync();
    const content = Bun.file(filePath).text();
    expect(content).resolves.toContain('[REDACTED]');
  });

  test('rotation renames when file exceeds 5MB', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, 'big.log');
    const padding = `${'x'.repeat(1024)}\n`;
    let content = '';
    for (let i = 0; i < 5200; i++) content += padding;
    writeFileSync(filePath, content);
    expect(statSync(filePath).size).toBeGreaterThan(MAX_FILE_SIZE);

    const { createFileLogger } = require('./file-logger.ts');
    createFileLogger({ name: 'big', filePath });

    const files = readdirSync(TEST_DIR).filter((f: string) => f.startsWith('big.log'));
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files).toContain('big.log.1');
  });

  test('createFileLogger unrefs the deferred prune timer so it never blocks process exit', () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const { createFileLogger } = require('./file-logger.ts');
    let unrefCalls = 0;
    let scheduledMs: number | undefined;
    const fakeSetTimeout = ((_cb: () => void, ms?: number) => {
      scheduledMs = ms;
      return {
        unref() {
          unrefCalls += 1;
          return this;
        },
      };
    }) as unknown as typeof setTimeout;

    createFileLogger({
      name: 'unref-contract',
      filePath: join(TEST_DIR, 'unref.log'),
      _setTimeout: fakeSetTimeout,
    });

    expect(unrefCalls).toBe(1);
    expect(scheduledMs).toBe(5000);
  });
});
