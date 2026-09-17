'use client';

import { useRef } from 'react';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';
import type { ShowcaseDepartment } from '@/lib/facets';
import { DepartmentRow } from './showcase';

/**
 * CH07 — Men, and Kids.
 *
 * Two departments that used to be two lines of text at the foot of a wall, each now on the
 * tray every department shares: rings, bracelets and cufflinks for men, then small rings
 * and bangles for children on the mirrored row, each kind and each department a door.
 */
export function Ch07MenKids({ men, kids }: { men?: ShowcaseDepartment; kids?: ShowcaseDepartment }) {
  const { ref } = useChapter({ id: 'menkids', theme: 'ivory' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, {
    selector: '[data-split]',
    type: 'lines',
    stagger: 0.07,
  });
  useRise(scope);
  if (!men && !kids) return null;

  return (
    <section ref={ref} id="ch07-menkids" data-theme="ivory" className="relative bg-ivory px-gutter py-[var(--chapter-y)] text-ink" aria-labelledby="menkids-title">
      <h2 id="menkids-title" className="sr-only">
        Men and Kids
      </h2>
      <div ref={scope} className="wj-content">
        {men && <DepartmentRow department={men} copy={COPY.departments.men} href="/men" titleId="men-title" level="h3" kindsHeading={COPY.departments.kinds} />}
        {kids && (
          <div className={men ? 'mt-[var(--chapter-y)] border-t border-ink/10 pt-[var(--chapter-y)]' : undefined}>
            <DepartmentRow department={kids} copy={COPY.departments.kids} href="/kids" titleId="kids-title" level="h3" reverse kindsHeading={COPY.departments.kinds} />
          </div>
        )}
      </div>
    </section>
  );
}
