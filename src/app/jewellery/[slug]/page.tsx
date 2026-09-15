import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveImage, describe, nameOf } from '@/data';
import type { Product } from '@/data/types';
import { getRepository, toRow } from '@/data/repository';
import { ProductExperience } from '@/components/product/ProductExperience';
import { siteUrl } from '@/lib/siteUrl';

/** The same base `metadataBase` uses, so a canonical and a JSON-LD url can never disagree. */
const SITE_URL = siteUrl();

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
    title: `${nameOf(product)}${product.campaign ? ` — ${product.campaign}` : ''}`,
    // `story.lede` exists on ten pieces; the rest get a sentence built only from what the
    // shop publishes, so no description is ever a paraphrase of nothing
    description: product.story?.lede ?? describe(product),
    alternates: { canonical: `/jewellery/${product.slug}` },
    openGraph: { images: hero.src ? [hero.src] : [] },
  };
}

/**
 * Structured data, kept as honest as the page.
 *
 * No `offers` block where the price is on request — 583 of 599 pieces have no price, and
 * emitting a zero or a placeholder would misrepresent them to every aggregator that reads
 * this. Where a price does exist it carries its own `priceValidUntil`, because gold moves
 * daily and a snapshot presented as current is a commercial risk to Waseem.
 */
function productJsonLd(product: Product, url: string) {
  const hero = resolveImage(product.media.hero.ref);
  const spec = product.spec;
  const properties = [
    spec.purity && { '@type': 'PropertyValue', name: 'Purity', value: spec.purity },
    spec.grossWeightGrams !== undefined && { '@type': 'PropertyValue', name: 'Gross weight', value: `${spec.grossWeightGrams} g` },
    spec.diamondCarat !== undefined && { '@type': 'PropertyValue', name: 'Diamond carat', value: `${spec.diamondCarat} ct` },
    spec.diamondClarity && { '@type': 'PropertyValue', name: 'Clarity', value: spec.diamondClarity },
    spec.diamondColour && { '@type': 'PropertyValue', name: 'Diamond colour', value: spec.diamondColour },
  ].filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: nameOf(product),
    description: product.story?.lede ?? describe(product),
    url,
    ...(hero.src ? { image: [hero.src] } : {}),
    ...(product.reference ? { sku: product.reference } : {}),
    brand: { '@type': 'Brand', name: 'Waseem Jewellers' },
    ...(product.material ? { material: product.material } : {}),
    ...(properties.length ? { additionalProperty: properties } : {}),
    ...(product.price.kind === 'fixed'
      ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'PKR',
            price: product.price.pkr,
            priceValidUntil: product.price.asOf,
            availability: 'https://schema.org/InStoreOnly',
            url,
          },
        }
      : {}),
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
  const rows = { suite: suite.map(toRow), matching: matching.map(toRow), similar: similar.map(toRow) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(product, `${SITE_URL}/jewellery/${product.slug}`)) }} />
      <ProductExperience product={product} suite={rows.suite} matching={rows.matching} similar={rows.similar} />
    </>
  );
}
