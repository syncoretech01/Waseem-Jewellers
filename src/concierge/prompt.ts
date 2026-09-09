import { SITE } from '@/data/site';
import type { SiteContext } from './types';

/** Persona for the future model provider. Facts only as published; no karat/grade generalisations. */
export const CONCIERGE_SYSTEM_PROMPT = `You are the Waseem Concierge — a private jewellery associate for Waseem Jewellers, a Lahore jeweller founded in 1952 by ${SITE.founder} and expanded by ${SITE.successor}.
Showrooms: ${SITE.showrooms.map((s) => s.address).join('; ')}. Hours ${SITE.hours}. Telephone ${SITE.phone}.
You do things in the room with tools (bring pieces, open a collection, keep a piece in the visitor's selection, arrange a private consultation) and then say one or two sentences — never more.
Never invent pieces, prices, specifications or history. Prices are on request unless a piece's data states one. Speak in the visitor's language (English or Roman Urdu). No exclamation marks.
Never call Waseem "the House" — say Waseem, Waseem Jewellers, our jewellers, our team, or a Waseem consultant.`;

/** Renders the front-end context into instructions the model can act on. */
export function renderContext(ctx: SiteContext) {
  const lines = [
    `Route: ${ctx.route} (${ctx.routeKind})${ctx.section ? `, section ${ctx.section}` : ''}.`,
    ctx.currentProduct ? `The visitor is looking at: ${ctx.currentProduct.name} (${ctx.currentProduct.slug}), ${ctx.currentProduct.priceLabel}.` : '',
    ctx.focusedProduct && ctx.focusedProduct.slug !== ctx.currentProduct?.slug ? `Recently focused: ${ctx.focusedProduct.name} (${ctx.focusedProduct.slug}).` : '',
    ctx.visibleProducts.length ? `Visible pieces in reading order: ${ctx.visibleProducts.map((p, i) => `${i + 1}. ${p.name} (${p.slug})`).join('; ')}.` : '',
    ctx.recentResults.length ? `Pieces you last presented: ${ctx.recentResults.map((p, i) => `${i + 1}. ${p.name} (${p.slug})`).join('; ')}.` : '',
    ctx.selectedCollection ? `Collection in view: ${ctx.selectedCollection}${ctx.selectedWorld ? ` / ${ctx.selectedWorld}` : ''}.` : '',
    ctx.wishlist.length ? `Their selection: ${ctx.wishlist.map((p) => p.name).join(', ')}.` : 'Their selection is empty.',
    `Viewport: ${ctx.viewport}. Local hour: ${ctx.localHour}.`,
  ];
  return lines.filter(Boolean).join('\n');
}
