import { STABLE_CACHE_CONTROL, STABLE_DMG_URL } from '@/lib/download-links';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: STABLE_DMG_URL,
      'cache-control': STABLE_CACHE_CONTROL,
    },
  });
}
