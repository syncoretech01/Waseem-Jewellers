'use client';

import { useRef } from 'react';
import { SemanticFigure } from '@/semantic/SemanticFigure';
import { Img } from '@/components/media/Img';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise } from '@/motion/hooks/useReveals';
import type { SemanticDescriptor } from '@/semantic/types';

/**
 * Look closely — the one place on a product page where motion is asked to teach.
 *
 * It exists only for pieces that have something specific to say. A piece with no descriptor
 * shows its photographs and nothing else, which is the honest state of most of the
 * catalogue: the regions for the rest need Waseem to confirm which part of a piece is which
 * before anyone can write about them.
 */
export function CloseLook({ descriptor, name }: { descriptor: SemanticDescriptor; name: string }) {
  const { ref } = useChapter({ id: 'gallery', theme: 'dark' });
  const scope = useRef<HTMLDivElement>(null);
  useRise(scope);
  const single = descriptor.regions.length === 1;

  return (
    <section ref={ref} data-theme="dark" className="bg-bg py-section text-fg" aria-labelledby="close-look">
      <div ref={scope} className="grid grid-cols-1 gap-12 px-gutter md:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] md:items-center md:gap-gutter">
        <SemanticFigure
          descriptor={descriptor}
          sizes="(min-width: 768px) 56vw, 92vw"
          fallback={
            <div className="relative w-full overflow-hidden bg-bg-2" style={{ aspectRatio: '1 / 1' }}>
              <Img image={descriptor.image} sizes="(min-width: 768px) 56vw, 92vw" />
            </div>
          }
        />
        <div className="flex flex-col gap-5" data-rise>
          <Eyebrow>LOOK CLOSELY</Eyebrow>
          <h2 id="close-look" className="display max-w-[11em] text-display-s leading-tight">
            {descriptor.lede ?? `${name}, closer.`}
          </h2>
          <p className="max-w-[32em] text-[0.8125rem] leading-relaxed text-fg-muted">
            {single
              ? 'One photograph, held close. Nothing here is a rendering — it is the same frame shown at the distance a jeweller would look from.'
              : 'One photograph, and the parts of it named in place. Nothing has been photographed apart, and nothing has been assembled: this is where each part sits in the piece as it was shot.'}
          </p>
        </div>
      </div>
    </section>
  );
}
