import { describe, expect, test } from 'bun:test';
import { computeRevealScrollTop } from './file-tree-scroll';

describe('computeRevealScrollTop', () => {
  const base = { itemHeight: 24, viewportHeight: 240, currentScrollTop: 240 };

  test('returns null when there is no focused row', () => {
    expect(computeRevealScrollTop({ ...base, focusedIndex: -1 })).toBeNull();
  });

  test('returns null when the row is already fully visible', () => {
    expect(computeRevealScrollTop({ ...base, focusedIndex: 12 })).toBeNull();
  });

  test('scrolls up to reveal a row above the viewport', () => {
    expect(computeRevealScrollTop({ ...base, focusedIndex: 2 })).toBe(48);
  });

  test('scrolls down to reveal a row below the viewport', () => {
    expect(computeRevealScrollTop({ ...base, focusedIndex: 30 })).toBe(504);
  });

  test('clamps at 0 when topInset would push the target negative', () => {
    expect(computeRevealScrollTop({ ...base, focusedIndex: 0, topInset: 24 })).toBe(0);
  });

  test('returns null when the computed scrollTop equals the current one', () => {
    expect(computeRevealScrollTop({ ...base, focusedIndex: 10 })).toBeNull();
  });

  test('treats a row occluded by the sticky inset as above the viewport', () => {
    expect(computeRevealScrollTop({ ...base, focusedIndex: 10, topInset: 24 })).toBe(216);
  });
});
