import { describe, expect, test } from 'bun:test';
import { FrontmatterArg } from './verb-schemas.ts';

describe('FrontmatterArg — recursive value contract (PRD-6947)', () => {
  test('flat scalar values still parse (regression guard for the pre-PRD-6947 contract)', () => {
    const result = FrontmatterArg.safeParse({
      title: 'Q3 Planning',
      done: true,
      score: 0.95,
      tags: ['planning', 'q3'],
    });
    expect(result.success).toBe(true);
  });

  test('nested-object value at a top-level key parses', () => {
    const result = FrontmatterArg.safeParse({
      metadata: { version: '1.0.0', author: 'Inkeep' },
    });
    expect(result.success).toBe(true);
  });

  test('arbitrarily deep nesting (map in map in map) parses', () => {
    const result = FrontmatterArg.safeParse({
      metadata: { outer: { inner: { leaf: 'deep' } } },
    });
    expect(result.success).toBe(true);
  });

  test('array-of-objects value parses; element objects pass through unchanged (NOT String()-coerced)', () => {
    const input = {
      plugins: [
        { name: 'alpha', version: '1.0' },
        { name: 'beta', version: '2.0' },
      ],
    };
    const result = FrontmatterArg.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  test('top-level null parses (RFC 7396 delete sentinel preserved)', () => {
    const result = FrontmatterArg.safeParse({ metadata: null });
    expect(result.success).toBe(true);
  });

  test('nested null INSIDE a subtree is rejected (D9: wire stays additive, no path syntax)', () => {
    const result = FrontmatterArg.safeParse({ metadata: { version: null } });
    expect(result.success).toBe(false);
  });

  test('mixed flat + nested keys in one patch parse together', () => {
    const result = FrontmatterArg.safeParse({
      title: 'Skill',
      tags: ['demo'],
      metadata: { version: '1.0.0', author: 'Inkeep' },
    });
    expect(result.success).toBe(true);
  });

  test('description text reflects recursive value contract (no stale "flat mapping" claim)', () => {
    const description = FrontmatterArg.description ?? '';
    expect(description).toContain('nested');
    expect(description).not.toContain('flat key→value');
  });
});
