/**
 * The mark's gold, sampled from the brand master rather than invented.
 *
 * It is a horizontal metallic sweep, not a vertical ramp: a specular peak near 29%
 * of the mark's width and a trough near 73%. Reading it off the artwork keeps the
 * reconstruction the same colour as the logo Waseem already uses.
 */
export interface GoldStop {
  offset: number;
  color: string;
}

/** Measured along the JEWELLERS band, where the sweep is widest. */
export const GOLD_STOPS: readonly GoldStop[] = [
  { offset: 0, color: '#d9a94e' },
  { offset: 0.07, color: '#f5d35b' },
  { offset: 0.15, color: '#ffe28b' },
  { offset: 0.29, color: '#fffec8' },
  { offset: 0.44, color: '#e0c079' },
  { offset: 0.73, color: '#d5b258' },
  { offset: 0.87, color: '#eed78c' },
  { offset: 1, color: '#f8e9af' },
];

/**
 * A narrow bright band that travels across the mark. One `gradientTransform` tween
 * moves light *through* the metal — which is what a polished surface does — instead
 * of sliding a highlight over the top of it.
 */
export const SPECULAR_STOPS: readonly GoldStop[] = [
  { offset: 0, color: 'transparent' },
  { offset: 0.42, color: 'transparent' },
  { offset: 0.5, color: '#fffdf2' },
  { offset: 0.58, color: 'transparent' },
  { offset: 1, color: 'transparent' },
];

export type MarkTone = 'gold' | 'current' | 'ink' | 'ivory';

export const TONE_FILL: Record<Exclude<MarkTone, 'gold'>, string> = {
  current: 'currentColor',
  ink: 'var(--color-ink)',
  ivory: 'var(--color-ivory)',
};
