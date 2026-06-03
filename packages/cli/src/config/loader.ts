import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  type ConfigIssue,
  type ConfigValidationError,
  detectRemovedKeys,
  humanFormat,
  locateIssue,
} from '@inkeep/open-knowledge-core';
import { readConfigSafely, resolveConfigPath } from '@inkeep/open-knowledge-core/server';
import { type Config, ConfigSchema } from '@inkeep/open-knowledge-server';
import { type Document, parseDocument } from 'yaml';
import { CONFIG_FILENAME, OK_DIR } from '../constants.ts';
import { isObject } from '../utils/is-object.ts';
import { normalizeCwd } from '../utils/normalize-cwd.ts';

export interface LoadConfigResult {
  config: Config;
  sources: string[];
}

const DEFAULT_CONFIG_CACHE_MS = 1000;

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = base[key];
    const overrideVal = override[key];
    if (isObject(overrideVal) && isObject(baseVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }
  return result;
}

interface LoadedYamlFile {
  value: Record<string, unknown> | null;
  path: string;
  source: string | null;
  doc: Document | null;
}

function loadYamlFile(filePath: string): LoadedYamlFile {
  if (!existsSync(filePath)) {
    return { value: null, path: filePath, source: null, doc: null };
  }
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.warn(
      `[config] Failed to read ${filePath}: ${err instanceof Error ? err.message : err}`,
    );
    return { value: null, path: filePath, source: null, doc: null };
  }
  const doc = parseDocument(raw);
  if (doc.errors.length > 0) {
    console.warn(
      `[config] Failed to parse ${filePath}: ${doc.errors.map((e) => e.message).join('; ')}`,
    );
    return { value: null, path: filePath, source: raw, doc: null };
  }
  const parsed = doc.toJSON();
  if (isObject(parsed)) {
    return { value: parsed, path: filePath, source: raw, doc };
  }
  return { value: null, path: filePath, source: raw, doc };
}

function annotateIssuesWithSource(
  zodIssues: ReadonlyArray<{ path: PropertyKey[]; message: string; code: string }>,
  projectFile: LoadedYamlFile,
): ConfigIssue[] {
  return zodIssues.map((issue) => {
    const path = issue.path.map((seg) =>
      typeof seg === 'symbol' ? String(seg) : (seg as string | number),
    );
    const base: ConfigIssue = {
      path,
      message: issue.message,
      issueCode: issue.code,
    };
    if (projectFile.doc !== null && projectFile.source !== null) {
      const located = locateIssue({
        file: projectFile.path,
        source: projectFile.source,
        doc: projectFile.doc,
        path,
      });
      if (located !== undefined) {
        return { ...base, source: located };
      }
    }
    return base;
  });
}

export function loadConfig(cwd?: string): LoadConfigResult {
  const workingDir = cwd ?? process.cwd();
  const sources: string[] = [];

  const userConfigPath = resolveConfigPath('user', workingDir);
  const userResult = readConfigSafely({ absPath: userConfigPath });
  let merged: Record<string, unknown> = {};
  if (userResult.valid && userResult.source !== undefined) {
    merged = deepMerge(merged, userResult.value as unknown as Record<string, unknown>);
    sources.push(userConfigPath);
  } else if (!userResult.valid) {
  }

  const projectConfigPath = resolve(workingDir, OK_DIR, CONFIG_FILENAME);
  const projectFile = loadYamlFile(projectConfigPath);
  if (projectFile.value !== null) {
    const removedKeyErrors = detectRemovedKeys({
      value: projectFile.value,
      file: projectFile.path,
      source: projectFile.source,
      doc: projectFile.doc,
    });
    if (removedKeyErrors.length > 0) {
      throw new Error(removedKeyErrors.map(humanFormat).join('\n\n'));
    }
    merged = deepMerge(merged, projectFile.value);
    sources.push(projectConfigPath);
  }

  const result = ConfigSchema.safeParse(merged);
  if (!result.success) {
    const issues = annotateIssuesWithSource(result.error.issues, projectFile);
    const error: ConfigValidationError = { code: 'SCHEMA_INVALID', issues };
    throw new Error(humanFormat(error));
  }

  return { config: result.data, sources };
}

interface CreateProjectConfigResolverOptions {
  startupCwd: string;
  startupConfig: Config;
  cacheMs?: number;
  loadConfigFn?: (cwd?: string) => LoadConfigResult;
}

export function createProjectConfigResolver(
  opts: CreateProjectConfigResolverOptions,
): (cwd?: string) => Promise<Config> {
  const cacheMs = opts.cacheMs ?? DEFAULT_CONFIG_CACHE_MS;
  const load = opts.loadConfigFn ?? loadConfig;
  const cache = new Map<string, { config: Config; expiresAt: number }>();
  const pendingResolutions = new Map<string, Promise<Config>>();
  const normalizedStartupCwdPromise = normalizeCwd(opts.startupCwd);

  return async (cwd?: string): Promise<Config> => {
    const effectiveCwd = await normalizeCwd(cwd ?? opts.startupCwd);
    const now = Date.now();
    const cached = cache.get(effectiveCwd);
    if (cached && cached.expiresAt > now) return cached.config;

    const pending = pendingResolutions.get(effectiveCwd);
    if (pending) return await pending;

    const resolution = (async (): Promise<Config> => {
      if (effectiveCwd === (await normalizedStartupCwdPromise)) {
        cache.set(effectiveCwd, {
          config: opts.startupConfig,
          expiresAt: Date.now() + cacheMs,
        });
        return opts.startupConfig;
      }

      const resolved = load(effectiveCwd).config;
      cache.set(effectiveCwd, { config: resolved, expiresAt: Date.now() + cacheMs });
      return resolved;
    })();

    pendingResolutions.set(effectiveCwd, resolution);
    try {
      return await resolution;
    } finally {
      pendingResolutions.delete(effectiveCwd);
    }
  };
}
