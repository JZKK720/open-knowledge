import { describe, expect, test } from 'bun:test';
import { FM_FENCE_LINE_RE, FRONTMATTER_RE, stripFrontmatter } from '../extensions/frontmatter.ts';
import { normalizeBridge } from './normalize.ts';

const CLEAN = '---\ntitle: x\n---\n\nbody\n';

const FENCE_WHITESPACE_VARIANTS: Array<[string, string]> = [
  ['trailing space on the opening fence', '--- \ntitle: x\n---\n\nbody\n'],
  ['trailing space on the closing fence', '---\ntitle: x\n--- \n\nbody\n'],
  ['trailing tab on the opening fence', '---\t\ntitle: x\n---\n\nbody\n'],
  ['trailing tab on the closing fence', '---\ntitle: x\n---\t\n\nbody\n'],
];

describe('FM partition invariance under bridge tolerance', () => {
  test('precondition: the clean fixture has a recognized FM region', () => {
    expect(stripFrontmatter(CLEAN).frontmatter).toBe('---\ntitle: x\n---\n');
  });

  for (const [name, mutated] of FENCE_WHITESPACE_VARIANTS) {
    test(`${name}: an in-tolerance edit must not break FM recognition`, () => {
      const inTolerance = normalizeBridge(mutated) === normalizeBridge(CLEAN);
      const recognized = stripFrontmatter(mutated).frontmatter !== '';

      expect({ inTolerance, recognized }).not.toEqual({
        inTolerance: true,
        recognized: false,
      });
    });
  }

  test('control: leading space before the opening fence is beyond tolerance', () => {
    const leading = ' ---\ntitle: x\n---\n\nbody\n';
    expect(normalizeBridge(leading)).not.toBe(normalizeBridge(CLEAN));
  });
});

describe('FM fence-line predicate agreement (FM_FENCE_LINE_RE vs FRONTMATTER_RE)', () => {
  const FENCE_LINES = ['---', '--- ', '---\t', '---  \t '];
  const NON_FENCE_LINES = [' ---', '----', '--- x', '---x', '-- -', ''];

  for (const line of FENCE_LINES) {
    test(`fence line ${JSON.stringify(line)}: both predicates recognize`, () => {
      expect(FM_FENCE_LINE_RE.test(line)).toBe(true);
      expect(FRONTMATTER_RE.test(`${line}\ntitle: x\n---\n`)).toBe(true);
    });
  }

  for (const line of NON_FENCE_LINES) {
    test(`non-fence line ${JSON.stringify(line)}: both predicates reject`, () => {
      expect(FM_FENCE_LINE_RE.test(line)).toBe(false);
      expect(FRONTMATTER_RE.test(`${line}\ntitle: x\n---\n`)).toBe(false);
    });
  }
});
