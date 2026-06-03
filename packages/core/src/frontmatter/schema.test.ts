import { describe, expect, test } from 'bun:test';
import { isFrontmatterValueEmpty } from './schema.ts';

describe('isFrontmatterValueEmpty', () => {
  test('treats null, empty string, and empty array as empty', () => {
    expect(isFrontmatterValueEmpty(null)).toBe(true);
    expect(isFrontmatterValueEmpty('')).toBe(true);
    expect(isFrontmatterValueEmpty([])).toBe(true);
  });

  test('treats `0` and `false` as non-empty (valid stored values)', () => {
    expect(isFrontmatterValueEmpty(0)).toBe(false);
    expect(isFrontmatterValueEmpty(false)).toBe(false);
  });

  test('treats non-empty strings and arrays as non-empty', () => {
    expect(isFrontmatterValueEmpty('x')).toBe(false);
    expect(isFrontmatterValueEmpty(' ')).toBe(false); // whitespace counts as content
    expect(isFrontmatterValueEmpty(['a'])).toBe(false);
  });

  test('treats other primitives as non-empty', () => {
    expect(isFrontmatterValueEmpty(42)).toBe(false);
    expect(isFrontmatterValueEmpty(true)).toBe(false);
  });
});
