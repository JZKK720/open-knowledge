
import { statSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';

export type CheckDocExistsResult = 'exists' | 'missing' | 'unreadable';

function isSafeProjectPath(projectPath: string): boolean {
  if (typeof projectPath !== 'string') return false;
  if (projectPath.length === 0) return false;
  if (projectPath.includes('\0')) return false;
  if (!isAbsolute(projectPath)) return false;
  if (resolve(projectPath) !== projectPath) return false;
  return true;
}

function isSafeDocPath(docPath: string): boolean {
  if (typeof docPath !== 'string') return false;
  if (docPath.length === 0) return false;
  if (docPath.includes('\0')) return false;
  if (isAbsolute(docPath)) return false;
  const segments = docPath.split(/[/\\]+/);
  if (segments.some((s) => s === '..')) return false;
  return true;
}

function joinContained(projectPath: string, docPath: string): string | null {
  const joined = resolve(join(projectPath, docPath));
  const projectResolved = resolve(projectPath);
  const projectWithSep = projectResolved.endsWith(sep) ? projectResolved : projectResolved + sep;
  if (joined === projectResolved) return joined;
  if (!joined.startsWith(projectWithSep)) return null;
  return joined;
}

export function checkDocExists(projectPath: string, docPath: string): CheckDocExistsResult {
  if (!isSafeProjectPath(projectPath)) return 'unreadable';
  if (!isSafeDocPath(docPath)) return 'unreadable';
  const fullPath = joinContained(projectPath, docPath);
  if (fullPath === null) return 'unreadable';
  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(fullPath);
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: unknown }).code === 'ENOENT'
    ) {
      return 'missing';
    }
    return 'unreadable';
  }
  if (!stat.isFile()) return 'missing';
  return 'exists';
}
