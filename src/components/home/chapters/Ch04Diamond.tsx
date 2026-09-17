'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';
import type { ShowcaseDepartment } from '@/lib/facets';
import { KindsList, PieceCluster } from './showcase';

/**
 * CH04 — Diamond.
 *
 * The same shop, the other tray: on ink, so the pearl plates read as cards laid on velvet.
 * The pieces lead and the words follow; the kinds are the doors and the department is the
 * door. The suite in one light follows as its own chapter.
 */
export function Ch04Diamond({ department }: { department?: ShowcaseDepartment }) {
  const { ref } = useChapter({ id: 'diamond', theme: 'dark' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  if (!department) return null;

  return (
    <section ref={ref} id="ch04-diamond" className="relative bg-ink px-gutter py-[9svh] text-ivory md:py-[12svh]" aria-labelledby="diamond-title">
      <div ref={scope}>
        <div className="grid grid-cols-1 gap-x-[4vw] gap-y-[7svh] md:grid-cols-12 md:items-start">
          {/* the pieces first, on this side */}
          <div className="order-2 md:order-1 md:col-span-8">
            <PieceCluster rows={department.rows} tone="ivory" reverse />
          </div>

          {/* the words, the kinds, the door — on a phone the title leads, the pieces follow, the kinds close */}
          <div className="contents md:top-[calc(var(--nav-h)+4svh)] md:order-2 md:col-span-4 md:flex md:flex-col md:gap-9 md:pl-[2vw] md:[@media(min-height:800px)]:sticky">
            <div className="order-1 flex flex-col gap-4 md:order-none">
              <Eyebrow className="text-champagne">{COPY.departments.diamond.eyebrow}</Eyebrow>
              <h2 id="diamond-title" data-split className="display max-w-[9em] text-[clamp(2rem,3.6vw,3.75rem)] leading-[1.04] text-ivory opacity-0 [text-wrap:balance]">
                {COPY.departments.diamond.title}
              </h2>
              <p className="max-w-[28em] text-[0.9375rem] leading-relaxed text-ivory/70" data-rise>
                {COPY.departments.diamond.line}
              </p>
            </div>
            <div className="order-3 md:order-none">
              <KindsList department={department} tone="ivory" heading={COPY.departments.kinds} />
            </div>
            <div className="order-4 md:order-none" data-rise>
              <Button variant="bracket" href="/diamond" cursor="explore">
                {COPY.departments.diamond.cta}
              </Button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
