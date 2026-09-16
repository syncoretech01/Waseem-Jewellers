import type { NextConfig } from 'next';

/**
 * Stage 1 configuration.
 * - Turbopack is the default in Next 16 (no webpack key, ever).
 * - Every image is local under /public/assets/waseem; nothing is hot-linked.
 * - `qualities` must be an allowlist in Next 16 (default is [75] only).
 */
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Every prerender worker loads the whole 656-product catalogue, so seven of them at once
   * exhaust this machine's memory partway through the export. Three build the same 600
   * pages without the peak. The repository seam is what will eventually let a page load
   * only what it needs; until then this is the honest constraint.
   */
  // three workers is the ceiling; NEXT_BUILD_CPUS=1 on a machine short of memory, where a worker
  // dying with STATUS_STACK_BUFFER_OVERRUN is the symptom
  experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) || 3 },

  images: {
    /**
     * No metered optimiser. The review deployment answered 402 to every image once the
     * plan's monthly transformations were spent; the loader serves the shop's CDN resizes
     * and the build-time variants instead. See src/lib/imageLoader.ts.
     */
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.ts',
    formats: ['image/webp'],
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560],
    imageSizes: [96, 160, 256, 384, 512],
    qualities: [70, 82],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    /**
     * The long tail of the catalogue is resized by the shop's own CDN rather than localised —
     * 656 products at Stage 1's quality would be 150 MB+ in git. The browser fetches those
     * frames from cdn.shopify.com at the width the page asks for; the loader is the only
     * place that writes such a URL.
     */
  },
  /**
   * Stage 1 had one collection and two curated "edits" of it, reached by `?edit=`. Those
   * edits are now real departments with their own pages, so the old links are redirected
   * rather than broken: a bookmark, a shared link and every `?edit=` URL the concierge has
   * already emitted land on the same subject they always meant. The redirect lives in
   * config, so it holds on the first deploy without a page being involved.
   */
  async redirects() {
    return [
      /**
       * `edit` is captured into `:material` rather than matched and discarded. A matched
       * query key is consumed by the destination; an unmatched one is appended, which would
       * leave `?edit=gold` riding along on a page that has no idea what an edit is.
       */
      {
        source: '/collections/bridal',
        has: [{ type: 'query', key: 'edit', value: '(?<material>gold|diamond)' }],
        destination: '/bridal?material=:material',
        permanent: true,
      },
      // `?material=` was the campaign page's own index filter; the department owns that now
      {
        source: '/collections/bridal',
        has: [{ type: 'query', key: 'material' }],
        destination: '/bridal',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        // The localised house media is stable between asset runs, and the films are
        // large. Without this the platform serves them `must-revalidate`, so every
        // visit spends a round trip per file before a frame can play.
        source: '/assets/waseem/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      {
        // Stage 1 is a review deployment of an unreleased house. Keep it out of
        // search results; remove this block at launch.
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default config;
