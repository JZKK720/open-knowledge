import { describe, expect, test } from 'bun:test';
import { STABLE_CACHE_CONTROL, STABLE_DMG_URL } from '../../../lib/download-links.ts';
import { GET } from './route.ts';

describe('GET /download/stable', () => {
  test('302 to the stable DMG URL with CDN-cacheable headers', () => {
    const res = GET();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(STABLE_DMG_URL);
    expect(res.headers.get('cache-control')).toBe(STABLE_CACHE_CONTROL);
  });
});
