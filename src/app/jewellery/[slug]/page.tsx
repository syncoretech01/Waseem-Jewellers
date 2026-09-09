import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveImage, describe } from '@/data';
import { getRepository } from '@/data/repository';
import { ProductExperience } from '@/components/product/ProductExperience';

export const dynamicParams = false;

/**
 * Only pieces a visitor may meet. A product withheld for want of a name or a category has
 * no page at all — with `dynamicParams = false` its slug 404s, which is the honest answer
 * until Waseem supplies what is missing.
 */
export async function generateStaticParams() {
  const slugs = await getRepository().allSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getRepository().getProduct(slug);
  if (!product) return {};
  const hero = resolveImage(product.media.hero.ref);
  return {
    title: `${product.editorialTitle ?? product.title}${product.campaign ? ` — ${product.campaign}` : ''}`,
    description: product.story?.lede ?? describe(product),
    openGraph: { images: hero.src ? [hero.src] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = getRepository();
  const product = await repo.getProduct(slug);
  if (!product) notFound();
  /**
   * Three relations, each a different question, each answered by the repository rather than
   * by an authored list — ten pieces have companions written for them and 589 do not, so a
   * page that only read `complementary` printed a heading over an empty row.
   */
  const [suite, matching, similar] = await Promise.all([repo.setMembers(slug), repo.matching(slug, 3), repo.similar(slug, 3)]);
  return <ProductExperience product={product} suite={suite} matching={matching} similar={similar} />;
}
