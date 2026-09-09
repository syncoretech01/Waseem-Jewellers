import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { COLLECTIONS, getCollection, getImage } from '@/data';
import { getRepository } from '@/data/repository';
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
    title: collection.name,
    description: collection.intro[0],
    openGraph: { images: still.src ? [still.src] : [] },
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();
  // the story's pieces, resolved here so the browser needs no catalogue to draw it
  const all = await getRepository().rows();
  const wanted = new Set([...collection.pieces, ...collection.wornTogether, ...collection.chapters.flatMap((c) => c.blocks.flatMap((b) => (b.kind === 'solo' ? [b.piece] : b.kind === 'duet' ? b.pieces : [])))]);
  return <CollectionExperience collection={collection} rows={all.filter((r) => wanted.has(r.s))} />;
}
