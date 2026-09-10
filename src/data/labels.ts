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

/**
 * Campaign names the shop's own slug does not spell correctly.
 *
 * `range-jamal` is a typo for Rang-e-Jamal in the shop's collection handle. Correcting it
 * here is the same kind of accommodation the parser makes for `Gold Pursity`: the data is
 * Waseem's, the spelling of their own campaign is not something to reproduce faithfully.
 */
const CAMPAIGN_LABEL: Record<string, string> = {
  'range-jamal': 'Rang-e-Jamal',
  'rang-e-jamal': 'Rang-e-Jamal',
  'aks-e-noor': 'Aks-e-Noor',
  'rukh-e-jana': 'Rukh-e-Jana',
  // the handle the catalogue actually carries, missing its hyphen
  'rukhe-jana': 'Rukh-e-Jana',
  'naqsh-e-gul': 'Naqsh-e-Gul',
  'royal-wedding': 'Royal Wedding',
  dewan: 'Dewan',
  // a working handle that reached production: the facet drawer read "Dewan Final"
  'dewan-final': 'Dewan',
  'bridal-collection': 'Bridal',
  'timeless-treasures': 'Timeless Treasures',
  'bespoke-elegance': 'Bespoke Elegance',
};

/**
 * The campaign a *visitor's* word means, in the slug the catalogue actually stores.
 *
 * The site's campaign worlds and the shop's collection handles are spelled differently for
 * three of the six — `rukh-e-jana` against `rukhe-jana`, `rang-e-jamal` against
 * `range-jamal`, `dewan` against `dewan-final`. Anything that filters on a slug a
 * visitor or a model supplied has to come through here first, or it filters on a string no
 * piece carries and returns nothing at all — silently, which is the worst way to be wrong.
 */
const CAMPAIGN_SLUG: Record<string, string> = {
  'rukh-e-jana': 'rukhe-jana',
  'rang-e-jamal': 'range-jamal',
  dewan: 'dewan-final',
  bridal: 'bridal-collection',
};

export const campaignSlugOf = (slug: string): string => CAMPAIGN_SLUG[slug] ?? slug;

export const campaignLabel = (slug: string) =>
  CAMPAIGN_LABEL[slug] ?? slug.replace(/-/g, ' ').replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());

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
