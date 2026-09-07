import type { Price } from '@/data/types';

export function formatPrice(price: Price): string {
  if (price.kind === 'fixed') return `Rs. ${new Intl.NumberFormat('en-US').format(price.pkr)}`;
  return 'PRICE ON REQUEST';
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
