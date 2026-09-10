import type { Price } from '@/data/types';

export function formatPrice(price: Price): string {
  if (price.kind === 'fixed') return `Rs. ${new Intl.NumberFormat('en-US').format(price.pkr)}`;
  return 'PRICE ON REQUEST';
}

/**
 * The date a published price was true.
 *
 * Gold moves daily. Sixteen pieces carry a figure and the rest are on request, so the few that
 * do are exactly the ones a visitor might hold Waseem to — a snapshot presented without its
 * date reads as a quotation. Naming the day makes it what it is: what the piece cost then.
 */
export function formatAsOf(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatGrams(grams: number) {
  return `${grams.toFixed(3)} g`;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function countInWords(n: number) {
  return n >= 0 && n <= 10 ? (WORDS[n] ?? String(n)) : String(n);
}

export function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}
