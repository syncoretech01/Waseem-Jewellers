import { getRepository } from '@/data/repository';

/**
 * The index the browser is allowed to have.
 *
 * One row per listable piece — about a hundred bytes each, some 60 kB for the whole shop —
 * against the megabyte the full catalogue costs. It is prerendered at build time, so this is
 * a static file with a route's name rather than a function call, and it is fetched once, on
 * demand, by the two surfaces that genuinely need to look pieces up in the browser: the
 * concierge and the selection ledger.
 *
 * It is projected by the repository from the *merged* catalogue, so it carries the seven
 * pieces an editor's names made listable and the authored slugs of the ten — and it carries
 * nothing else. A piece Waseem has not named is not in here, which is what makes it safe to
 * use as the concierge's existence check.
 */
export const dynamic = 'force-static';

export async function GET() {
  const rows = await getRepository().rows();
  return Response.json(
    { rows, generatedAt: getRepository().generatedAt },
    {
      headers: {
        // the snapshot changes only when the catalogue is rebuilt and redeployed
        'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    },
  );
}
