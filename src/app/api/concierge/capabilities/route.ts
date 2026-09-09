import { modelIsConfigured } from '@/server/env';

/**
 * What the concierge is allowed to be, today, on this deployment.
 *
 * The client cannot answer this for itself. A `NEXT_PUBLIC_` flag is inlined into the bundle
 * at build time, so switching the model on would mean rebuilding — and the requirement is
 * that adding one server variable and redeploying the *same build* activates it. So the
 * server decides and the client asks, once, when the panel first opens.
 *
 * The bundle is byte-identical whether the key is present or not. That is what makes shipping
 * the model dark meaningful rather than notional.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    {
      intelligence: modelIsConfigured() ? 'model' : 'keyless',
      /** The languages the keyless engine owns outright; the model widens the phrasing, not the list. */
      languages: ['en', 'ur', 'ur-Latn', 'pa-Arab', 'pa-Guru'],
      voice: 'browser',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
