'use client';

import { useRef } from 'react';
import { PieceLink } from '@/components/commerce/PieceLink';
import { SaveButton } from '@/components/commerce/SaveButton';
import { Img } from '@/components/media/Img';
import { Video } from '@/components/media/Video';
import { UrduAccent } from '@/components/ui/primitives';
import { formatPrice } from '@/lib/format';
import { requestConcierge } from '@/concierge/bridge';
import { useMaskReveal, useParallax, useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { useChapter } from '@/motion/hooks/useChapter';
import { getProduct } from '@/data';
import type { CollectionChapter, Product, StoryBlock } from '@/data/types';
import { cn } from '@/lib/cn';

function Caption({ product, caption, align = 'left' }: { product: Product; caption?: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('mt-5 flex flex-col gap-2', align === 'right' && 'items-end text-right')}>
      {product.campaign && <p className="micro text-fg-muted">{product.campaign}</p>}
      <p className="font-display text-heading leading-tight text-fg" style={{ fontVariationSettings: '"opsz" 32' }}>
        {product.editorialTitle}
      </p>
      <div className={cn('flex items-center gap-6', align === 'right' && 'flex-row-reverse')}>
        <p className="micro text-fg-2">{formatPrice(product.price)}</p>
        <button
          type="button"
          className="micro text-fg-muted transition-colors hover:text-fg"
          onClick={() => requestConcierge({ mode: 'chat', product: product.slug, submit: 'Tell me about this piece' })}
        >
          Enquire
        </button>
        <SaveButton slug={product.slug} className="-my-2" />
      </div>
      {caption && (
        <p className="mt-2 font-display italic text-small text-fg-muted" style={{ fontVariationSettings: '"opsz" 14' }}>
          {caption}
        </p>
      )}
    </div>
  );
}

export function PieceSolo({ product, scale, caption, world }: { product: Product; scale: 'full' | 'wide'; caption?: string; world?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  useMaskReveal(scope);
  useParallax(scope);
  useRise(scope);
  if (scale === 'full') {
    return (
      <div ref={scope} className="relative" data-world={world}>
        <div className="relative overflow-hidden" data-reveal="bottom">
          <div data-reveal-inner data-parallax="0.1" className="relative" style={{ aspectRatio: '16 / 10', minHeight: '70svh' }}>
            <PieceLink product={product} sizes="100vw" aspect="auto" className="absolute inset-0" />
          </div>
        </div>
        <div className="px-gutter" data-rise>
          <Caption product={product} caption={caption} />
        </div>
      </div>
    );
  }
  return (
    <div ref={scope} className="mx-auto w-[92vw] md:w-[84vw]" data-world={world}>
      <div data-reveal="bottom" className="overflow-hidden">
        <div data-reveal-inner data-parallax="0.08">
          <PieceLink product={product} sizes="84vw" aspect="16 / 10" />
        </div>
      </div>
      <div data-rise>
        <Caption product={product} caption={caption} align="right" />
      </div>
    </div>
  );
}

export function PieceDuet({ pieces, offset, worlds }: { pieces: [Product, Product]; offset: 'left' | 'right'; worlds?: [string | undefined, string | undefined] }) {
  const scope = useRef<HTMLDivElement>(null);
  useMaskReveal(scope);
  useParallax(scope);
  useRise(scope);
  const [a, b] = pieces;
  const large = offset === 'right' ? a : b;
  const small = offset === 'right' ? b : a;
  const largeWorld = offset === 'right' ? worlds?.[0] : worlds?.[1];
  const smallWorld = offset === 'right' ? worlds?.[1] : worlds?.[0];
  return (
    <div ref={scope} className={cn('flex flex-col gap-12 px-gutter md:flex-row md:items-start md:gap-[6vw]', offset === 'left' && 'md:flex-row-reverse')}>
      <div className="w-full md:w-[46vw]" data-world={largeWorld}>
        <div data-reveal={offset === 'right' ? 'left' : 'right'} className="overflow-hidden">
          <div data-reveal-inner data-parallax="0.06">
            <PieceLink product={large} sizes="(min-width:768px) 46vw, 100vw" aspect="4 / 5" />
          </div>
        </div>
        <div data-rise>
          <Caption product={large} />
        </div>
      </div>
      <div className="w-[78vw] self-end md:mt-[22vh] md:w-[30vw] md:self-start" data-world={smallWorld}>
        <div data-reveal="bottom" className="overflow-hidden">
          <div data-reveal-inner data-parallax="0.22">
            <PieceLink product={small} sizes="(min-width:768px) 30vw, 78vw" aspect="4 / 5" />
          </div>
        </div>
        <div data-rise>
          <Caption product={small} align={offset === 'right' ? 'right' : 'left'} />
        </div>
      </div>
    </div>
  );
}

export function Interlude({ lines, image, video, urdu }: { lines: string[]; image?: string; video?: string; urdu?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.12 });
  useMaskReveal(scope);
  useRise(scope);
  return (
    <div ref={scope} className="grid grid-cols-1 items-center gap-12 px-gutter md:grid-cols-[1fr_40vw]">
      <div className="flex flex-col gap-6">
        <p data-split className="display text-display-l opacity-0">
          {lines.map((l, i) => (
            <span key={i} className="block">
              {l}
            </span>
          ))}
        </p>
        {urdu && (
          <div data-rise>
            <UrduAccent text={urdu} className="text-[1.6rem]" />
          </div>
        )}
      </div>
      {(video || image) && (
        <div data-reveal="right" className="relative overflow-hidden" style={{ aspectRatio: video ? '16 / 10' : '4 / 5' }}>
          <div data-reveal-inner className="absolute inset-0 grain">
            {video ? <Video id={video} /> : image ? <Img id={image} sizes="40vw" /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function worldOf(p: Product | undefined) {
  return p?.world;
}

export function StoryChapterView({ chapter, index }: { chapter: CollectionChapter; index: number }) {
  const { ref } = useChapter({ id: 'pieces', theme: chapter.theme });
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  return (
    <section ref={ref} id={`chapter-${chapter.id}`} data-theme={chapter.theme} className="bg-bg py-section text-fg" aria-labelledby={`chapter-${chapter.id}-title`}>
      <div ref={scope} className="mb-16 flex items-baseline gap-6 px-gutter md:mb-24" data-rise>
        <span className="font-display text-display-m leading-none text-fg-2 opacity-70">{chapter.numeral}</span>
        <h2 id={`chapter-${chapter.id}-title`} className="display text-display-m">
          {chapter.title}
        </h2>
        <span className="sr-only">{`Chapter ${index + 1}`}</span>
      </div>
      <div className="flex flex-col gap-[14vh] md:gap-[22vh]">
        {chapter.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </section>
  );
}

function Block({ block }: { block: StoryBlock }) {
  if (block.kind === 'solo') {
    const p = getProduct(block.piece);
    if (!p) return null;
    return <PieceSolo product={p} scale={block.scale} caption={block.caption} world={worldOf(p)} />;
  }
  if (block.kind === 'duet') {
    const a = getProduct(block.pieces[0]);
    const b = getProduct(block.pieces[1]);
    if (!a || !b) return null;
    return <PieceDuet pieces={[a, b]} offset={block.offset} worlds={[worldOf(a), worldOf(b)]} />;
  }
  return <Interlude lines={block.lines} image={block.image} video={block.video} urdu={block.urdu} />;
}
