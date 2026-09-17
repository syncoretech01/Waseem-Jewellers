'use client';

import { useId } from 'react';
import { CREST } from '@/components/brand/markGeometry';
import { SPECULAR_STOPS } from '@/components/brand/gold';

/**
 * The engraved line's weight for a crest set at 22–26px, in mark units. The artwork's own
 * strokes are 12, which is half a pixel at this size and vanishes; 22 is a hairline.
 */
const TRACE_WEIGHT = 22;

/**
 * The ritual's specular band is 16% of the mark wide, which on a 24px crest is four pixels
 * and passes unseen. Spread about its centre it is seven, and reads as light rather than a
 * scratch. The stops are the brand's; only their spacing changes.
 */
const BAND_SPREAD = 1.8;
const spread = (offset: number) => Math.min(1, Math.max(0, 0.5 + (offset - 0.5) * BAND_SPREAD));

/**
 * The crest as the trigger wears it: Waseem's own geometry, in the colour of the chapter.
 *
 * `WaseemMark` is the mark everywhere else. It is not used here because its travelling
 * specular band exists only in the gold tone, and the trigger is champagne on the dark chapters
 * and ink on the ivory ones — so the same generated geometry is assembled here with the same
 * `data-mark` vocabulary (`crest`, `crest-fill`, `crest-draw`, `crest-specular`, `specular`)
 * and a `currentColor` fill. Three things differ from the ritual's mark, all for the size:
 * the stroked twin carries `pathLength="100"`, so the thinking trace is a stylesheet keyframe on
 * `stroke-dashoffset` and `getTotalLength()` is never called; its weight is a hairline rather
 * than the artwork's own stroke, which at 24px is invisible; and the specular band is spread
 * wider, for the same reason.
 *
 * The twin and the band ship at `opacity: 0`, so the static mark is correct on its own.
 */
export function OrbCrest({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const specId = `wjos-${uid}`;
  return (
    <svg viewBox={CREST.viewBox} className={className} fill="none" aria-hidden focusable="false" data-waseem-mark="crest">
      <defs>
        <linearGradient id={specId} x1="0" y1="0" x2="1" y2="0" gradientTransform="translate(-1.2 0)" data-mark="specular">
          {SPECULAR_STOPS.map((s, i) => (
            <stop key={i} offset={spread(s.offset)} stopColor={s.color === 'transparent' ? '#fffdf2' : s.color} stopOpacity={s.color === 'transparent' ? 0 : 1} />
          ))}
        </linearGradient>
      </defs>
      <g data-mark="crest">
        <path d={CREST.fill} fill="currentColor" fillRule="evenodd" data-mark="crest-fill" />
        <path d={CREST.fill} fill="none" stroke="currentColor" strokeWidth={TRACE_WEIGHT} strokeLinecap="round" strokeLinejoin="round" pathLength={100} opacity={0} data-mark="crest-draw" />
        <path d={CREST.fill} fill={`url(#${specId})`} fillRule="evenodd" opacity={0} data-mark="crest-specular" />
      </g>
    </svg>
  );
}
