'use client';

import { useId } from 'react';
import { CREST, MONOGRAM, CREST_MONOGRAM_VIEWBOX } from './markGeometry';
import { GOLD_STOPS, SPECULAR_STOPS, TONE_FILL, type MarkTone } from './gold';
import { cn } from '@/lib/cn';

export type MarkVariant = 'crest' | 'monogram' | 'crest-monogram';

export interface WaseemMarkProps {
  variant?: MarkVariant;
  tone?: MarkTone;
  /** A string names the mark for assistive technology; null marks it decorative. */
  title?: string | null;
  /**
   * Inline the geometry with addressable groups so it can be drawn and lit.
   * Adds `data-mark` to every part and a stroked twin of each silhouette.
   */
  animatable?: boolean;
  /** Weight of the engraved line, in mark units. 12 matches the artwork's own strokes. */
  drawWeight?: number;
  className?: string;
}

const PART = {
  crest: CREST,
  monogram: MONOGRAM,
} as const;

/**
 * Waseem Jewellers' own mark. The crest is a knotwork medallion — a broken ring with
 * inward-curling volutes, shoulder stars, a triquetra and a pointed finial; the
 * monogram is the WJW ligature beneath it.
 *
 * Geometry is generated from the brand master by scripts/brand (npm run brand), so
 * this file never hand-holds path data. Use `<WaseemLockup>` when the wordmark is
 * wanted too — it lives in its own module so the letterforms stay out of chunks
 * that only show the mark.
 */
export function WaseemMark({ variant = 'crest-monogram', tone = 'gold', title = null, animatable = false, drawWeight = 12, className }: WaseemMarkProps) {
  const uid = useId().replace(/:/g, '');
  const goldId = `wjg-${uid}`;
  const specId = `wjs-${uid}`;
  const both = variant === 'crest-monogram';
  const parts = both ? (['crest', 'monogram'] as const) : ([variant] as const);
  const viewBox = both ? CREST_MONOGRAM_VIEWBOX : PART[variant].viewBox;
  const fill = tone === 'gold' ? `url(#${goldId})` : TONE_FILL[tone];

  return (
    <svg
      viewBox={viewBox}
      className={cn('block', className)}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-waseem-mark={variant}
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
                <stop key={i} offset={s.offset} stopColor={s.color === 'transparent' ? '#fffdf2' : s.color} stopOpacity={s.color === 'transparent' ? 0 : 0.85} />
              ))}
            </linearGradient>
          )}
        </defs>
      )}

      {parts.map((id) => {
        const part = PART[id];
        const at = both ? `translate(${part.offset.x} ${part.offset.y})` : undefined;
        return (
          <g key={id} transform={at} data-mark={id}>
            <path d={part.fill} fill={fill} fillRule="evenodd" data-mark={`${id}-fill`} />
            {animatable && (
              <>
                {/* The stroked twin the ritual draws before the fill arrives, and the band of
                    light that travels through the metal. Both start hidden so the static mark is
                    correct on its own — under reduced motion no timeline ever runs. */}
                <path d={part.fill} fill="none" stroke={fill} strokeWidth={drawWeight} strokeLinecap="round" strokeLinejoin="round" opacity={0} data-mark={`${id}-draw`} />
                {tone === 'gold' && <path d={part.fill} fill={`url(#${specId})`} fillRule="evenodd" opacity={0} data-mark={`${id}-specular`} />}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
