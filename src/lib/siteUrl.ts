/**
 * The origin every absolute URL is built on: canonical links, JSON-LD, Open Graph images.
 *
 * The configured site URL wins. Without one, a Vercel build still knows its own production
 * host, and a review deployment must not stamp `localhost` into its link previews — that is
 * how an OG image works on a laptop and vanishes in a shared link.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const platform = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (platform) return `https://${platform.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return 'http://localhost:3300';
}
