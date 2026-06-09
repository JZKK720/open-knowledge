import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearEmbeddingsKeyFromAllBackends,
  describeStoredEmbeddingsKey,
  FileEmbeddingsBackend,
  makeLazyEmbeddingsKeyStore,
} from './secrets-store.ts';

const KEY = 'sk-secret-embeddings-key-1234567890';

let dir: string;
let secretsFile: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ok-embkey-'));
  secretsFile = join(dir, '.ok', 'secrets.yml');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('FileEmbeddingsBackend', () => {
  test('set → get round-trips the key', async () => {
    const store = new FileEmbeddingsBackend(secretsFile);
    expect(await store.get()).toBeNull();
    await store.set(KEY);
    expect(await store.get()).toBe(KEY);
  });

  test('writes the secrets file with 0600 permissions', async () => {
    const store = new FileEmbeddingsBackend(secretsFile);
    await store.set(KEY);
    expect(existsSync(secretsFile)).toBe(true);
    const mode = statSync(secretsFile).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  test('re-asserts 0600 on a pre-existing, looser-permissioned secrets file', async () => {
    mkdirSync(join(dir, '.ok'), { recursive: true });
    writeFileSync(secretsFile, 'other: keep-me\n');
    chmodSync(secretsFile, 0o644);
    await new FileEmbeddingsBackend(secretsFile).set(KEY);
    expect(statSync(secretsFile).mode & 0o777).toBe(0o600);
  });

  test('clear removes the key; get returns null again', async () => {
    const store = new FileEmbeddingsBackend(secretsFile);
    await store.set(KEY);
    await store.clear();
    expect(await store.get()).toBeNull();
  });

  test('clear unlinks the file when the key was the only secret', async () => {
    const store = new FileEmbeddingsBackend(secretsFile);
    await store.set(KEY);
    expect(existsSync(secretsFile)).toBe(true);
    await store.clear();
    expect(existsSync(secretsFile)).toBe(false);
  });

  test('clear preserves other secrets in the file', async () => {
    const store = new FileEmbeddingsBackend(secretsFile);
    await store.set(KEY);
    const raw = readFileSync(secretsFile, 'utf-8');
    writeFileSync(secretsFile, `${raw}other: keep-me\n`);
    await store.clear();
    expect(await store.get()).toBeNull();
    expect(readFileSync(secretsFile, 'utf-8')).toContain('other: keep-me');
  });

  test('empty / absent file reads as no key', async () => {
    const store = new FileEmbeddingsBackend(secretsFile);
    expect(await store.get()).toBeNull();
  });
});

describe('makeLazyEmbeddingsKeyStore', () => {
  test('reads the key from the secrets file (file-only, no keychain)', async () => {
    await new FileEmbeddingsBackend(secretsFile).set(KEY);
    const reader = makeLazyEmbeddingsKeyStore(secretsFile);
    expect(await reader.get()).toBe(KEY);
  });

  test('picks up a key written AFTER the reader was created (re-reads each get)', async () => {
    const reader = makeLazyEmbeddingsKeyStore(secretsFile);
    expect(await reader.get()).toBeNull();
    await new FileEmbeddingsBackend(secretsFile).set(KEY);
    expect(await reader.get()).toBe(KEY);
  });

  test('returns null (never throws) when nothing is stored', async () => {
    const reader = makeLazyEmbeddingsKeyStore(secretsFile);
    expect(await reader.get()).toBeNull();
  });
});

describe('describeStoredEmbeddingsKey', () => {
  test('reports the file backend when the key lives there', async () => {
    await new FileEmbeddingsBackend(secretsFile).set(KEY);
    const desc = await describeStoredEmbeddingsKey(secretsFile);
    expect(desc.file).toBe(true);
  });

  test('reports no file backend when nothing is stored', async () => {
    const desc = await describeStoredEmbeddingsKey(secretsFile);
    expect(desc.file).toBe(false);
  });
});

describe('clearEmbeddingsKeyFromAllBackends', () => {
  test('reports the file backend when it held a key', async () => {
    await new FileEmbeddingsBackend(secretsFile).set(KEY);
    const { touched } = await clearEmbeddingsKeyFromAllBackends(secretsFile);
    expect(touched).toContain('file');
    expect(await new FileEmbeddingsBackend(secretsFile).get()).toBeNull();
  });

  test('reports nothing when no key was stored', async () => {
    const { touched } = await clearEmbeddingsKeyFromAllBackends(secretsFile);
    expect(touched).toEqual([]);
  });
});
