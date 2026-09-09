/**
 * The concierge's voice, enforced rather than requested.
 *
 * A prompt can ask a model to write like a jewellery associate. It cannot guarantee it, and
 * the failure modes are exactly the ones that would embarrass Waseem in front of a customer:
 * an exclamation mark, a markdown heading, a slug leaking into prose, "As an AI", four
 * paragraphs where one sentence was wanted.
 *
 * So this runs on **both** engines' output. The keyless engine writes from `copy.ts` and will
 * never trip it; applying it there anyway is what makes the guarantee deterministic — the
 * brand's voice does not depend on which engine happened to answer.
 *
 * It is a filter, not a rewriter. It removes and truncates; it never adds a word, because a
 * filter that composes prose is a second author nobody reviewed.
 */

/** Two sentences. A concierge who needs a third should have used a tool. */
const MAX_SENTENCES = 2;
const MAX_CHARS = 320;

const STRIP: [RegExp, string][] = [
  // markdown: headings, bold, italic, code, list bullets, links
  [/^#{1,6}\s+/gm, ''],
  [/^\s*[-*+]\s+/gm, ''],
  [/\*\*([^*]+)\*\*/g, '$1'],
  [/\*([^*]+)\*/g, '$1'],
  [/`([^`]+)`/g, '$1'],
  [/\[([^\]]+)\]\([^)]*\)/g, '$1'],
  // the assistant talking about itself as software
  [/\b(as an ai|as a language model|i'?m an ai|i am an ai)\b[^.!?]*[.!?]\s*/gi, ''],
  [/\b(i cannot|i can'?t) (browse|access the internet|see images)\b[^.!?]*[.!?]\s*/gi, ''],
  // a slug is an address, not a name for a piece
  [/\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/g, ''],
  // emoji and the pictographic blocks
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ''],
];

/** Sentence ends, without splitting "Rs. 380,000" or "21K." */
function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== '.' && c !== '!' && c !== '?') continue;
    const next = text[i + 1];
    if (next && next !== ' ' && next !== '\n') continue;
    // "Rs." and an initial are not the end of anything
    const before = text.slice(Math.max(0, i - 3), i);
    if (/\b(Rs|Mr|Mrs|Ms|St|No)$/i.test(before)) continue;
    out.push(text.slice(start, i + 1).trim());
    start = i + 1;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out.filter(Boolean);
}

export function enforceBrandRegister(raw: string): string {
  let text = raw;
  for (const [re, to] of STRIP) text = text.replace(re, to);

  text = text
    .replace(/!+/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim();

  const kept = sentences(text).slice(0, MAX_SENTENCES).join(' ');
  const clipped = kept.length > MAX_CHARS ? `${kept.slice(0, MAX_CHARS).replace(/\s+\S*$/, '')}…` : kept;
  return clipped.trim();
}

/**
 * Where a streamed reply may be shown.
 *
 * Deltas arrive mid-word, and the register filter counts sentences — so applying it to a
 * fragment would truncate a sentence that had not finished arriving. The controller buffers
 * to a sentence boundary instead, which also gives `text.ready` a real first sentence for the
 * voice to speak rather than a half of one.
 */
export function completeSentences(buffer: string): { ready: string; rest: string } {
  const parts = sentences(buffer);
  if (parts.length < 1) return { ready: '', rest: buffer };
  const last = parts[parts.length - 1]!;
  const finished = /[.!?]$/.test(last.trim());
  const ready = finished ? parts.join(' ') : parts.slice(0, -1).join(' ');
  const rest = finished ? '' : last;
  return { ready: ready.trim(), rest };
}
