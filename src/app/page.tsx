import { getRepository } from '@/data/repository';
import { FIGURE_SLUGS } from '@/data/semantic';
import { WORLDS } from '@/data/worlds';
import { Home } from '@/components/home/Home';

/**
 * The homepage is static, and every piece on it comes from the repository at build time —
 * the window, the department trays and the counts are the collection's own, so the page
 * stops being true the moment Waseem withdraws a piece rather than one deploy later.
 */
export default async function HomePage() {
  const repo = getRepository();
  const [showcase, all] = await Promise.all([repo.showcase(), repo.rows()]);
  const bySlug = new Map(all.map((r) => [r.s, r]));
  /**
   * The pieces the chapters look at closely, as rows: each figure is a door, and a door needs
   * the piece's name and published facts beside it. A withdrawn piece simply has no row, and
   * the chapter that would have opened onto it shows its photograph instead.
   */
  const doorSlugs = [...new Set([...FIGURE_SLUGS, ...WORLDS.flatMap((w) => w.pieces), 'royal-wedding-polki-raani-haar', 'diamond-bridal-sapphire-suite', 'gold-bangles-k13798'])];
  const doors = Object.fromEntries(doorSlugs.flatMap((s) => (bySlug.has(s) ? [[s, bySlug.get(s)!]] : [])));
  return <Home showcase={showcase} doors={doors} />;
}
