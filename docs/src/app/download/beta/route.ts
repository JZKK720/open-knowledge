import { createBetaResolver, toRedirectResponse } from '@/lib/download-links';

export const dynamic = 'force-dynamic';

const resolveBetaRedirect = createBetaResolver();

export async function GET(): Promise<Response> {
  const redirect = await resolveBetaRedirect();
  if (redirect.kind === 'stale-lkg') {
    console.warn(
      `[download/beta] serving stale LKG after refresh failure: ${redirect.refreshError}`,
    );
  }
  if (redirect.kind === 'fallback') {
    console.error(`[download/beta] falling back to releases page: ${redirect.cause}`);
  }
  return toRedirectResponse(redirect);
}
