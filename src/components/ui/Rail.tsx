'use client';

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { useQualityStore } from '@/state/qualityStore';
import { cn } from '@/lib/cn';

/**
 * A rail: a list that scrolls sideways on a phone and stands as a column from md
 * (`.wj-rail`, src/styles/cards.css). On a phone it runs edge to edge with the gutter folded
 * inside it as padding, and its frame draws a fade over whichever edge still has more to
 * scroll — the page's own paper or ink, so a kind at the edge is softened, never cut in half —
 * and no fade once that end is reached, so the first and the last items stand whole.
 *
 * The frame's two states are measured here and written as `data-start` / `data-end` on the
 * wrapper; the fade itself is CSS. When `active` changes, the item marked `aria-current` is
 * brought to the row's centre — only the row moves, never the page. Nothing else moves:
 * momentum, snapping and the scrollbar's absence are the browser's.
 */
export function Rail({
  ref,
  active,
  className,
  listClassName,
  children,
  ...rest
}: { ref?: Ref<HTMLUListElement>; active?: string | null; className?: string; listClassName?: string; children: ReactNode } & Omit<HTMLAttributes<HTMLUListElement>, 'className' | 'children'>) {
  const reduced = useQualityStore((s) => s.tier === 'REDUCED');
  const [list, setList] = useState<HTMLUListElement | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  // whether the current item has been brought into the row once: the first time is a jump, the rest are glides
  const settled = useRef(false);
  const attach = useCallback(
    (el: HTMLUListElement | null) => {
      setList(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  useEffect(() => {
    if (!list) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const max = list.scrollWidth - list.clientWidth;
      const start = list.scrollLeft <= 1;
      const end = max <= 1 || list.scrollLeft >= max - 1;
      setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    list.addEventListener('scroll', schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(list);
    return () => {
      list.removeEventListener('scroll', schedule);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [list]);

  // the current item is brought into the row: on arrival without motion, on a change with it
  useEffect(() => {
    if (!list || active === undefined) return;
    const item = list.querySelector<HTMLElement>('[aria-current]');
    if (!item || list.scrollWidth <= list.clientWidth + 1) return;
    const box = list.getBoundingClientRect();
    const it = item.getBoundingClientRect();
    const left = list.scrollLeft + (it.left - box.left) - (list.clientWidth - it.width) / 2;
    const first = !settled.current;
    settled.current = true;
    list.scrollTo({ left: Math.max(0, left), behavior: first || reduced ? 'auto' : 'smooth' });
  }, [list, active, reduced]);

  return (
    <div className={cn('wj-rail-wrap', className)} data-start={edges.start ? '1' : '0'} data-end={edges.end ? '1' : '0'}>
      <ul ref={attach} className={cn('wj-rail', listClassName)} {...rest}>
        {children}
      </ul>
    </div>
  );
}
