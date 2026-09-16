import type { CollectionWorld } from './types';

/**
 * The five signature collection worlds of CH04. `imagery.hero` is the portrait the FLIP into
 * /collections/bridal?world= lands on; `imagery.piece` is the frame that leads the column —
 * the jewellery itself, a macro wherever one was cut, so a world is met as its pieces before
 * it is met as its model. Urdu is only present where the campaign title cards show it (Dewan).
 */
export const WORLDS: CollectionWorld[] = [
  {
    slug: 'rukh-e-jana',
    name: 'Rukh-e-Jana',
    numeral: 'I',
    mood: 'Velvet, candlelight and gold.',
    palette: { bg: '#1a0f12', accent: '#5a1f2b' },
    imagery: { column: ['p02-hero', 'p02-third', 'w-rukh-3'], hero: 'p02-third', piece: 'p02-second', pieceFocus: '50% 70%' },
    href: '/collections/bridal?world=rukh-e-jana',
    pieces: ['rukh-e-jana-pleated-collar'],
  },
  {
    slug: 'aks-e-noor',
    name: 'Aks-e-Noor',
    numeral: 'II',
    mood: 'Gold against a gold lattice.',
    palette: { bg: '#1b1508', accent: '#a8894f' },
    imagery: { column: ['p05-second', 'p05-hero', 'w-aks-3'], hero: 'p05-hero', piece: 'p05-macro' },
    href: '/collections/bridal?world=aks-e-noor',
    pieces: ['aks-e-noor-satlada-haar'],
  },
  {
    slug: 'rang-e-jamal',
    name: 'Rang-e-Jamal',
    numeral: 'III',
    mood: 'Emerald and diamond on ivory.',
    palette: { bg: '#0f1a16', accent: '#12463a' },
    imagery: { column: ['p06-hero', 'p06-second', 'w-rang-3'], hero: 'p06-second', piece: 'p06-macro' },
    href: '/collections/bridal?world=rang-e-jamal',
    pieces: ['rang-e-jamal-emerald-suite'],
  },
  {
    slug: 'dewan',
    name: 'Dewan',
    urdu: 'دیوان',
    numeral: 'IV',
    mood: 'Lanterns, haze and diamonds.',
    palette: { bg: '#15131c', accent: '#b9afc9' },
    imagery: { column: ['w-dewan-1', 'p04-hero', 'w-dewan-3'], hero: 'p04-hero', piece: 'p04-macro' },
    href: '/collections/bridal?world=dewan',
    pieces: ['dewan-bridal-suite'],
  },
  {
    slug: 'royal-wedding',
    name: 'Royal Wedding',
    numeral: 'V',
    mood: 'Polki by candlelight.',
    palette: { bg: '#0b0a09', accent: '#d8c3a5' },
    imagery: { column: ['p01-hero', 'p01-third', 'p01-second'], hero: 'p01-third', piece: 'p01-second', pieceFocus: '50% 58%' },
    href: '/collections/bridal?world=royal-wedding',
    pieces: ['royal-wedding-polki-raani-haar'],
  },
];

export const WORLD_BY_SLUG = Object.fromEntries(WORLDS.map((w) => [w.slug, w])) as Record<string, CollectionWorld>;
