'use client';

import { facetOrder, facetPath, linePath, GEM_OUTLINE, GEM_STEPS, GEM_RADIALS } from '@/lib/three/gemGeometry';
import { cn } from '@/lib/cn';

interface LoaderStoneProps {
  className?: string;
  /** CSS custom property on the root drives the fill: `--reveal` 0…1. */
  reveal?: number;
  /** Outline only (bespoke chapter draws it in). */
  outlineOnly?: boolean;
  id?: string;
}

const ORDER = facetOrder();
const N = ORDER.length;

/**
 * The house stone as an SVG: hairline facets that fill with champagne light as `--reveal`
 * advances (girdle first, table last). Used by the loading ritual and the craft stage fallback.
 */
export function LoaderStone({ className, reveal, outlineOnly = false, id = 'stone' }: LoaderStoneProps) {
  return (
    <svg
      viewBox="-6 -6 112 112"
      className={cn('block h-full w-full overflow-visible', className)}
      style={reveal !== undefined ? ({ ['--reveal' as string]: reveal } as React.CSSProperties) : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1e2bf" />
          <stop offset="0.45" stopColor="#d8c3a5" />
          <stop offset="1" stopColor="#a8894f" />
        </linearGradient>
        <linearGradient id={`${id}-table`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbf3e0" />
          <stop offset="0.6" stopColor="#e4cfa3" />
          <stop offset="1" stopColor="#c9ad74" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {!outlineOnly && (
        <g className="stone-fill" filter={`url(#${id}-glow)`}>
          {ORDER.map((f, i) => (
            <path
              key={f.id}
              d={facetPath(f.points)}
              fill={f.id === 'table' ? `url(#${id}-table)` : `url(#${id}-fill)`}
              style={{
                opacity: `clamp(0, calc((var(--reveal, 0) - ${(i / N).toFixed(4)}) * ${(N * 0.9).toFixed(1)}), ${f.id === 'table' ? 1 : 0.72 + (f.ring * 0.1)})`,
                mixBlendMode: 'screen',
              }}
            />
          ))}
        </g>
      )}
      <g className="stone-lines" fill="none" stroke="#e4cfa3" strokeLinejoin="round">
        {/* the radials are the join between steps, not eight spokes: they stay faint */}
        {GEM_RADIALS.map((pts, i) => (
          <path key={`r${i}`} d={linePath(pts)} strokeWidth="0.32" strokeOpacity={outlineOnly ? 0.22 : 0.14} className="stone-facet" />
        ))}
        {GEM_STEPS.map((pts, i) => (
          <path key={`s${i}`} d={facetPath(pts)} strokeWidth="0.45" strokeOpacity={outlineOnly ? 0.72 : 0.4} className="stone-facet" />
        ))}
        <path d={facetPath(GEM_OUTLINE)} strokeWidth="0.7" strokeOpacity={outlineOnly ? 1 : 0.7} className="stone-outline" />
      </g>
    </svg>
  );
}
