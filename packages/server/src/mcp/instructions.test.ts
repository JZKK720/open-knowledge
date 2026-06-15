import { test as _bunTest, expect } from 'bun:test';

const test = process.env.CI ? _bunTest.skip : _bunTest;

import { type Config, ConfigSchema } from '../config/schema.ts';
import { buildInstructions } from './instructions.ts';

function defaultContent(): Config['content'] {
  return ConfigSchema.parse({}).content;
}

test('buildInstructions carries the STOP rule on native tools for in-scope markdown', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('STOP');
  expect(text).toContain('Open Knowledge MCP configured');
  expect(text).toContain('write');
  expect(text).toContain('edit');
});

test('buildInstructions carries the preview-attach rule', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('Preview');
  expect(text).toContain('attach-preview-once');
  expect(text).toContain('previewUrl');
});

test('buildInstructions carries the autoOpen directional bullet', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('Honor `autoOpen`** (on `preview_url`, or on `warning` for write tools)');
  expect(text).toContain('do not open or refresh any preview UI');
});

test('buildInstructions carries the end-of-turn deliverable-navigation rule', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('End a turn on the deliverable');
  expect(text).toContain('navigate the preview to the primary deliverable');
});

test('buildInstructions routes by browser-tool capability, not by host name (PRD-6761)', () => {
  const text = buildInstructions(defaultContent());
  expect(text).not.toContain('Codex CLI, which has no embedded browser');
  expect(text).toContain('built-in browser');
  expect(text).toContain('navigate to a URL');
  expect(text).toContain('use the in-app branch above');
});

test('buildInstructions points readers at the bundled open-knowledge skill for full guidance', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('open-knowledge');
  expect(text).toContain('skill');
  expect(text).toContain('~/.ok/skills/open-knowledge/SKILL.md');
});

test('buildInstructions documents the read tool routing (exec / search)', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('## Reads');
  expect(text).toContain('exec(');
  expect(text).toContain('search');
  expect(text).toContain('grep'); // still mentioned via `exec("grep -rn …")` example
});

test('buildInstructions surfaces an explicit native-tool escape hatch', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('Escape hatch');
  expect(text).toContain('Open Knowledge MCP unavailable:');
});

test('buildInstructions surfaces the scope-recap section pointing at .okignore', () => {
  const text = buildInstructions(defaultContent());
  expect(text).toContain('## Scope recap');
  expect(text).toContain('.okignore');
  expect(text).toContain('content.dir');
});

test('buildInstructions leads with the identity prefix', () => {
  const text = buildInstructions(defaultContent());
  expect(text.startsWith('Open Knowledge is a markdown-CRDT knowledge base exposed via MCP.')).toBe(
    true,
  );
});

test('buildInstructions exceeds the legacy 2 KB Claude Code cap (generator emits a warning; see generate-instructions.test.ts)', () => {
  const text = buildInstructions(defaultContent());
  const bytes = Buffer.byteLength(text, 'utf8');
  expect(bytes).toBeGreaterThan(2048);
  expect(bytes).toBeLessThan(13776);
});
