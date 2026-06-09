import { chmodSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { tracedMkdirSync, tracedUnlinkSync, tracedWriteFileSync } from '../fs-traced.ts';

const EMBEDDINGS_ACCOUNT = 'embeddings';

export function secretsFilePath(homedirOverride?: string): string {
  return join(homedirOverride ?? homedir(), '.ok', 'secrets.yml');
}

export interface EmbeddingsKeyReader {
  get(): Promise<string | null>;
}

export interface EmbeddingsSecretStore extends EmbeddingsKeyReader {
  readonly backend: 'file';
  set(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class FileEmbeddingsBackend implements EmbeddingsSecretStore {
  readonly backend = 'file' as const;
  private readonly secretsFile: string;

  constructor(secretsFile?: string) {
    this.secretsFile = secretsFile ?? secretsFilePath();
  }

  private read(): Record<string, unknown> {
    if (!existsSync(this.secretsFile)) return {};
    try {
      return (yamlParse(readFileSync(this.secretsFile, 'utf-8')) ?? {}) as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      process.stderr.write(
        `[embeddings] Failed to parse ${this.secretsFile}: ${msg}. Starting with empty secrets.\n`,
      );
      return {};
    }
  }

  private write(data: Record<string, unknown>): void {
    const dir = dirname(this.secretsFile);
    if (!existsSync(dir)) tracedMkdirSync(dir, { recursive: true, mode: 0o700 });
    tracedWriteFileSync(this.secretsFile, yamlStringify(data), { mode: 0o600 });
    chmodSync(this.secretsFile, 0o600);
  }

  get(): Promise<string | null> {
    const value = this.read()[EMBEDDINGS_ACCOUNT];
    return Promise.resolve(typeof value === 'string' && value !== '' ? value : null);
  }

  set(key: string): Promise<void> {
    const data = this.read();
    data[EMBEDDINGS_ACCOUNT] = key;
    this.write(data);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    const data = this.read();
    if (EMBEDDINGS_ACCOUNT in data) {
      delete data[EMBEDDINGS_ACCOUNT];
      if (Object.keys(data).length === 0) {
        try {
          tracedUnlinkSync(this.secretsFile);
        } catch {}
      } else {
        this.write(data);
      }
    }
    return Promise.resolve();
  }
}

export function createEmbeddingsSecretStore(secretsFile?: string): EmbeddingsSecretStore {
  return new FileEmbeddingsBackend(secretsFile);
}

export function makeLazyEmbeddingsKeyStore(secretsFile?: string): EmbeddingsKeyReader {
  return new FileEmbeddingsBackend(secretsFile);
}

export async function describeStoredEmbeddingsKey(
  secretsFile?: string,
): Promise<{ file: boolean }> {
  return { file: (await new FileEmbeddingsBackend(secretsFile).get()) != null };
}

export async function clearEmbeddingsKeyFromAllBackends(
  secretsFile?: string,
): Promise<{ touched: Array<'file'> }> {
  const touched: Array<'file'> = [];
  const file = new FileEmbeddingsBackend(secretsFile);
  if ((await file.get()) != null) {
    await file.clear();
    touched.push('file');
  }
  return { touched };
}
