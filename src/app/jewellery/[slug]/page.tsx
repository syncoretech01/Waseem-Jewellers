import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PRODUCTS, getImage, getProduct } from '@/data';
import { ProductExperience } from '@/components/product/ProductExperience';

export const dynamicParams = false;

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  const hero = getImage(product.media.hero);
  return {
    title: `${product.editorialTitle}${product.house ? ` — ${product.house}` : ''}`,
    description: product.story.lede,
    openGraph: { images: hero.src ? [hero.src] : [] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  return <ProductExperience product={product} />;
}
