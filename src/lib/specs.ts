import type { Product, SpecSource } from '@/data/types';
import { formatGrams } from '@/lib/format';
import { METAL_COLOUR_LABEL } from '@/data/labels';

/**
 * One specification table, read the same way everywhere.
 *
 * The product page, the comparison surface and the concierge all have to agree about what
 * Waseem publishes for a piece — including, and especially, about what it does not. A row
 * exists only where there is a value; an absent field produces no row and no em dash, so a
 * page never states a fact by implying its shape.
 *
 * `source` travels with the value so a reviewer can tell a figure the shop published from
 * one a person wrote down. Nothing is ever `inferred`: a value we could not read is absent.
 */
export interface SpecRow {
  key: string;
  label: string;
  value: string;
  source?: SpecSource;
}

export function specRows(product: Product): SpecRow[] {
  const s = product.spec;
  const from = (k: keyof Product['spec']) => product.provenance[k];
  const rows: SpecRow[] = [];

  if (s.purity) rows.push({ key: 'purity', label: 'Purity', value: s.purity, source: from('purity') });
  if (s.metalColour) rows.push({ key: 'metalColour', label: 'Metal', value: METAL_COLOUR_LABEL[s.metalColour], source: from('metalColour') });
  if (s.alloy?.length) rows.push({ key: 'alloy', label: 'Alloy', value: s.alloy.join(', '), source: from('alloy') });
  if (s.grossWeightGrams !== undefined) rows.push({ key: 'grossWeight', label: 'Gross weight', value: formatGrams(s.grossWeightGrams), source: from('grossWeightGrams') });
  if (s.netWeightGrams !== undefined) rows.push({ key: 'netWeight', label: 'Net weight', value: formatGrams(s.netWeightGrams), source: from('netWeightGrams') });
  // published as written — 'G&H' and 'H' are the shop's own vocabulary, never mapped onto a
  // grading scale nobody stated
  if (s.diamondColour) rows.push({ key: 'diamondColour', label: 'Diamond colour', value: s.diamondColour, source: from('diamondColour') });
  if (s.diamondClarity) rows.push({ key: 'diamondClarity', label: 'Clarity', value: s.diamondClarity, source: from('diamondClarity') });
  if (s.diamondCarat !== undefined) rows.push({ key: 'diamondCarat', label: 'Carats', value: `${s.diamondCarat} ct`, source: from('diamondCarat') });
  if (s.size) rows.push({ key: 'size', label: 'Size', value: s.size, source: from('size') });
  if (s.stones?.length) rows.push({ key: 'stones', label: 'Stones', value: s.stones.map((st) => st.kind).join(', '), source: from('stones') });
  if (s.technique?.length) rows.push({ key: 'technique', label: 'Technique', value: s.technique.join(', '), source: from('technique') });
  if (product.reference) rows.push({ key: 'reference', label: 'Reference', value: product.reference });

  return rows;
}

/**
 * Whether the piece carries a measurement rather than only descriptive attributes. It
 * decides whether the page names the absence out loud — saying "confirmed at a viewing"
 * beneath a full table would be noise, and saying nothing beneath an empty one would be
 * evasive.
 */
export const isMeasured = (product: Product) =>
  Boolean(product.spec.purity || product.spec.grossWeightGrams !== undefined || product.spec.diamondCarat !== undefined);
