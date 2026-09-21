'use client';

import { useRef } from 'react';
import { useChapter } from '@/motion/hooks/useChapter';
import { useRise, useSplitReveal } from '@/motion/hooks/useReveals';
import { COPY } from '@/data/copy';
import type { ShowcaseDepartment } from '@/lib/facets';
import { DepartmentRow } from './showcase';

/**
 * CH04 — Diamond.
 *
 * The same shop, the other tray: on ink, so the pearl plates read as cards laid on velvet.
 * The pieces lead and the words follow — the gold row mirrored; the kinds are the doors and
 * the department is the door. The suite in one light follows as its own chapter.
 */
export function Ch04Diamond({ department }: { department?: ShowcaseDepartment }) {
  const { ref } = useChapter({ id: 'diamond', theme: 'dark' });
  const scope = useRef<HTMLDivElement>(null);
  useSplitReveal(scope, {
    selector: '[data-split]',
    type: 'lines',
    stagger: 0.07,
  });
  useRise(scope);
  if (!department) return null;

  return (
    <section ref={ref} id="ch04-diamond" className="relative bg-ink px-gutter pt-[var(--chapter-pt)] pb-[var(--chapter-y)] text-ivory" aria-labelledby="diamond-title">
      <div ref={scope} className="wj-content">
        <DepartmentRow department={department} copy={COPY.departments.diamond} href="/diamond" tone="ivory" reverse titleId="diamond-title" kindsHeading={COPY.departments.kinds} />
      </div>
    </section>
  );
}
