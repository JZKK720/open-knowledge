import { join } from 'node:path';
import { scaffoldLaunchJson } from '@inkeep/open-knowledge';

interface LaunchJsonWiringLogger {
  event(payload: { event: string; [key: string]: unknown }): void;
}

const DEFAULT_LOGGER: LaunchJsonWiringLogger = {
  event: (payload) => console.warn(JSON.stringify(payload)),
};

type LaunchJsonRepairResult =
  | { status: 'skipped'; reason: string }
  | { status: 'created'; configPath: string }
  | { status: 'merged'; configPath: string }
  | { status: 'failed'; configPath: string; error: string };

interface CheckAndRepairLaunchJsonOpts {
  projectDir: string;
  executablePath: string;
  isPackaged: boolean;
  platform: 'darwin' | 'win32' | 'linux' | string;
  forceEnv?: string | null | undefined;
  reclaimDisableEnv?: string | null | undefined;
  logger?: LaunchJsonWiringLogger;
}

export async function checkAndRepairLaunchJsonOnProjectOpen(
  opts: CheckAndRepairLaunchJsonOpts,
): Promise<LaunchJsonRepairResult> {
  const {
    projectDir,
    executablePath,
    isPackaged,
    platform,
    forceEnv,
    reclaimDisableEnv,
    logger = DEFAULT_LOGGER,
  } = opts;
  const configPath = join(projectDir, '.claude', 'launch.json');
  if (reclaimDisableEnv === '1') return { status: 'skipped', reason: 'reclaim-disabled' };
  if (platform !== 'darwin') return { status: 'skipped', reason: 'platform' };
  if (!isPackaged && forceEnv !== '1') return { status: 'skipped', reason: 'dev-mode' };
  if (!/\.app\/Contents\/MacOS\/[^/]+$/.test(executablePath)) {
    return { status: 'skipped', reason: 'bad-executable-path' };
  }

  logger.event({ event: 'launch-json-wiring-repair-check-started', configPath });
  const result = scaffoldLaunchJson(projectDir, { mode: 'published' });
  if (result.action === 'failed') {
    logger.event({
      event: 'launch-json-wiring-repair-write-failed',
      configPath,
      error: result.error ?? 'unknown',
    });
    return { status: 'failed', configPath, error: result.error ?? 'unknown' };
  }
  logger.event({
    event:
      result.action === 'created'
        ? 'launch-json-wiring-repair-created'
        : 'launch-json-wiring-repair-merged',
    configPath,
  });
  return { status: result.action, configPath };
}
