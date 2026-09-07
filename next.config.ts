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
};

export default config;
