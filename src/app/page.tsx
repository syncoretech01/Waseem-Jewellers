import { getRepository } from '@/data/repository';
import { VITRINE_ORDER } from '@/data/vitrineOrder';
import { FIGURE_SLUGS } from '@/data/semantic';
import { WORLDS } from '@/data/worlds';
import { Home } from '@/components/home/Home';

/**
 * The homepage is static, and the wall's pieces come from the repository at build time —
 * so the chapter that fronts the collection is fed by the collection rather than by a list
 * of eleven slugs that stops being true the first time Waseem withdraws a piece.
 */
export default async function HomePage() {
  const repo = getRepository();
  const [cuts, departments, slugs, all] = await Promise.all([repo.wallCuts(10), repo.departments(), repo.allSlugs(), repo.rows()]);
  const bySlug = new Map(all.map((r) => [r.s, r]));
  const slider = VITRINE_ORDER.map((s) => bySlug.get(s)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  /**
   * The pieces the chapters look at closely, as rows: each figure is a door, and a door needs
   * the piece's name and published facts beside it. A withdrawn piece simply has no row, and
   * the chapter that would have opened onto it shows its photograph instead.
   */
  const doorSlugs = [...new Set([...FIGURE_SLUGS, ...WORLDS.flatMap((w) => w.pieces)])];
  const doors = Object.fromEntries(doorSlugs.flatMap((s) => (bySlug.has(s) ? [[s, bySlug.get(s)!]] : [])));
  // the three that open the page are the head of the featured order — named, filed, photographed
  return <Home wallCuts={cuts} departments={departments} vitrine={cuts[0]?.rows.slice(0, 3) ?? []} total={slugs.length} slider={slider} doors={doors} />;
}
