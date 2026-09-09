import { getRepository } from '@/data/repository';
import { Home } from '@/components/home/Home';

/**
 * The homepage is static, and the wall's pieces come from the repository at build time —
 * so the chapter that fronts the collection is fed by the collection rather than by a list
 * of eleven slugs that stops being true the first time Waseem withdraws a piece.
 */
export default async function HomePage() {
  const repo = getRepository();
  const [cuts, departments, slugs] = await Promise.all([repo.wallCuts(10), repo.departments(), repo.allSlugs()]);
  // the three that open the page are the head of the featured order — named, filed, photographed
  return <Home wallCuts={cuts} departments={departments} vitrine={cuts[0]?.rows.slice(0, 3) ?? []} total={slugs.length} />;
}
