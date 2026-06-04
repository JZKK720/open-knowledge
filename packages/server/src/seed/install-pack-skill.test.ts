import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installPackSkill } from './install-pack-skill.ts';

function setUpEditor(proj: string, editorDir: string): void {
  const platformDir = join(proj, editorDir, 'skills', 'open-knowledge');
  mkdirSync(platformDir, { recursive: true });
  writeFileSync(join(platformDir, 'SKILL.md'), '# platform\n');
}

function tmpProject(): string {
  return mkdtempSync(join(tmpdir(), 'ok-seed-skill-'));
}

describe('installPackSkill', () => {
  test('installs the pack skill next to the platform skill for a set-up editor', () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    const installed = installPackSkill(proj, 'knowledge-base');
    expect(installed).toEqual(['Claude Code']);
    expect(
      existsSync(join(proj, '.claude', 'skills', 'open-knowledge-pack-knowledge-base', 'SKILL.md')),
    ).toBe(true);
  });

  test('installs for every set-up editor (claude + cursor + codex)', () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    setUpEditor(proj, '.cursor');
    setUpEditor(proj, '.agents');
    expect(installPackSkill(proj, 'entity-vault').sort()).toEqual([
      'Claude Code',
      'Codex',
      'Cursor',
    ]);
  });

  test('no-op when no editor is set up (no platform skill present)', () => {
    expect(installPackSkill(tmpProject(), 'knowledge-base')).toEqual([]);
  });

  test('no-op for a pack that ships no skill', () => {
    const proj = tmpProject();
    setUpEditor(proj, '.claude');
    expect(installPackSkill(proj, 'no-such-pack')).toEqual([]);
  });

  test('refuses to install through an editor dir that symlinks outside the project', () => {
    const proj = tmpProject();
    const outside = tmpProject();
    symlinkSync(outside, join(proj, '.claude'));
    mkdirSync(join(outside, 'skills', 'open-knowledge'), { recursive: true });
    writeFileSync(join(outside, 'skills', 'open-knowledge', 'SKILL.md'), '# platform\n');
    expect(installPackSkill(proj, 'knowledge-base')).toEqual([]);
    expect(existsSync(join(outside, 'skills', 'open-knowledge-pack-knowledge-base'))).toBe(false);
  });
});
