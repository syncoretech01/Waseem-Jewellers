import { getRow, specLineOf, priceLabelOf } from '@/data/clientIndex';
import type { Plan } from '../providers/mock/commands';
import type { SiteContext, ToolName, ToolOutcome } from '../types';

/**
 * What GPT-Live is told after the page has acted: a terse English fact.
 *
 * The voice model says one to five words in the visitor's language; it never reads a label
 * aloud, so what it receives is not a sentence to repeat but the state of the room — what is
 * open, how many pieces are in view, what the appointment form still lacks. Every figure
 * here is a published field or a count; nothing is estimated, and the fact says when a
 * number must not be spoken.
 */

/** A piece by its ordinal in what was just shown, so "opened piece 2 of 4" can be said. */
function ordinalOf(slug: string, ctx: SiteContext): string {
  const i = ctx.recentResults.findIndex((r) => r.slug === slug);
  return i >= 0 ? `piece ${i + 1} of ${ctx.recentResults.length}: ` : '';
}

function piecesFact(outcome: ToolOutcome): string {
  const ui = outcome.ui;
  if (!ui || ui.kind !== 'pieces') return outcome.label ? `${outcome.label}.` : 'Done.';
  if (!ui.pieces.length) return 'Nothing matched. Say so in one sentence and offer nearby pieces or the bridal pieces.';
  const names = ui.pieces.map((p, i) => `${i + 1}. ${p.name}`).join('; ');
  return `${ui.title} are now on the page (${names}). Say only how many and what kind are in view; do not list them.`;
}

/** One tool's outcome, in the words the voice model needs and no more. */
export function factForOutcome(name: ToolName, args: Record<string, unknown>, outcome: ToolOutcome, ctx: SiteContext): string {
  const result = (outcome.result ?? {}) as Record<string, unknown>;
  if (typeof result.error === 'string' && result.error) {
    if (result.error === 'NOT_CONFIRMED') return 'The request was not sent: the visitor has not said yes. Ask whether to send it.';
    if (result.error === 'INCOMPLETE') return `The form still needs: ${Array.isArray(result.missing) ? (result.missing as string[]).join(', ') : 'a detail'}. Ask for the first one only.`;
    if (result.error === 'NO_SUCH_FRAME') return `This piece has ${String(result.count ?? 'fewer')} photographs; that one does not exist.`;
    if (result.error === 'NOT_ON_A_PIECE') return 'The visitor is not on a piece\'s page; a photograph cannot be turned. Offer to open a piece first.';
    return `The page could not do that${typeof result.message === 'string' ? ` (${result.message})` : ''}. Say in one short sentence what the visitor can do instead.`;
  }
  switch (name) {
    case 'searchProducts':
    case 'refineResults':
    case 'showSimilarPieces':
    case 'showMatchingPieces': {
      const base = piecesFact(outcome);
      if (result.needsPiece === true) return 'No piece is in view to compare with. Ask the visitor to show or open one first.';
      if (result.basis === 'form') return `${base} These are lighter or heavier in form only: Waseem publishes no weight for the piece in view, so never state a weight.`;
      if (result.basis === 'none') return 'Neither a published weight nor a comparable form. Say a consultant can weigh the pieces at a viewing; do not estimate.';
      return base;
    }
    case 'openProduct':
    case 'focusProduct': {
      const slug = typeof result.slug === 'string' ? result.slug : '';
      const row = slug ? getRow(slug) : undefined;
      const facts = row ? specLineOf(row) : '';
      return `${name === 'openProduct' ? 'Opened' : 'Showing'} ${ordinalOf(slug, ctx)}${row?.t ?? outcome.label}${facts ? ` (published: ${facts}; state a figure only if asked)` : ''}.`;
    }
    case 'showDepartment':
    case 'showGold':
    case 'showDiamond':
      return `${outcome.label} department is open.`;
    case 'showBridal':
    case 'showCollection':
      return `${outcome.label} is open.`;
    case 'navigate':
      if (args.target === 'back') return result.ok === true ? `Went back; the page is now ${String(result.path ?? '/')}.` : 'There was no earlier page to return to; offer the homepage.';
      return `The page is now ${outcome.label || String(result.path ?? '')}.`;
    case 'scrollToSection':
    case 'activateGate':
    case 'highlightCategory':
      return `${outcome.label} is in view.`;
    case 'openMenu':
      return 'The site menu is open.';
    case 'closeMenu':
      return 'The site menu is closed.';
    case 'closeConcierge':
      return 'The panel closes in a moment. Say goodbye in one short line and nothing more.';
    case 'setGalleryFrame':
      return `${outcome.label} is in view.`;
    case 'comparePieces': {
      const ui = outcome.ui;
      if (ui?.kind === 'compare') return `${ui.pieces.map((p) => p.name).join(' and ')} are side by side, with only what Waseem publishes.`;
      return 'Two pieces are needed to compare; ask which.';
    }
    case 'showPriceGuidance':
      if (typeof result.pricePkr === 'number') return `Published price: Rs. ${new Intl.NumberFormat('en-US').format(result.pricePkr)} (gold moves daily; confirmed at a viewing).`;
      return 'Price on request for this piece; the appointment form is open with the figure noted. Never estimate.';
    case 'openAppointment':
    case 'openPrivateConsultation':
    case 'fillAppointment':
    case 'reviewAppointment': {
      const draft = (result.draft ?? {}) as Record<string, unknown>;
      const missing = Array.isArray(result.missing) ? (result.missing as string[]) : [];
      const showroom = draft.showroom && typeof draft.showroom === 'object' ? (draft.showroom as { name?: string }).name : undefined;
      const noted: string[] = [];
      if (typeof args.name === 'string' && draft.name) noted.push('name');
      if (typeof args.phone === 'string' && draft.phone) noted.push('telephone');
      if (typeof args.showroom === 'string' && showroom) noted.push(`showroom ${showroom}`);
      if (typeof args.occasion === 'string' && draft.occasion) noted.push('occasion');
      if (typeof args.date === 'string' && draft.date) noted.push(`date ${String(draft.date)}`);
      const problems = result.problems && typeof result.problems === 'object' ? Object.keys(result.problems as object) : [];
      const head = name === 'reviewAppointment' ? 'The form reads back' : 'The appointment form is open';
      const notedLine = noted.length ? `; noted: ${noted.join(', ')}` : '';
      const refused = problems.length ? `; not accepted: ${problems.join(', ')} (ask again)` : '';
      const next = missing.length ? `. Still needed: ${missing.join(', ')}. Ask for the first one only, in the same short sentence.` : '. Everything required is filled; read it back in one sentence and ask whether to send. Never say booked.';
      return `${head}${notedLine}${refused}${next}`;
    }
    case 'submitAppointment': {
      const reference = String(result.reference ?? '');
      if (result.status === 'delivered') return `The request has been sent with reference ${reference}; our team will confirm the time. Never say booked or confirmed.`;
      if (result.status === 'failed') return `The request did not reach the team; it is kept on this device under reference ${reference}, and WhatsApp is the way to send it.`;
      return `The request is prepared with reference ${reference}; nothing was sent, and sending it on WhatsApp is the next step. Never say booked, confirmed or received.`;
    }
    case 'filterProducts':
    case 'clearFilters':
      return `The page shows ${outcome.label}.`;
    default:
      return outcome.label ? `${outcome.label}.` : 'Done.';
  }
}

/**
 * A deterministic plan that says something without acting — a greeting, a price, the
 * showrooms — as an English fact for the voice model. The keyless engine's own sentence is
 * in the visitor's language and is kept for the written exchange; the voice says its own.
 */
export function factForPlan(plan: Plan, ctx: SiteContext): string | null {
  const inView = ctx.currentProduct ?? ctx.focusedProduct;
  switch (plan.id) {
    case 'greeting':
    case 'core_greet':
      return 'The visitor greeted you. Greet them back in a few words and ask what they would like to see.';
    case 'thanks':
    case 'core_thanks':
      return 'The visitor thanked you. Answer in one or two words.';
    case 'price':
    case 'core_price': {
      const row = inView ? getRow(inView.slug) : undefined;
      const priced = row && row.p > 0 && ctx.routeKind !== 'home';
      return priced ? `Published price of ${row.t}: ${priceLabelOf(row)}; confirmed at a viewing. Offer to prepare one.` : 'Price is on request for this piece; a viewing settles it. Never estimate a figure.';
    }
    case 'showrooms':
      return 'Three showrooms in Lahore, in this order: Liberty Market, MM Alam Road, DHA; open from noon until half past nine. The page shows them.';
    case 'about_house':
      return 'Waseem Jewellers was founded in Lahore in 1952 by Chaudhry Muhammad Afzal and receives visitors at three showrooms; the heritage chapter is in view.';
    case 'help':
      return 'Say in one short sentence: you can bring pieces, open a department, set two side by side, or prepare an appointment.';
    case 'watches':
    case 'out_of_scope':
      return 'Outside what Waseem makes: gold and diamond jewellery only. Offer pieces or an appointment in one sentence.';
    case 'saving_not_offered':
    case 'core_save':
    case 'selection_not_offered':
    case 'core_selection':
      return 'Saving pieces is not offered here. Offer to set two side by side or to prepare a viewing.';
    case 'core_restart':
      return 'The conversation begins again; ask in a few words what they would like to see.';
    case 'collections_overview':
      return 'The five collections are in view: Rukh-e-Jana, Aks-e-Noor, Rang-e-Jamal, Dewan, Royal Wedding. Say a name opens it.';
    case 'traditional':
      return 'Traditional pieces (polki and kundan) are on the page.';
    case 'named_tell':
    case 'deictic_tell':
    case 'enquire': {
      const row = inView ? getRow(inView.slug) : undefined;
      if (!row) return 'No piece is in view; ask which.';
      const specs = specLineOf(row);
      return `The piece in view is ${row.t}${specs ? `; published: ${specs}` : '; weight, purity and stones are confirmed at a viewing'}.`;
    }
    case 'clarify':
      return 'Ambiguous; ask which of the two readings was meant, briefly.';
    case 'unknown':
      return 'Not understood; ask once more, briefly.';
    case 'unknown.again':
      return 'Still not understood; offer writing instead, in one short line.';
    case 'core_open':
    case 'ordinal_open':
      // a plan with no tool asked which piece: nothing was shown yet
      return plan.tools.length ? null : `No piece to open yet; ask which, or offer the bridal pieces${ctx.recentResults.length ? ' (pieces are in view; ask the first or the second)' : ''}.`;
    case 'similar':
    case 'core_similar':
    case 'core_lighter':
    case 'core_matching':
      return plan.tools.length ? null : 'No piece is in view to compare with; ask the visitor to show one first.';
    case 'compare':
      return plan.tools.length ? null : 'Two pieces are needed; ask which two.';
    default:
      return null;
  }
}
