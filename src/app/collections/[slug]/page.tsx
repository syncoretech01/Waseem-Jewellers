import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COLLECTIONS, getCollection, getImage } from '@/data';
import { CollectionExperience } from '@/components/collection/CollectionExperience';

export const dynamicParams = false;

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return {};
  const still = getImage(collection.opening.still);
  return {
    title: `The ${collection.name} House`,
    description: collection.intro[0],
    openGraph: { images: still.src ? [still.src] : [] },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();
  return <CollectionExperience collection={collection} />;
}
