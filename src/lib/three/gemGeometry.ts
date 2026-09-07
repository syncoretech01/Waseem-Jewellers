/**
 * The house stone: a step-cut (emerald-cut) gem seen from above, expressed as 2D facets
 * for the loading ritual and the bespoke chapter, and as proportions for the CH02 object.
 *
 * Coordinates live in a 100 × 100 box. Every facet is a closed polygon; `ring` orders the
 * facets from the outer girdle inward so a single progress value can fill them in sequence.
 */
export interface GemFacet {
  id: string;
  points: [number, number][];
  /** 0 = girdle row, higher = closer to the table. */
  ring: number;
}

/** Corner-cut octagon inset by `inset` from the box edge, with corner length `cut`. */
function octagon(inset: number, cut: number): [number, number][] {
  const a = inset;
  const b = 100 - inset;
  return [
    [a + cut, a],
    [b - cut, a],
    [b, a + cut],
    [b, b - cut],
    [b - cut, b],
    [a + cut, b],
    [a, b - cut],
    [a, a + cut],
  ];
}

/** Step rows: three concentric octagons and the table. */
const RINGS = [
  { inset: 2, cut: 16 },
  { inset: 12, cut: 12 },
  { inset: 22, cut: 8.5 },
  { inset: 32, cut: 5 },
];

function buildFacets(): GemFacet[] {
  const facets: GemFacet[] = [];
  for (let r = 0; r < RINGS.length - 1; r++) {
    const outer = octagon(RINGS[r]!.inset, RINGS[r]!.cut);
    const inner = octagon(RINGS[r + 1]!.inset, RINGS[r + 1]!.cut);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      facets.push({ id: `r${r}-${i}`, ring: r, points: [outer[i]!, outer[j]!, inner[j]!, inner[i]!] });
    }
  }
  const table = RINGS[RINGS.length - 1]!;
  facets.push({ id: 'table', ring: RINGS.length - 1, points: octagon(table.inset, table.cut) });
  return facets;
}

export const GEM_FACETS: GemFacet[] = buildFacets();
export const GEM_OUTLINE: [number, number][] = octagon(RINGS[0]!.inset, RINGS[0]!.cut);
export const GEM_RING_COUNT = RINGS.length;

export function facetPath(points: [number, number][]) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';
}

/** Fill order: girdle first, table last; within a ring, clockwise from the top-left corner. */
export function facetOrder(): GemFacet[] {
  return [...GEM_FACETS].sort((a, b) => a.ring - b.ring || a.id.localeCompare(b.id));
}

/** Proportions for the three-dimensional stone (M5): table, crown and pavilion as fractions of width. */
export const GEM_PROPORTIONS = {
  width: 1,
  length: 1.3,
  cornerCut: 0.16,
  table: 0.62,
  crownHeight: 0.18,
  girdleHeight: 0.035,
  pavilionHeight: 0.42,
  steps: 3,
} as const;
