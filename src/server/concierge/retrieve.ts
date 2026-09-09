import 'server-only';

import { getRepository } from '@/data/repository';
import { parse, type IntentFrame } from '@/concierge/nlu/parse';
import { CATEGORY_LABEL, DEPARTMENT_LABEL } from '@/data/labels';
import type { Category, Department } from '@/data/types';
import type { PieceRow } from '@/lib/facets';

/**
 * Grounding: the candidate pieces, chosen before the model's first token.
 *
 * The catalogue is never sent to the model — 599 pieces would be some 200,000 tokens and it
 * would still be free to invent a six-hundredth. Instead the visitor's sentence is read by
 * the same parser the keyless engine uses, that reading retrieves at most a dozen real
 * pieces, and those pieces are the *only* jewellery the model is ever shown. A piece it has
 * not seen does not exist as far as the prompt is concerned, and `validateToolCall` refuses
 * any slug outside the listable set regardless.
 *
 * No embeddings and no vector database: the shop publishes structured fields — kind, metal,
 * department, purity, weight — and a filter over those is both more accurate here and one
 * fewer credential to hold.
 */

/** More than this and the prompt is carrying a catalogue rather than an answer. */
const MAX_CANDIDATES = 12;

export interface Grounding {
  frame: IntentFrame;
  candidates: PieceRow[];
  /** The piece the visitor is looking at, if any — it is always a candidate. */
  anchor: PieceRow | null;
}

export async function ground(text: string, context: { currentSlug?: string | null; recentSlugs?: string[] }): Promise<Grounding> {
  const repo = getRepository();
  const frame = parse(text);
  const rows = await repo.rows();
  const bySlug = new Map(rows.map((r) => [r.s, r]));

  const anchor = context.currentSlug ? (bySlug.get(context.currentSlug) ?? null) : null;

  const s = frame.slots;
  const matched = rows.filter((r) => {
    if (s.category && r.c !== s.category) return false;
    if (s.department && !r.d.includes(s.department)) return false;
    if (s.karat && r.k !== `${s.karat}K`) return false;
    if (s.occasion && !r.o.includes(s.occasion)) return false;
    if (s.maxWeightGrams !== undefined && (r.w === undefined || r.w > s.maxWeightGrams)) return false;
    if (s.minWeightGrams !== undefined && (r.w === undefined || r.w < s.minWeightGrams)) return false;
    if (s.material) {
      if (s.material === 'gold' && !(r.m === 'gold' || r.m === 'gold-diamond' || r.m === 'polki')) return false;
      if (s.material === 'diamond' && !(r.m === 'diamond' || r.m === 'gold-diamond')) return false;
      if (s.material === 'polki' && r.m !== 'polki') return false;
    }
    return true;
  });

  // free words rank what the fields already narrowed; they never widen it
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const ranked = matched
    .map((r) => {
      const hay = `${r.t} ${r.rf ?? ''} ${r.c ?? ''} ${r.cp ?? ''}`.toLowerCase();
      return { r, score: words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);

  const seen = new Set<string>();
  const candidates: PieceRow[] = [];
  const add = (r: PieceRow | null | undefined) => {
    if (!r || seen.has(r.s) || candidates.length >= MAX_CANDIDATES) return;
    seen.add(r.s);
    candidates.push(r);
  };

  // the piece in view first, then what was just shown, then what the sentence asked for
  add(anchor);
  for (const slug of context.recentSlugs ?? []) add(bySlug.get(slug));
  for (const r of ranked) add(r);

  return { frame, candidates, anchor };
}

/**
 * The candidates as the model sees them.
 *
 * Only published facts, and absent fields are simply missing rather than rendered as an em
 * dash or a zero — a model shown "weight: —" will read a value there sooner or later.
 */
export function catalogueBlock(candidates: PieceRow[]): string {
  if (!candidates.length) return '<catalogue>No pieces match. Say so; do not offer a substitute you have not been shown.</catalogue>';
  const lines = candidates.map((r) => {
    const facts = [
      `slug=${r.s}`,
      `name=${r.t}`,
      r.c ? `kind=${CATEGORY_LABEL[r.c as Category]}` : null,
      r.d.length ? `department=${r.d.map((d) => DEPARTMENT_LABEL[d as Department]).join('/')}` : null,
      r.k ? `purity=${r.k}` : null,
      r.w !== undefined ? `gross_weight=${r.w}g` : null,
      r.ct !== undefined ? `diamond_carat=${r.ct}ct` : null,
      r.rf ? `reference=${r.rf}` : null,
      r.p > 0 ? `price=PKR ${r.p}` : 'price=on request',
    ].filter(Boolean);
    return `- ${facts.join(' | ')}`;
  });
  return `<catalogue>\n${lines.join('\n')}\n</catalogue>`;
}
