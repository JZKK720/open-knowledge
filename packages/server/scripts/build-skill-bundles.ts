#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BundleId } from '../src/build-skill-zip.ts';

export const BUNDLE_IDS = ['discovery', 'project'] as const satisfies readonly BundleId[];

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(SCRIPT_DIR, '..');

export interface SkillBundlePaths {
  readonly skillsDir: string;
  readonly distDir: string;
}

export function defaultPaths(): SkillBundlePaths {
  return {
    skillsDir: join(PKG_ROOT, 'assets', 'skills'),
    distDir: join(PKG_ROOT, 'dist', 'assets', 'skills'),
  };
}

const PLACEHOLDER_RE = /\{\{>\s*_shared\/([A-Za-z0-9._-]+)\s*\}\}/g;

export function composeSkill(
  source: string,
  resolveShared: (name: string) => string,
): { composed: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const composed = source.replace(PLACEHOLDER_RE, (_match, name: string) => {
    if (!placeholders.includes(name)) placeholders.push(name);
    return resolveShared(name);
  });
  return { composed, placeholders };
}

function sharedResolver(skillsDir: string): (name: string) => string {
  const sharedDir = join(skillsDir, '_shared');
  return (name: string) => {
    const sharedPath = join(sharedDir, name);
    if (!existsSync(sharedPath)) {
      throw new Error(
        `Skill bundle references {{> _shared/${name} }} but ${sharedPath} does not exist.`,
      );
    }
    return readFileSync(sharedPath, 'utf-8');
  };
}

interface ComposedBundle {
  readonly bundle: BundleId;
  readonly composed: string;
  readonly placeholders: string[];
  readonly outputPath: string;
}

export function buildSkillBundles(paths: SkillBundlePaths = defaultPaths()): ComposedBundle[] {
  const resolve = sharedResolver(paths.skillsDir);
  const results: ComposedBundle[] = [];
  for (const bundle of BUNDLE_IDS) {
    const sourcePath = join(paths.skillsDir, bundle, 'SKILL.md');
    const source = readFileSync(sourcePath, 'utf-8');
    const { composed, placeholders } = composeSkill(source, resolve);
    const outputPath = join(paths.distDir, bundle, 'SKILL.md');
    rmSync(join(paths.distDir, bundle), { recursive: true, force: true });
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, composed, 'utf-8');
    results.push({ bundle, composed, placeholders, outputPath });
  }
  return results;
}

interface ByteEqualityResult {
  readonly ok: boolean;
  readonly violations: string[];
}

export function checkSharedContentByteEquality(
  paths: SkillBundlePaths = defaultPaths(),
): ByteEqualityResult {
  const violations: string[] = [];
  const sharedDir = join(paths.skillsDir, '_shared');
  const sharedCache = new Map<string, string>();
  const readShared = (name: string): string => {
    const cached = sharedCache.get(name);
    if (cached !== undefined) return cached;
    const text = readFileSync(join(sharedDir, name), 'utf-8');
    sharedCache.set(name, text);
    return text;
  };

  const composed = new Map<BundleId, { text: string; placeholders: string[] }>();
  for (const bundle of BUNDLE_IDS) {
    const source = readFileSync(join(paths.skillsDir, bundle, 'SKILL.md'), 'utf-8');
    const placeholders: string[] = [];
    composeSkill(source, (name) => {
      if (!placeholders.includes(name)) placeholders.push(name);
      return '';
    });
    for (const name of placeholders) {
      if (!existsSync(join(sharedDir, name))) {
        violations.push(`bundle '${bundle}' references {{> _shared/${name} }} — file is missing`);
      }
    }
    composed.set(bundle, { text: '', placeholders });
  }

  for (const bundle of BUNDLE_IDS) {
    const entry = composed.get(bundle);
    if (!entry) continue;
    const resolvable = entry.placeholders.every((name) => existsSync(join(sharedDir, name)));
    if (!resolvable) continue;
    const source = readFileSync(join(paths.skillsDir, bundle, 'SKILL.md'), 'utf-8');
    const { composed: text } = composeSkill(source, readShared);
    for (const name of entry.placeholders) {
      if (!text.includes(readShared(name))) {
        violations.push(
          `bundle '${bundle}' composed output is not byte-identical to _shared/${name}`,
        );
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

if (import.meta.main) {
  const check = process.argv.includes('--check');
  if (check) {
    const result = checkSharedContentByteEquality();
    if (!result.ok) {
      console.error('[build-skill-bundles] shared-content byte-equality check FAILED:');
      for (const v of result.violations) console.error(`  - ${v}`);
      process.exit(1);
    }
    console.log('[build-skill-bundles] shared-content byte-equality check passed.');
  } else {
    const built = buildSkillBundles();
    for (const b of built) {
      const note =
        b.placeholders.length > 0
          ? ` (resolved ${b.placeholders.length} placeholder(s): ${b.placeholders.join(', ')})`
          : ' (no placeholders)';
      console.log(`[build-skill-bundles] composed ${b.bundle} → ${b.outputPath}${note}`);
    }
  }
}
