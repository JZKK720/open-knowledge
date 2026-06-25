import { describe, expect, mock, test } from 'bun:test';
import {
  type BetaRedirect,
  DMG_ASSET_NAME,
  FALLBACK_CACHE_CONTROL,
  RELEASES_PAGE_URL,
  SUCCESS_CACHE_CONTROL,
} from '../../../lib/download-links.ts';

const TEST_DMG_URL = `https://github.com/inkeep/open-knowledge/releases/download/v0.1.0-beta.1/${DMG_ASSET_NAME}`;

let _redirect: BetaRedirect = { kind: 'fresh', url: TEST_DMG_URL };

mock.module('../../../lib/download-links.ts', () => ({
  createBetaResolver: () => () => Promise.resolve(_redirect),
  toRedirectResponse: (r: BetaRedirect): Response =>
    new Response(null, {
      status: 302,
      headers: {
        location: r.url,
        'cache-control': r.kind === 'fallback' ? FALLBACK_CACHE_CONTROL : SUCCESS_CACHE_CONTROL,
      },
    }),
}));

const { GET } = await import('./route.ts');

describe('GET /download/beta', () => {
  test('302 to the fresh beta URL with CDN-cacheable headers', async () => {
    _redirect = { kind: 'fresh', url: TEST_DMG_URL };
    const res = await GET();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(TEST_DMG_URL);
    expect(res.headers.get('cache-control')).toBe(SUCCESS_CACHE_CONTROL);
  });

  test('302 to the stale LKG URL with CDN-cacheable headers', async () => {
    _redirect = { kind: 'stale-lkg', url: TEST_DMG_URL, refreshError: 'network down' };
    const res = await GET();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(TEST_DMG_URL);
    expect(res.headers.get('cache-control')).toBe(SUCCESS_CACHE_CONTROL);
  });

  test('302 to the releases page uncached on fallback', async () => {
    _redirect = { kind: 'fallback', url: RELEASES_PAGE_URL, cause: 'API error' };
    const res = await GET();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(RELEASES_PAGE_URL);
    expect(res.headers.get('cache-control')).toBe(FALLBACK_CACHE_CONTROL);
  });
});
