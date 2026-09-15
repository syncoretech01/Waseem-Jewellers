import type { Department } from './types';

/**
 * The five departments, written rather than generated.
 *
 * Everything here is either a fact the shop publishes or a statement about how a department
 * is composed — never a claim about the workshop, the provenance of a stone, or a history
 * nobody has told us. Where a department has little to say, it says little; the jewellery is
 * what the page is for.
 *
 * The counts are not written here. They come from the repository at build time, so a page
 * can never print a number the catalogue has stopped supporting.
 */
export interface DepartmentInfo {
  slug: Department;
  name: string;
  /** One line, set in the display face beneath the name. */
  tagline: string;
  /** Two short paragraphs. Factual: what is in here and how it is filed. */
  intro: [string, string];
  /** The eyebrow above the name. */
  eyebrow: string;
  /** What the closing invitation offers. */
  closing: string;
}

export const DEPARTMENTS: DepartmentInfo[] = [
  {
    slug: 'gold',
    name: 'Gold',
    eyebrow: 'LAHORE · SINCE 1952',
    tagline: 'Twenty-one karat, mostly. As it has always been here.',
    intro: [
      'The largest part of what Waseem makes: pendants and chains, bracelets and bangles, rings, earrings and necklaces, in 21, 22 and 18 karat gold.',
      'Almost every piece here publishes its gross weight, which in this market is the figure a buyer asks for first. Filter by it, and the collection sorts the way a jeweller would sort it.',
    ],
    closing: 'Any piece here can be seen, weighed and discussed in Lahore.',
  },
  {
    slug: 'diamond',
    name: 'Diamond',
    eyebrow: 'LAHORE · SINCE 1952',
    tagline: 'Set in gold, graded as published.',
    intro: [
      'Bracelets, pendants, earrings, rings, nose pins and chains set with diamonds, in gold of 18, 21 and 22 karat.',
      'Where Waseem publishes a colour, a clarity and a carat weight, they are shown exactly as written — G&H, VVS1 — and where they are not published, the piece says so rather than borrowing a grade from elsewhere.',
    ],
    closing: 'Stones are examined, and their grading confirmed, when you see them in Lahore.',
  },
  {
    slug: 'bridal',
    name: 'Bridal',
    eyebrow: 'FOR THE DAY THAT BECOMES FOREVER',
    tagline: 'Worn once. Kept for a lifetime.',
    intro: [
      'Complete suites made for the wedding days: chokers and long haars, tikkas, earrings and rings, composed to be worn together and kept apart.',
      'More bridal pieces exist in the showroom than are named here. A suite appears on this page once it can be shown with a name and a filing that are Waseem’s own, not ours.',
    ],
    closing: 'Bridal is shown by appointment, with time set aside for the whole suite.',
  },
  {
    slug: 'men',
    name: 'Men',
    eyebrow: 'LAHORE · SINCE 1952',
    tagline: 'Weight, in the hand.',
    intro: [
      'Rings, bracelets and cufflinks made for men, in 21 and 18 karat gold, some set with diamonds.',
      'These are the heaviest pieces in the collection, and the weight is the point: filter by it and the difference between an everyday band and a piece made to be noticed is immediately legible.',
    ],
    closing: 'Sizing and weight are settled in person, in Lahore.',
  },
  {
    slug: 'kids',
    name: 'Kids',
    eyebrow: 'LAHORE · SINCE 1952',
    tagline: 'Small, and made properly.',
    intro: [
      'Rings and bracelets scaled for children, in the same gold and to the same standard as everything else here.',
      'Nearly all of them weigh under five grams, which is the whole difficulty of making them: the proportions have to survive being that small.',
    ],
    closing: 'Sizes and adjustments are arranged at the showroom.',
  },
];

export const DEPARTMENT_BY_SLUG = Object.fromEntries(DEPARTMENTS.map((d) => [d.slug, d])) as Record<Department, DepartmentInfo>;

/** Menu and landing order. Gold first because it is most of the catalogue. */
export const DEPARTMENT_ORDER: Department[] = ['gold', 'diamond', 'bridal', 'men', 'kids'];

export const isDepartment = (s: string): s is Department => s in DEPARTMENT_BY_SLUG;
