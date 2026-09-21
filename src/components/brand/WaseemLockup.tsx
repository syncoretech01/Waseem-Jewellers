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
  /**
   * `stacked` is the brand master (crest over ligature over two lines of type, in its own
   * wide frame); `tight` is the same cropped to the drawn bounds; `inline` sets the crest and
   * ligature at the left and the type on one line beside them — the header's lockup, which
   * has to read at 36px.
   */
  layout?: 'stacked' | 'tight' | 'inline';
  /** For the inline layout: both words, or only WASEEM where the width is not there. */
  words?: 'both' | 'first';
  className?: string;
}

const box = (vb: string) => vb.split(' ').map(Number) as [number, number, number, number];

/** The drawn bounds of the stacked lockup — the master's frame has wide margins the header cannot afford. */
const TIGHT_VIEWBOX = (() => {
  const parts = [CREST, MONOGRAM, WORD_1, WORD_2].map((p) => {
    const [, , w, h] = box(p.viewBox);
    return { x0: p.offset.x, y0: p.offset.y, x1: p.offset.x + w, y1: p.offset.y + h };
  });
  const x0 = Math.min(...parts.map((p) => p.x0));
  const y0 = Math.min(...parts.map((p) => p.y0));
  return `${x0} ${y0} ${Math.max(...parts.map((p) => p.x1)) - x0} ${Math.max(...parts.map((p) => p.y1)) - y0}`;
})();

/** The inline layout: crest over ligature at the left, the type on one line at the right, scaled up so its capitals read. */
const INLINE = (() => {
  const [, , cw] = box(CREST.viewBox);
  const [, , mw, mh] = box(MONOGRAM.viewBox);
  const [, , w1, h1] = box(WORD_1.viewBox);
  const [, , w2] = box(WORD_2.viewBox);
  // the crest and the ligature keep their own relation from the master
  const markX0 = Math.min(CREST.offset.x, MONOGRAM.offset.x);
  const markY0 = CREST.offset.y;
  const markW = Math.max(CREST.offset.x + cw, MONOGRAM.offset.x + mw) - markX0;
  const markH = MONOGRAM.offset.y + mh - markY0;
  const gap = 360;
  const scale = 1.5;
  const wordGap = 260;
  const textX = markX0 + markW + gap;
  const textY = markY0 + markH / 2 - (h1 * scale) / 2;
  const width = markW + gap + (w1 + wordGap + w2) * scale;
  return { viewBox: `${markX0} ${markY0} ${width} ${markH}`, firstViewBox: `${markX0} ${markY0} ${markW + gap + w1 * scale} ${markH}`, textX, textY, scale, word2X: textX + (w1 + wordGap) * scale };
})();

/**
 * The full Waseem Jewellers lockup: crest, WJW ligature, and the two-line wordmark.
 *
 * Separate from `<WaseemMark>` because the letterforms are ~10 kB of path data that
 * only this variant needs — keeping them here keeps them out of every chunk that
 * only shows the mark.
 */
export function WaseemLockup({ tone = 'gold', title = 'Waseem Jewellers', animatable = false, drawWeight = 12, wordmarkOnly = false, layout = 'stacked', words = 'both', className }: WaseemLockupProps) {
  const uid = useId().replace(/:/g, '');
  const goldId = `wjlg-${uid}`;
  const specId = `wjls-${uid}`;
  const fill = tone === 'gold' ? `url(#${goldId})` : TONE_FILL[tone];
  const parts = wordmarkOnly
    ? ([['word-1', WORD_1], ['word-2', WORD_2]] as const)
    : ([['crest', CREST], ['monogram', MONOGRAM], ['word-1', WORD_1], ['word-2', WORD_2]] as const);

  const inline = layout === 'inline' && !wordmarkOnly;
  const viewBox = wordmarkOnly
    ? `${WORD_2.offset.x} ${WORD_1.offset.y} ${WORD_2.viewBox.split(' ')[2]} ${WORD_2.offset.y + Number(WORD_2.viewBox.split(' ')[3]) - WORD_1.offset.y}`
    : inline
      ? words === 'first'
        ? INLINE.firstViewBox
        : INLINE.viewBox
      : layout === 'tight'
        ? TIGHT_VIEWBOX
        : LOCKUP_VIEWBOX;
  // where each band sits: the master's offsets, or the inline row's
  const placement = (id: string, part: { offset: { x: number; y: number } }) => {
    if (!inline || id === 'crest' || id === 'monogram') return `translate(${part.offset.x} ${part.offset.y})`;
    const x = id === 'word-1' ? INLINE.textX : INLINE.word2X;
    return `translate(${x} ${INLINE.textY}) scale(${INLINE.scale})`;
  };
  const shown = inline && words === 'first' ? parts.filter(([id]) => id !== 'word-2') : parts;

  return (
    <svg
      viewBox={viewBox}
      className={cn('block', className)}
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-waseem-mark={wordmarkOnly ? 'wordmark' : inline ? 'lockup-inline' : 'lockup'}
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

      {shown.map(([id, part]) => {
        // Only the crest and the ligature are engraved. Every contour is stroked, not just
        // the silhouette — the interior linework is what makes it read as engraving. A word
        // band is set type, not linework, so it rises rather than drawing itself.
        const drawable = id === 'crest' || id === 'monogram';
        return (
          <g key={id} transform={placement(id, part)} data-mark={id}>
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
