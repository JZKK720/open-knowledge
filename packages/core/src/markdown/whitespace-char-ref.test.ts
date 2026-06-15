import { describe, expect, test } from 'bun:test';
import {
  decodeInlineWhitespaceNumericCharRef,
  decodeInlineWhitespaceNumericCharRefRun,
  isInlineWhitespaceNumericCharRef,
} from './whitespace-char-ref.ts';

describe('isInlineWhitespaceNumericCharRef', () => {
  test('true for space + tab numeric refs (hex + decimal, X case)', () => {
    for (const ref of ['&#x20;', '&#X20;', '&#32;', '&#x9;', '&#X9;', '&#9;', '&#x09;']) {
      expect(isInlineWhitespaceNumericCharRef(ref)).toBe(true);
    }
  });

  test('false for vertical whitespace (newline / CR / VT / FF)', () => {
    for (const ref of ['&#xA;', '&#10;', '&#xD;', '&#13;', '&#xB;', '&#xC;']) {
      expect(isInlineWhitespaceNumericCharRef(ref)).toBe(false);
    }
  });

  test('false for non-whitespace numeric refs', () => {
    for (const ref of ['&#x41;', '&#65;', '&#x26;', '&#x2003;' /* em space */]) {
      expect(isInlineWhitespaceNumericCharRef(ref)).toBe(false);
    }
  });

  test('false for named refs and malformed input', () => {
    for (const ref of ['&amp;', '&nbsp;', '&#x20', '#x20;', '&#;', '&#xZZ;', '&#x20;x', '', ' ']) {
      expect(isInlineWhitespaceNumericCharRef(ref)).toBe(false);
    }
  });
});

describe('decodeInlineWhitespaceNumericCharRef', () => {
  test('decodes space + tab forms to the real character', () => {
    expect(decodeInlineWhitespaceNumericCharRef('&#x20;')).toBe(' ');
    expect(decodeInlineWhitespaceNumericCharRef('&#32;')).toBe(' ');
    expect(decodeInlineWhitespaceNumericCharRef('&#x9;')).toBe('\t');
    expect(decodeInlineWhitespaceNumericCharRef('&#9;')).toBe('\t');
  });

  test('returns null for everything that is not an inline-whitespace numeric ref', () => {
    for (const ref of ['&#xA;', '&#x41;', '&amp;', '&#x20', 'plain', '']) {
      expect(decodeInlineWhitespaceNumericCharRef(ref)).toBeNull();
    }
  });
});

describe('decodeInlineWhitespaceNumericCharRefRun', () => {
  test('decodes a single ref (run of one)', () => {
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;')).toBe(' ');
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x9;')).toBe('\t');
  });

  test('decodes a run of back-to-back whitespace refs', () => {
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;&#x20;')).toBe('  ');
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x9;&#x9;')).toBe('\t\t');
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;&#x9;&#x20;')).toBe(' \t ');
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;&#32;')).toBe('  '); // hex + decimal
  });

  test('returns null when ANY member is not inline whitespace', () => {
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;&#xA;')).toBeNull(); // newline member
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;&#x41;')).toBeNull(); // letter member
  });

  test('returns null for any gap, embedded, or trailing non-ref bytes', () => {
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20; &#x20;')).toBeNull(); // literal space gap
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;x&#x20;')).toBeNull();
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;<script>')).toBeNull();
    expect(decodeInlineWhitespaceNumericCharRefRun('x&#x20;')).toBeNull();
    expect(decodeInlineWhitespaceNumericCharRefRun('&#x20;extra')).toBeNull();
    expect(decodeInlineWhitespaceNumericCharRefRun('')).toBeNull();
    expect(decodeInlineWhitespaceNumericCharRefRun('   ')).toBeNull();
  });
});
