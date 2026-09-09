import type { Product } from '@/data/types';

/**
 * How a piece's page is laid out is decided by the photography that exists for it, not by
 * one house template.
 *
 * The governing fact of this catalogue: **443 of the 592 pieces a visitor can reach have
 * exactly one photograph.** A gallery-first page is therefore wrong for three quarters of
 * the shop — it leaves a tall empty rail beside a single frame and makes the common case
 * look like the broken one. So the single-frame layout is not a fallback. It is the layout,
 * and it has to look deliberate, because it is what most of Waseem's jewellery gets.
 *
 *   campaign  a scene was photographed for this piece — the 62/38 split of Stage 1
 *   studio    two or three studio cut-outs — plates side by side, not stacked
 *   single    one photograph — centred, with the words beneath rather than beside it
 */
export type PdpMode = 'campaign' | 'studio' | 'single';

export function pdpMode(product: Product): PdpMode {
  const frames = product.media.gallery;
  if (frames.length <= 1) return 'single';
  // a campaign, macro or detail frame is a scene or a close view; the page opens tall for it
  if (frames.some((f) => f.role === 'campaign' || f.role === 'macro' || f.role === 'detail')) return 'campaign';
  return 'studio';
}
