import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isObject } from '../utils/is-object.ts';
import {
  LAUNCH_CONFIG_NAME,
  LAUNCH_JSON_CANONICAL_ARGS,
  LAUNCH_UI_CHAIN_SENTINEL,
  type LaunchJsonResult,
  scaffoldLaunchJson,
} from './init.ts';

const LEGACY_NPX_UI_FORMS: ReadonlyArray<readonly string[]> = [
  ['@inkeep/open-knowledge', 'ui'],
  ['-y', '@inkeep/open-knowledge', 'ui'],
  LAUNCH_JSON_CANONICAL_ARGS,
];

export type LaunchJsonEntryClassification = 'canonical' | 'legacy-bare' | 'preserved';

export function classifyLaunchJsonEntry(
  entry: Record<string, unknown>,
): LaunchJsonEntryClassification {
  if (entry.runtimeExecutable === '/bin/sh' && Array.isArray(entry.runtimeArgs)) {
    const chain = entry.runtimeArgs[2];
    if (typeof chain === 'string') {
      if (chain.includes(LAUNCH_UI_CHAIN_SENTINEL)) return 'canonical';
      if (/# ok-ui-v\d+/.test(chain)) return 'legacy-bare';
    }
    return 'preserved';
  }
  if (entry.runtimeExecutable === 'npx' && Array.isArray(entry.runtimeArgs)) {
    for (const form of LEGACY_NPX_UI_FORMS) {
      if (argsExactlyMatch(entry.runtimeArgs, form)) return 'legacy-bare';
    }
  }
  return 'preserved';
}

function argsExactlyMatch(actual: readonly unknown[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

export interface LaunchJsonRepairOutcome {
  configPath: string;
  outcome:
    | 'no-file'
    | 'no-entry'
    | 'read-failed'
    | 'canonical'
    | 'preserved'
    | 'repaired'
    | 'write-failed'
    | 'skipped-reclaim-disabled';
  error?: string;
}

export interface LaunchJsonRepairResult {
  outcome: LaunchJsonRepairOutcome;
  repairedCount: 0 | 1;
}

export interface LaunchJsonRepairLogEvent {
  event: string;
  configPath?: string;
  error?: string;
  reason?: string;
}

export interface LaunchJsonRepairContext {
  projectDir: string;
  logger?: (event: LaunchJsonRepairLogEvent) => void;
  reclaimDisableEnv?: string | null;
}

export function repairLaunchJson(ctx: LaunchJsonRepairContext): LaunchJsonRepairResult {
  const logger = ctx.logger ?? defaultLogger;
  const configPath = join(ctx.projectDir, '.claude', 'launch.json');

  if (ctx.reclaimDisableEnv === '1') {
    logger({ event: 'launch-json-repair-skipped', reason: 'reclaim-disabled' });
    return {
      outcome: { configPath, outcome: 'skipped-reclaim-disabled' },
      repairedCount: 0,
    };
  }

  if (!existsSync(configPath)) {
    return { outcome: { configPath, outcome: 'no-file' }, repairedCount: 0 };
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(configPath, 'utf-8').trim();
    parsed = raw ? JSON.parse(raw) : {};
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger({ event: 'launch-json-repair-read-failed', configPath, error });
    return { outcome: { configPath, outcome: 'read-failed', error }, repairedCount: 0 };
  }

  if (!isObject(parsed)) {
    const error = 'launch.json root is not an object';
    logger({ event: 'launch-json-repair-read-failed', configPath, error });
    return {
      outcome: { configPath, outcome: 'read-failed', error },
      repairedCount: 0,
    };
  }

  const configs = parsed.configurations;
  if (!Array.isArray(configs)) {
    return { outcome: { configPath, outcome: 'no-entry' }, repairedCount: 0 };
  }

  const existing = configs.find(
    (c): c is Record<string, unknown> =>
      isObject(c) && (c as Record<string, unknown>).name === LAUNCH_CONFIG_NAME,
  );
  if (!existing) {
    return { outcome: { configPath, outcome: 'no-entry' }, repairedCount: 0 };
  }

  const classification = classifyLaunchJsonEntry(existing);
  if (classification === 'canonical') {
    return { outcome: { configPath, outcome: 'canonical' }, repairedCount: 0 };
  }
  if (classification === 'preserved') {
    return { outcome: { configPath, outcome: 'preserved' }, repairedCount: 0 };
  }

  const writeResult: LaunchJsonResult = scaffoldLaunchJson(ctx.projectDir, { mode: 'published' });
  if (writeResult.action === 'failed') {
    const error = writeResult.error ?? 'unknown write failure';
    logger({ event: 'launch-json-repair-write-failed', configPath, error });
    return { outcome: { configPath, outcome: 'write-failed', error }, repairedCount: 0 };
  }

  logger({ event: 'launch-json-repair-applied', configPath });
  return { outcome: { configPath, outcome: 'repaired' }, repairedCount: 1 };
}

function defaultLogger(event: LaunchJsonRepairLogEvent): void {
  process.stderr.write(`${JSON.stringify(event)}\n`);
}
