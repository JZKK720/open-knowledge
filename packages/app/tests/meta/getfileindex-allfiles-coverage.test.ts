import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SERVER_SRC_ROOT = join(import.meta.dirname, '../../../server/src');
const API_EXT_PATH = join(SERVER_SRC_ROOT, 'api-extension.ts');
const FILE_WATCHER_PATH = join(SERVER_SRC_ROOT, 'file-watcher.ts');
const SERVER_FACTORY_PATH = join(SERVER_SRC_ROOT, 'server-factory.ts');

const ALLOWLISTED_SITES: ReadonlySet<string> = new Set<string>([
  'applyDiskEventToLiveAllFilesIndex',
  'buildWorkspaceSearchDocumentsFromIndex',
  'workspaceSearchFingerprint',
  'deriveFolderSearchDocuments',
  'handleDocumentList',
]);

function findEnclosingFn(source: string, offset: number): string {
  const fragment = source.slice(0, offset);
  const fnMatches = [...fragment.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)];
  const constMatches = [...fragment.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\S/g)];
  const lastFn = fnMatches.length > 0 ? fnMatches[fnMatches.length - 1] : null;
  const lastConst = constMatches.length > 0 ? constMatches[constMatches.length - 1] : null;

  const fnIdx = lastFn?.index ?? -1;
  const constIdx = lastConst?.index ?? -1;
  if (fnIdx === -1 && constIdx === -1) return '<unknown>';
  if (fnIdx >= constIdx) return lastFn?.[1] ?? '<unknown>';
  return lastConst?.[1] ?? '<unknown>';
}

function windowFiltersOnKind(window: string): boolean {
  return /\.kind\s*(?:===|!==)\s*['"](markdown|file)['"]/.test(window);
}

interface CallSite {
  file: string;
  line: number;
  fn: string;
  window: string;
}

function collectAllFilesCallSites(filePath: string): CallSite[] {
  const source = readFileSync(filePath, 'utf8');
  const sites: CallSite[] = [];
  for (const match of source.matchAll(/getAllFilesIndex\s*\(/g)) {
    const offset = match.index ?? 0;
    const line = source.slice(0, offset).split('\n').length;
    const fn = findEnclosingFn(source, offset);
    const window = source.slice(Math.max(0, offset - 600), Math.min(source.length, offset + 600));
    sites.push({ file: filePath, line, fn, window });
  }
  return sites;
}

function listProductionTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listProductionTsFiles(full));
    } else if (st.isFile() && entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('PRD-7117 US-002 — getAllFilesIndex caller coverage (D12 §13-A)', () => {
  test('every getAllFilesIndex() call site in api-extension.ts is allowlisted or kind-filtered', () => {
    const sites = collectAllFilesCallSites(API_EXT_PATH);
    const failures: string[] = [];
    for (const site of sites) {
      const allowed = ALLOWLISTED_SITES.has(site.fn);
      const filtered = windowFiltersOnKind(site.window);
      if (!allowed && !filtered) {
        failures.push(
          `${site.file}:${site.line} — enclosing fn "${site.fn}" is neither on ALLOWLISTED_SITES nor narrows on \`.kind\`. ` +
            'A new getAllFilesIndex() consumer must be added to ALLOWLISTED_SITES (with rationale) ' +
            'OR must structurally guard via `entry.kind === "markdown"` / similar inside the call site.',
        );
      }
    }
    expect(failures).toEqual([]);
  });

  test('getAllFilesIndex() is not called from any other server-side production file', () => {
    const allowedFiles = new Set([FILE_WATCHER_PATH, API_EXT_PATH, SERVER_FACTORY_PATH]);
    const offenders: string[] = [];
    for (const file of listProductionTsFiles(SERVER_SRC_ROOT)) {
      if (allowedFiles.has(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (/getAllFilesIndex\s*\(/.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('ALLOWLISTED_SITES function names actually exist in api-extension.ts', () => {
    const source = readFileSync(API_EXT_PATH, 'utf8');
    const missing: string[] = [];
    for (const name of ALLOWLISTED_SITES) {
      const fnRe = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
      const constRe = new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\S`);
      if (!fnRe.test(source) && !constRe.test(source)) {
        missing.push(
          `${name}: function declaration not found in api-extension.ts — either rename/remove dropped the site, ` +
            'or the allowlist entry is stale.',
        );
      }
    }
    expect(missing).toEqual([]);
  });
});
