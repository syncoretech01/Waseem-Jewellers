'use client';

import { useId } from 'react';
import { CREST, MONOGRAM, LOCKUP_VIEWBOX } from './markGeometry';
import { WORD_1, WORD_2 } from './wordmarkGeometry';
import { GOLD_STOPS, SPECULAR_STOPS, TONE_FILL, type MarkTone } from './gold';
import { cn } from '@/lib/cn';

export interface WaseemLockupProps {
  tone?: MarkTone;
  title?: string | null;
  /** Inline addressable groups for the loading ritual: crest, ligature, two word lines. */
  animatable?: boolean;
  /** Weight of the engraved line, in mark units. 12 matches the artwork's own strokes. */
  drawWeight?: number;
  /** Drop the crest and ligature and set only the two lines of type. */
  wordmarkOnly?: boolean;
  className?: string;
}

/**
 * The full Waseem Jewellers lockup: crest, WJW ligature, and the two-line wordmark.
 *
 * Separate from `<WaseemMark>` because the letterforms are ~10 kB of path data that
 * only this variant needs — keeping them here keeps them out of every chunk that
 * only shows the mark.
 */
export function WaseemLockup({ tone = 'gold', title = 'Waseem Jewellers', animatable = false, drawWeight = 12, wordmarkOnly = false, className }: WaseemLockupProps) {
  const uid = useId().replace(/:/g, '');
  const goldId = `wjlg-${uid}`;
  const specId = `wjls-${uid}`;
  const fill = tone === 'gold' ? `url(#${goldId})` : TONE_FILL[tone];
  const parts = wordmarkOnly
    ? ([['word-1', WORD_1], ['word-2', WORD_2]] as const)
    : ([['crest', CREST], ['monogram', MONOGRAM], ['word-1', WORD_1], ['word-2', WORD_2]] as const);

  const viewBox = wordmarkOnly
    ? `${WORD_2.offset.x} ${WORD_1.offset.y} ${WORD_2.viewBox.split(' ')[2]} ${WORD_2.offset.y + Number(WORD_2.viewBox.split(' ')[3]) - WORD_1.offset.y}`
    : LOCKUP_VIEWBOX;

  return (
    <svg
      viewBox={viewBox}
      className={cn('block', className)}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-waseem-mark={wordmarkOnly ? 'wordmark' : 'lockup'}
    >
      {title ? <title>{title}</title> : null}
      {tone === 'gold' && (
        <defs>
          <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="0.35">
            {GOLD_STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          {animatable && (
            <linearGradient id={specId} x1="0" y1="0" x2="1" y2="0" gradientTransform="translate(-1.2 0)" data-mark="specular">
              {SPECULAR_STOPS.map((s, i) => (
                <stop key={i} offset={s.offset} stopColor="#fffdf2" stopOpacity={s.color === 'transparent' ? 0 : 0.85} />
              ))}
            </linearGradient>
          )}
        </defs>
      )}

      {parts.map(([id, part]) => {
        // Only the crest and the ligature are engraved. Every contour is stroked, not just
        // the silhouette — the interior linework is what makes it read as engraving. A word
        // band is set type, not linework, so it rises rather than drawing itself.
        const drawable = id === 'crest' || id === 'monogram';
        return (
          <g key={id} transform={`translate(${part.offset.x} ${part.offset.y})`} data-mark={id}>
            <path d={part.fill} fill={fill} fillRule="evenodd" data-mark={`${id}-fill`} />
            {animatable && (
              <>
                {drawable && (
                  <path d={part.fill} fill="none" stroke={fill} strokeWidth={drawWeight} strokeLinecap="round" strokeLinejoin="round" opacity={0} data-mark={`${id}-draw`} />
                )}
                {tone === 'gold' && <path d={part.fill} fill={`url(#${specId})`} fillRule="evenodd" opacity={0} data-mark={`${id}-specular`} />}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
