/**
 * Every image on the site goes through this function, and none through Vercel's optimiser.
 *
 * The review deployment answered 402 to every `/_next/image` request the moment the plan's
 * monthly quota of transformations was spent — a jewellery site with no jewellery in it,
 * for the rest of the month. So the site stops depending on a metered optimiser at all:
 *
 *   remote  the long tail lives on the shop's own CDN, which resizes on request for free.
 *           The requested width goes into the URL it already carries.
 *   local   the localised assets are cut at build time into a small ladder of widths
 *           (`scripts/assets/variants.mjs`); the loader picks the smallest that is wide
 *           enough, or the original when nothing smaller would do. The source's own width
 *           travels as `?mw=` so no width above it is ever asked for.
 *
 * `next/image` still writes the `srcset` and `sizes`; it simply calls this for each width.
 */

export const LOCAL_WIDTHS = [640, 1080, 1600] as const;
/** Nothing is asked of the shop's CDN above this; the originals are 4000 px and more. */
const REMOTE_MAX = 2048;

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (/^https?:\/\//.test(src)) {
    try {
      const url = new URL(src);
      if (/cdn\.shopify\.com$/.test(url.hostname)) {
        url.searchParams.set('width', String(Math.min(REMOTE_MAX, Math.max(160, Math.round(width)))));
        return url.toString();
      }
    } catch {
      /* not a URL after all: served as given */
    }
    return src;
  }
  const q = src.indexOf('?');
  const path = q >= 0 ? src.slice(0, q) : src;
  const params = new URLSearchParams(q >= 0 ? src.slice(q + 1) : '');
  const maxWidth = Number(params.get('mw')) || 0;
  if (!/\.webp$/.test(path)) return path;
  const variant = LOCAL_WIDTHS.find((w) => w >= width && (!maxWidth || w < maxWidth));
  return variant ? path.replace(/\.webp$/, `-${variant}w.webp`) : path;
}
