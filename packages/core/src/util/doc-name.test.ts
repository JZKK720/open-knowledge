import { describe, expect, test } from 'bun:test';
import { isValidDocName, validateDocName } from './doc-name.ts';

describe('validateDocName', () => {
  test('accepts ordinary extension-less docNames', () => {
    for (const name of ['notes/meeting', 'foo', 'a/b/c', 'releases/v1.0', 'my notes']) {
      expect(validateDocName(name).ok).toBe(true);
      expect(isValidDocName(name)).toBe(true);
    }
  });

  const REJECTED: Array<[string, string]> = [
    ['', 'empty'],
    ['   ', 'whitespace only'],
    [' foo', 'leading whitespace'],
    ['foo ', 'trailing whitespace'],
    ['.', 'bare dot segment'],
    ['..', 'parent traversal'],
    ['../escape', 'escaping traversal'],
    ['a/', 'trailing slash'],
    ['/abs', 'leading slash'],
    ['a//b', 'doubled slash'],
    ['.foo', 'leading dot (hidden)'],
    ['notes/.bar', 'hidden nested segment'],
    ['x\ty', 'tab control char'],
    ['x\ny', 'newline control char'],
    ['back\\slash', 'backslash'],
  ];

  for (const [name, label] of REJECTED) {
    test(`rejects ${label}: ${JSON.stringify(name)}`, () => {
      const result = validateDocName(name);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
      expect(isValidDocName(name)).toBe(false);
    });
  }
});
