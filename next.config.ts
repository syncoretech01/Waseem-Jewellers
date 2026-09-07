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
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2560],
    imageSizes: [96, 160, 256, 384, 512],
    qualities: [70, 82],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [],
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
