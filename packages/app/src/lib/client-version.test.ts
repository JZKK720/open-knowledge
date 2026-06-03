import { describe, expect, test } from 'bun:test';
import {
  BROWSER_RUNTIME_VERSION,
  browserClientVersionHeaders,
  browserClientVersionTokenFields,
} from './client-version.ts';

describe('browser client-version reader', () => {
  test('headers carry kind=web and the resolved runtime', () => {
    expect(browserClientVersionHeaders()).toEqual({
      'x-ok-client-protocol': '1',
      'x-ok-client-runtime': BROWSER_RUNTIME_VERSION,
      'x-ok-client-kind': 'web',
    });
  });

  test('token fields carry kind=web with a numeric protocol', () => {
    const fields = browserClientVersionTokenFields();
    expect(fields).toEqual({
      clientProtocolVersion: 1,
      clientRuntimeVersion: BROWSER_RUNTIME_VERSION,
      clientKind: 'web',
    });
    expect(typeof fields.clientProtocolVersion).toBe('number');
  });

  test('runtime resolves to a non-empty string', () => {
    expect(typeof BROWSER_RUNTIME_VERSION).toBe('string');
    expect(BROWSER_RUNTIME_VERSION.length).toBeGreaterThan(0);
  });
});
