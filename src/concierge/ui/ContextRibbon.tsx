'use client';

import { useEffect, useState } from 'react';
import { useConciergeStore } from '@/state/conciergeStore';
import { getRow } from '@/data/clientIndex';
import { anchorIsLive, topicIsLive } from '../memory';
import { CATEGORY_LABEL, DEPARTMENT_LABEL, MATERIAL_LABEL, OCCASION_LABEL } from '@/data/labels';
import type { Category, Department, Material, Occasion } from '@/data/types';
import type { Slots } from '../nlu/parse';
import { useController } from '../useConcierge';

/**
 * What the concierge currently believes it is being asked about — said out loud, and undoable.
 *
 * The memory that makes "now bracelets" and "something lighter" work is otherwise invisible.
 * A visitor who has been narrowing for four turns has no way to know the concierge is still
 * holding "21K, under 15 grams", and no way to drop just that one condition short of starting
 * again. Both are ordinary things to want, and neither is a conversation worth having in
 * sentences: it is a state, so it is shown as one.
 *
 * Deliberately not chips in the ecommerce sense. No pills, no counts, no close icons — a line
 * of prose in the display face, each term underlined and removable, which is how the applied
 * facets read on a department page. The salon rules hold here as everywhere: the only accent
 * is the gold hairline, and nothing pulses for attention.
 */

type TermKey = 'department' | 'category' | 'material' | 'purity' | 'occasion' | 'weight';

type Term = { key: TermKey; label: string };

/** Only what a visitor would recognise as a condition they set. Ordinals and deixis are not. */
function termsOf(slots: Slots): Term[] {
  const terms: Term[] = [];
  if (slots.department) terms.push({ key: 'department', label: DEPARTMENT_LABEL[slots.department as Department] ?? slots.department });
  if (slots.category) terms.push({ key: 'category', label: CATEGORY_LABEL[slots.category as Category] ?? slots.category });
  if (slots.material) terms.push({ key: 'material', label: MATERIAL_LABEL[slots.material as Material] ?? slots.material });
  if (slots.karat) terms.push({ key: 'purity', label: `${slots.karat}K` });
  if (slots.occasion) terms.push({ key: 'occasion', label: OCCASION_LABEL[slots.occasion as Occasion] ?? slots.occasion });
  // one weight term either way: "under 15 g" and "over 15 g" are one condition, not two
  if (slots.maxWeightGrams !== undefined) terms.push({ key: 'weight', label: `under ${slots.maxWeightGrams} g` });
  else if (slots.minWeightGrams !== undefined) terms.push({ key: 'weight', label: `over ${slots.minWeightGrams} g` });
  return terms;
}

export function ContextRibbon() {
  const memory = useConciergeStore((s) => s.memory);
  const turnCount = useConciergeStore((s) => s.turnCount);
  const controller = useController();

  /**
   * The standing topic decays after eight minutes as well as after six turns, so liveness is
   * a question about the clock — and reading the clock during render is impure: two renders a
   * minute apart would disagree for no reason React can see. The clock is held in state and
   * ticked while the ribbon is mounted, which is only while the panel is open.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // the same liveness rules the engines apply, so the ribbon can never claim a topic that has
  // already decayed out of the answer
  const topicLive = topicIsLive(memory, turnCount, now);
  const anchorLive = anchorIsLive(memory, turnCount);
  const terms = topicLive ? termsOf(memory.standingSlots) : [];
  const piece = anchorLive && memory.anchor ? getRow(memory.anchor) : undefined;

  if (!terms.length && !piece) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-6 pb-3 md:px-7" data-context-ribbon>
      <span className="micro shrink-0 text-fg-muted">About —</span>
      {piece && (
        <span dir="auto" className="font-display italic text-[0.8125rem] leading-snug text-fg-2" style={{ fontVariationSettings: '"opsz" 12' }}>
          the {piece.t}
        </span>
      )}
      {piece && terms.length > 0 && <span aria-hidden className="text-[0.8125rem] text-fg-muted">·</span>}
      {terms.map((t, i) => (
        <span key={t.key} className="flex items-baseline gap-2">
          <button
            type="button"
            onClick={() => controller?.dropTerm(t.key)}
            className="font-display text-[0.8125rem] leading-snug text-fg-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-gold-hi focus-visible:outline-none focus-visible:decoration-gold-hi"
            style={{ fontVariationSettings: '"opsz" 12' }}
            aria-label={`Stop looking at ${t.label}`}
          >
            {t.label}
          </button>
          {i < terms.length - 1 && <span aria-hidden className="text-[0.8125rem] text-fg-muted">·</span>}
        </span>
      ))}
    </div>
  );
}
