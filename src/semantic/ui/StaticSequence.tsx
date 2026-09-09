'use client';

import { Img } from '@/components/media/Img';
import type { Region, SemanticDescriptor } from '../types';
import { cn } from '@/lib/cn';

/**
 * The figure with the motion removed — and it still has to teach.
 *
 * This is the acceptance test for the whole family, not a consolation prize. If the lesson
 * only survives in the camera move, then the lesson was the camera move, and that is
 * spectacle wearing a caption. So the static form shows each region as its own frame, in
 * order, with the same words the moving figure would have said.
 *
 * It is what a visitor with reduced motion sees, what a low tier sees, and what anyone sees
 * whose browser is having a bad day.
 */
export function StaticSequence({
  descriptor,
  regions,
  sizes,
  className,
}: {
  descriptor: SemanticDescriptor;
  regions: Region[];
  sizes: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <div className="relative w-full overflow-hidden bg-bg-2" style={{ aspectRatio: '1 / 1' }}>
        <Img image={descriptor.image} sizes={sizes} />
      </div>
      <ol className="flex flex-col gap-6">
        {regions.map((r, i) => (
          <li key={r.key} className="flex items-baseline gap-5">
            <span className="micro shrink-0 text-fg-muted">{String(i + 1).padStart(2, '0')}</span>
            <p className="max-w-[38em] text-[0.9375rem] leading-relaxed text-fg">
              <span className="micro mr-3 text-fg-2">{r.label}</span>
              {r.note}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
