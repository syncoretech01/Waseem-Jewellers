import type { SiteContext } from './types';

/**
 * "The second one" — which one that is.
 *
 * These lived in `tools/executeTool.ts` and were imported from there by the keyless planner,
 * which put a planner downstream of a tools module: resolution is something a planner does
 * *before* it chooses a tool, not a by-product of running one. Here they belong to neither and
 * both can use them.
 */

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, '1st': 1, one: 1,
  second: 2, '2nd': 2, two: 2,
  third: 3, '3rd': 3, three: 3,
  fourth: 4, '4th': 4, four: 4,
  fifth: 5, '5th': 5, five: 5,
  sixth: 6, '6th': 6, six: 6,
};

export function ordinalFromWord(word: string): number | null {
  return ORDINAL_WORDS[word] ?? null;
}

export type OrdinalTarget = { kind: 'product'; slug: string } | { kind: 'collection'; slug: string };

/** "Open the second one" resolves against recent results, then recent collections, then what is visible. `-1` is "the last one". */
export function resolveOrdinal(n: number, ctx: SiteContext): OrdinalTarget | null {
  const idx = n === -1 ? -1 : n - 1;
  const pick = <T,>(list: T[]) => (idx === -1 ? list[list.length - 1] : list[idx]);
  const r = pick(ctx.recentResults);
  if (r) return { kind: 'product', slug: r.slug };
  const c = pick(ctx.recentCollections);
  if (c) return { kind: 'collection', slug: c };
  const v = pick(ctx.visibleProducts);
  if (v) return { kind: 'product', slug: v.slug };
  return null;
}
