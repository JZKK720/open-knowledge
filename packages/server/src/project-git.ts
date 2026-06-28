import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  assertGitAvailable,
  type GitDetected,
  GitNotAvailableError,
  GitTooOldError,
} from './git-preflight.ts';
import { emitPreflightFailureSpan } from './git-preflight-telemetry.ts';
import { getLogger } from './logger.ts';

const execFileAsync = promisify(execFile);
const log = getLogger('project-git');

export class ProjectGitInitError extends Error {
  readonly stderr: string;
  constructor(message: string, stderr = '', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProjectGitInitError';
    this.stderr = stderr;
  }
}

export interface EnsureProjectGitResult {
  didInit: boolean;
  repaired?: boolean;
}

async function isInsideExistingWorkTree(gitBin: string, cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(gitBin, ['rev-parse', '--is-inside-work-tree'], {
      cwd,
    });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export async function ensureProjectGit(projectRoot: string): Promise<EnsureProjectGitResult> {
  const abs = resolve(projectRoot);
  const gitPath = resolve(abs, '.git');
  const headPath = resolve(gitPath, 'HEAD');

  let needsRepair = false;
  if (existsSync(gitPath)) {
    if (!statSync(gitPath).isDirectory()) {
      return { didInit: false };
    }
    if (existsSync(headPath)) {
      return { didInit: false };
    }
    log.info({}, 'detected partial .git/ — running git init to repair');
    needsRepair = true;
  }

  let detected: GitDetected;
  try {
    detected = assertGitAvailable();
  } catch (err) {
    if (err instanceof GitNotAvailableError || err instanceof GitTooOldError) {
      emitPreflightFailureSpan(err);
      log.warn(
        {
          event: 'git_preflight_fail',
          platform: err.platform,
          reason: err instanceof GitTooOldError ? 'too_old' : 'not_available',
          detectedVersion: err instanceof GitTooOldError ? err.detected : '',
        },
        err instanceof GitTooOldError ? 'git binary too old' : 'git binary not found',
      );
    } else {
      log.warn(
        {
          event: 'git_preflight_unexpected_error',
          message: err instanceof Error ? err.message : String(err),
        },
        'unexpected error during git preflight',
      );
    }
    throw err;
  }
  const gitBin = detected.resolvedPath;

  if (!needsRepair && (await isInsideExistingWorkTree(gitBin, abs))) {
    return { didInit: false };
  }

  let stderr = '';
  try {
    const result = await execFileAsync(gitBin, ['init', '--initial-branch=main', abs]);
    stderr = result.stderr ?? '';
  } catch (err) {
    const capturedStderr =
      err !== null && typeof err === 'object' && 'stderr' in err
        ? String((err as { stderr: unknown }).stderr ?? '')
        : '';
    const msg = err instanceof Error ? err.message : String(err);
    throw new ProjectGitInitError(`git init failed at ${abs}: ${msg}`, capturedStderr, {
      cause: err,
    });
  }

  if (!existsSync(headPath)) {
    throw new ProjectGitInitError(
      `git init reported success but ${gitPath}/HEAD is missing (partial init detected)`,
      stderr,
    );
  }

  if (needsRepair) {
    log.info({ path: abs }, 'backfilled missing .git/HEAD');
    return { didInit: true, repaired: true };
  }

  log.info({ path: abs, branch: 'main' }, 'initialized .git/');

  return { didInit: true };
}
