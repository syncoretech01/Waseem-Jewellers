import type { MenuItem } from './types';

/** Full-screen navigation. Every target exists in Stage 1 — nothing links to a page that is not built. */
export const MENU: MenuItem[] = [
  { id: 'gold', label: 'Gold Edit', numeral: '01', kind: 'route', target: '/collections/bridal?edit=gold', media: { still: 'p05-hero' }, line: 'Bridal pieces in kundan, polki and pleated gold.' },
  { id: 'diamond', label: 'Diamond Edit', numeral: '02', kind: 'route', target: '/collections/bridal?edit=diamond', media: { still: 'p07-hero', video: 'diamond-studio' }, line: 'Bridal pieces in pavé, cluster and uncut stones.' },
  { id: 'bridal', label: 'Bridal', numeral: '03', kind: 'route', target: '/collections/bridal', media: { still: 'p01-hero', video: 'hero-royal' }, line: 'For the day that becomes forever.' },
  { id: 'collections', label: 'Collections', numeral: '04', kind: 'chapter', target: 'collections', media: { still: 'p04-hero', video: 'menu-ambient' }, line: 'Five worlds of the house.' },
  { id: 'bespoke', label: 'Bespoke', numeral: '05', kind: 'modal', target: 'bespoke', media: { still: 'p10-hero' }, line: 'An idea, a stone, a form.' },
  { id: 'house', label: 'Our House', numeral: '06', kind: 'chapter', target: 'heritage', media: { still: 'heritage-facade' }, line: 'Lahore, since 1952.' },
];
