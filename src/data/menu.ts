import type { MenuItem } from './types';

/**
 * Full-screen navigation. Every target exists — nothing here links to a page that is not
 * built, and the department entries are checked against the same repository predicate the
 * routes are generated from.
 *
 * The five departments are the primary door and are set in the large face. Collections,
 * Bespoke and Heritage are the house's own chapters rather than places to buy from, so they
 * sit in a second row: eight entries at the primary scale do not fit a short viewport, and
 * shrinking the type to make them fit would flatten the distinction as well as the layout.
 *
 * Men and Kids carry no still. There is no campaign photography of either — the ten localised
 * frames are all bridal — and a bridal necklace behind the word Men would be a lie told in
 * pictures. They show the ambient scene until Waseem supplies photography of their own.
 */
export const MENU: MenuItem[] = [
  { id: 'gold', label: 'Gold', numeral: '01', kind: 'route', target: '/gold', media: { still: 'p05-hero' }, line: 'Twenty-one karat, mostly.' },
  { id: 'diamond', label: 'Diamond', numeral: '02', kind: 'route', target: '/diamond', media: { still: 'p07-hero', video: 'diamond-studio' }, line: 'Set in gold, graded as published.' },
  { id: 'bridal', label: 'Bridal', numeral: '03', kind: 'route', target: '/bridal', media: { still: 'p01-hero', video: 'hero-royal' }, line: 'For the day that becomes forever.' },
  { id: 'men', label: 'Men', numeral: '04', kind: 'route', target: '/men', media: {}, line: 'Weight, in the hand.' },
  { id: 'kids', label: 'Kids', numeral: '05', kind: 'route', target: '/kids', media: {}, line: 'Small, and made properly.' },
];

/** The chapters — read rather than shopped. */
export const MENU_SECONDARY: MenuItem[] = [
  { id: 'collections', label: 'Collections', numeral: '06', kind: 'chapter', target: 'collections', media: { still: 'p04-hero', video: 'menu-ambient' }, line: 'Five worlds of Waseem.' },
  { id: 'bespoke', label: 'Bespoke', numeral: '07', kind: 'modal', target: 'bespoke', media: { still: 'p10-hero' }, line: 'An idea, a stone, a form.' },
  { id: 'house', label: 'Heritage', numeral: '08', kind: 'chapter', target: 'heritage', media: { still: 'heritage-facade' }, line: 'Lahore, since 1952.' },
];

export const MENU_ALL: MenuItem[] = [...MENU, ...MENU_SECONDARY];
