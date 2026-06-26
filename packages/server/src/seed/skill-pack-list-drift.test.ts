import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STARTER_PACK_IDS } from './starter.ts';

const SKILL_PATH = join(import.meta.dir, '../../assets/skills/project/SKILL.md');
const PACK_BULLET_RE = /^- `([a-z][a-z0-9-]+)` —/gm;

describe('project SKILL.md starter-pack awareness list', () => {
  test('lists exactly the packs in STARTER_PACK_IDS (drift guard)', () => {
    const skill = readFileSync(SKILL_PATH, 'utf-8');
    const listed = [...skill.matchAll(PACK_BULLET_RE)].map((m) => m[1]);
    expect(listed.length).toBeGreaterThan(0);
    expect(new Set(listed)).toEqual(new Set(STARTER_PACK_IDS));
  });

  test('points the agent at the reference ladder (--list-packs → --dry-run)', () => {
    const skill = readFileSync(SKILL_PATH, 'utf-8');
    expect(skill).toContain('ok seed --list-packs');
    expect(skill).toContain('--dry-run');
  });
});
