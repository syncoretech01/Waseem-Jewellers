'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/primitives';
import { PieceLink } from '@/components/commerce/PieceLink';
import { pieceRefOf } from '@/data/clientIndex';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';
import type { PieceRow, ShowcaseDepartment } from '@/lib/facets';
import { KindsList } from './showcase';
import { kindOf, tagOf } from './Ch02Window';
import { cn } from '@/lib/cn';

function Half({ department, copy, href, align }: { department: ShowcaseDepartment; copy: { eyebrow: string; title: (n: number) => string; line: string; cta: string }; href: string; align: 'left' | 'right' }) {
  const [lead, ...rest] = department.rows;
  const label = (row: PieceRow, size: 'lg' | 'sm') => (
    <div className="mt-3 flex flex-col gap-1">
      <p className="micro text-ink/50">{kindOf(row)}</p>
      <p className={cn('font-display leading-tight text-ink', size === 'lg' ? 'text-[1.1875rem]' : 'text-[0.9375rem]')} style={{ fontVariationSettings: size === 'lg' ? '"opsz" 20' : '"opsz" 14' }}>
        {row.t}
      </p>
      <p className="micro text-ink/55">{tagOf(row)}</p>
    </div>
  );
  return (
    <div className={cn('flex flex-col gap-8 md:gap-10', align === 'right' && 'md:border-l md:border-ink/10 md:pl-[4vw]')}>
      <div className="flex flex-col gap-4">
        <Eyebrow className="text-ink/60">{copy.eyebrow}</Eyebrow>
        <h3 data-split className="display max-w-[9em] text-[clamp(1.75rem,2.8vw,3rem)] leading-[1.06] text-ink opacity-0">
          {copy.title(department.count)}
        </h3>
        <p className="max-w-[26em] text-[0.9375rem] leading-relaxed text-ink/70" data-rise>
          {copy.line}
        </p>
      </div>
      {lead && (
        <div className="grid grid-cols-2 gap-x-[4vw] gap-y-6 md:gap-x-[2vw]">
          <div className="col-span-2 sm:col-span-1" data-rise>
            <PieceLink product={pieceRefOf(lead)} sizes="(min-width: 768px) 20vw, 92vw" aspect="4 / 5" cursor="view">
              {label(lead, 'lg')}
            </PieceLink>
          </div>
          <ul className="col-span-2 grid grid-cols-2 gap-x-[4vw] gap-y-6 sm:col-span-1 md:gap-x-[2vw]" aria-label="More pieces">
            {rest.slice(0, 2).map((row, i) => (
              <li key={row.s} className={cn('col-span-1', i === 1 && 'md:mt-[6svh]')} data-rise>
                <PieceLink product={pieceRefOf(row)} sizes="(min-width: 768px) 9vw, 44vw" aspect="1 / 1" cursor="view">
                  {label(row, 'sm')}
                </PieceLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-end">
        <KindsList department={department} heading={COPY.departments.kinds} />
        <div className="sm:justify-self-end" data-rise>
          <Button variant="bracket" href={href} cursor="explore" size="sm">
            {copy.cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * CH07 — Men, and Kids.
 *
 * Two departments that used to be two lines of text at the foot of a wall. A jeweller with
 * 113 pieces for men and 51 for children says so with the pieces: rings, bracelets and
 * cufflinks on one side, small rings and bangles on the other, each counted and each a door.
 */
export function Ch07MenKids({ men, kids }: { men?: ShowcaseDepartment; kids?: ShowcaseDepartment }) {
  const { ref } = useChapter({ id: 'menkids', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, { selector: '[data-split]', type: 'lines', stagger: 0.07 });
  useRise(scope);
  if (!men && !kids) return null;

  return (
    <section ref={ref} id="ch07-menkids" data-theme="ivory" className="relative bg-ivory px-gutter py-[9svh] text-ink md:py-[12svh]" aria-label="Men and Kids">
      <div ref={scope} className="grid grid-cols-1 gap-y-[12svh] md:grid-cols-2 md:gap-x-[4vw]">
        {men && <Half department={men} copy={COPY.departments.men} href="/men" align="left" />}
        {kids && <Half department={kids} copy={COPY.departments.kids} href="/kids" align="right" />}
      </div>
    </section>
  );
}
