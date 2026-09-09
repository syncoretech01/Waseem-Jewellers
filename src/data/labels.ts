import type { Category, Department, Material, MetalColour, Occasion, Product } from './types';

/** One place every category, department and material is named for a visitor. */
export const CATEGORY_LABEL: Record<Category, string> = {
  'bridal-set': 'Bridal set',
  necklace: 'Necklace',
  earrings: 'Earrings',
  ring: 'Ring',
  bracelet: 'Bracelet',
  bangle: 'Bangle',
  pendant: 'Pendant',
  chain: 'Chain',
  'nose-pin': 'Nose pin',
  cufflink: 'Cufflinks',
  tikka: 'Tikka',
  nath: 'Nath',
};

/** Plural, for counts and headings. */
export const CATEGORY_PLURAL: Record<Category, string> = {
  'bridal-set': 'Bridal sets',
  necklace: 'Necklaces',
  earrings: 'Earrings',
  ring: 'Rings',
  bracelet: 'Bracelets',
  bangle: 'Bangles',
  pendant: 'Pendants',
  chain: 'Chains',
  'nose-pin': 'Nose pins',
  cufflink: 'Cufflinks',
  tikka: 'Tikkas',
  nath: 'Naths',
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  gold: 'Gold',
  diamond: 'Diamond',
  bridal: 'Bridal',
  men: 'Men',
  kids: 'Kids',
};

export const MATERIAL_LABEL: Record<Material, string> = {
  gold: 'Gold',
  diamond: 'Diamond',
  polki: 'Polki',
  'gold-diamond': 'Gold and diamond',
};

export const METAL_COLOUR_LABEL: Record<MetalColour, string> = {
  yellow: 'Yellow gold',
  white: 'White gold',
  rose: 'Rose gold',
  'two-tone': 'Two-tone gold',
};

export const OCCASION_LABEL: Record<Occasion, string> = {
  wedding: 'Wedding',
  mehndi: 'Mehndi',
  baraat: 'Baraat',
  walima: 'Walima',
  engagement: 'Engagement',
  everyday: 'Everyday',
  gift: 'A gift',
};

/** What to call a piece: its authored name where one exists, otherwise the published title. */
export const nameOf = (p: Product) => p.editorialTitle ?? p.title;

export const categoryLabel = (c?: Category) => (c ? CATEGORY_LABEL[c] : 'Jewellery');
export const departmentLabel = (d?: Department) => (d ? DEPARTMENT_LABEL[d] : 'Waseem Jewellers');

/**
 * A sentence for a piece with no authored lede — about 646 of them.
 *
 * Assembled only from what Waseem publishes: the category, the purity, the weight, the
 * stones. It never characterises a piece it has not been told about, so where there is
 * little to say it says little.
 */
export function describe(p: Product): string {
  const noun = p.category ? CATEGORY_LABEL[p.category].toLowerCase() : 'piece';
  const metal = p.spec.metalColour ? METAL_COLOUR_LABEL[p.spec.metalColour].toLowerCase() : p.material === 'polki' ? 'gold' : undefined;
  const opening = [p.spec.purity ? `${p.spec.purity}` : undefined, metal].filter(Boolean).join(' ');
  const head = opening ? `A ${opening} ${noun}` : `A ${noun}`;

  const facts: string[] = [];
  if (p.spec.diamondCarat !== undefined) {
    facts.push(`set with ${p.spec.diamondCarat} ct of diamonds${p.spec.diamondClarity ? ` at ${p.spec.diamondClarity}` : ''}`);
  } else if (p.material === 'polki') {
    facts.push('set with uncut stones');
  }
  if (p.spec.grossWeightGrams !== undefined) facts.push(`${p.spec.grossWeightGrams} grams`);

  const tail = facts.length ? `, ${facts.join(', ')}` : '';
  return `${head}${tail} from Waseem Jewellers, Lahore.`;
}
