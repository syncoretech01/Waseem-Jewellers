import type { RouteKind } from '@/state/siteStore';

/** Example lines by route, so the scripted example always performs a visible action. */
export const EXAMPLE_SCRIPTS: Record<RouteKind, string[]> = {
  home: ['Show me bridal necklaces', 'Open the second one', 'Save this piece'],
  collection: ['Show me something traditional', 'Show similar pieces', 'Book a private consultation'],
  product: ['Save this piece', 'Show similar pieces', 'Take me to bridal'],
  other: ['Show me bridal necklaces', 'Tell me about Waseem', 'Book a private consultation'],
};
