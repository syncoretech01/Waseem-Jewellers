/**
 * Consumer-facing copy for the homepage chapters. Register: no exclamation marks, no
 * superlatives — and "House" is not Waseem's name for itself. Say Waseem, Waseem Jewellers,
 * our jewellers, our team, a Waseem consultant. See BRAND.md.
 */
export const COPY = {
  hero: {
    eyebrow: 'Lahore · Since 1952',
    /** The name is the headline: a jeweller's shop says whose it is before it says anything else. */
    name: ['Waseem', 'Jewellers'],
    /** One proposition, no appointment wording: what is made, and where. */
    line: 'Gold, diamond and bridal jewellery, made in Lahore.',
    /** The door word beneath a piece — the worlds and the bridal room read it. */
    view: 'View the piece',
  },
  window: {
    eyebrow: 'The Collection',
    title: 'Rings, necklaces, earrings. By kind.',
    line: 'Every kind Waseem makes, each shown on one of its pieces. Weight and purity published where Waseem has verified them; priced on request, shown by appointment in Lahore.',
    kinds: 'By kind',
    view: 'View the piece',
    explore: 'Explore',
    all: 'The whole collection',
  },
  departments: {
    gold: {
      eyebrow: 'Gold',
      title: 'Shaped for every day, and for the occasion.',
      line: 'Pendants, chains, bangles, rings and earrings in gold, mostly 21\u00a0karat — weighed and marked as Waseem publishes them.',
      cta: 'Explore Gold',
      /** The figure: gold looked at closely, then the door to the set it belongs to. */
      figure: { eyebrow: 'Gold, closely', view: 'View the set' },
    },
    diamond: {
      eyebrow: 'Diamond',
      title: 'Set with diamonds, graded as published.',
      line: 'Rings, pendants, earrings and bracelets in gold, mostly 18\u00a0karat — colour, clarity and carat where Waseem has them.',
      cta: 'Explore Diamond',
      /** The suite the studio shot: a listed piece with its published grading, closing the chapter. */
      suite: {
        eyebrow: 'One suite, in one light',
        title: 'The earring, the necklace, the pendant.',
        line: (r: { k?: string; w?: number; ct?: number }) => `A bridal suite in diamonds, shown the way it is shown in the showroom: the room dark, one light finding each piece in turn. Waseem publishes it at ${[r.k, r.w !== undefined ? `${r.w} grams` : undefined].filter(Boolean).join(', ')}${r.ct !== undefined ? `, with ${r.ct} carats of diamonds` : ''} — and grades on its own page.`,
      },
    },
    men: { eyebrow: 'Men', title: 'Weight, in the hand.', line: 'Rings, bracelets and cufflinks in gold, for men.', cta: 'Explore Men' },
    kids: { eyebrow: 'Kids', title: 'Small, and made properly.', line: 'Rings and bangles in gold, for children — sized at the showroom.', cta: 'Explore Kids' },
    kinds: 'By kind',
  },
  invitation: {
    eyebrow: 'Waseem Concierge',
    title: 'Ask for what you have in mind.',
    line: 'Speak or write — in English, Urdu or Punjabi. The concierge knows every piece and what Waseem publishes about it, and brings a tray to you.',
    examples: ['Show me something elegant for walima', 'Mujhe baraat ke liye kuch heavy gold mein dikhao', 'menu ehde varga par thora halka dikhao'],
    speak: 'Speak to the concierge',
    write: 'Write instead',
  },
  craft: {
    eyebrow: 'The Craft · a study in emerald',
    title: 'The anatomy of a piece',
    /** What the object is, said plainly beside the eyebrow: a study, not a piece for sale. */
    note: 'A craft object, not a listed piece: an emerald cut and set in gold to show how a ring is made.',
    labels: [
      { key: 'stone', numeral: '01', name: 'Stone', note: 'Chosen for colour first, then cut to keep it.' },
      { key: 'setting', numeral: '02', name: 'Setting', note: 'A closed bezel and four claws hold the stone above the light.' },
      { key: 'metal', numeral: '03', name: 'Metal', note: 'Gold shaped to sit against the skin and carry the weight.' },
      { key: 'finish', numeral: '04', name: 'Hand finishing', note: 'Surfaces brought from matte to mirror, edge by edge.' },
      { key: 'craft', numeral: '05', name: 'Craft', note: 'Set, polished and finished by hand, to be worn for years.' },
    ],
    /** The line the sequence closes on: what the craft is for, in Waseem's own register. */
    closing: ['CRAFTED', 'TO ENDURE.'],
  },
  /** The bangle — a chapter of its own after the craft: one set of bangles, turned in the hand. */
  bangle: {
    eyebrow: 'The Bangle',
    title: 'One set, turned in the hand.',
    line: 'The craft object above is a study. This is a set of bangles Waseem sells, read the way a hand turns it: on its side, close on the surface, along the rhythm of the motif, then raised to show the inside — two photographs the shop took, and nothing else.',
    view: 'View the set',
  },
  /** The goldwork — a chapter of its own after Gold: from the work to the piece. */
  goldwork: {
    eyebrow: 'Goldwork',
    title: 'From the work to the piece.',
    line: 'Gold looked at the way a jeweller looks at it: the pattern of one panel, the relief of the links, the edge of the medallion — and then the whole haar, on velvet, as the campaign photographed it.',
    hint: 'Rest on a point to look closer.',
    view: 'View the piece',
  },
  /** One suite, in one light — a chapter of its own after Diamond. */
  light: {
    eyebrow: 'One suite, in one light',
    title: 'The earring, the necklace, the pendant.',
    line: 'A bridal suite in diamonds, shown the way it is shown in the showroom: the room dark, one light finding each piece in turn.',
    opening: 'The suite',
    openingNote: 'Necklace, pendant and chandelier earrings, photographed as they are worn together.',
    closing: 'Worn together',
    view: 'View the suite',
  },
  /** CH03 — the gate: two material worlds in one frame, and the way into each department. */
  gate: {
    eyebrow: 'Two material worlds',
    heading: 'Gold and diamond — choose a world.',
    hint: 'Move across the frame. Choose a side to enter.',
    inFrame: 'In frame',
    handle: 'Move the split between gold and diamond',
    gold: {
      word: 'GOLD',
      line: 'Jewellery in 21K gold, shaped for everyday and occasion — weighed and marked as Waseem publishes it.',
      cta: 'Enter Gold',
      aria: 'Gold — pendants, chains, bangles, rings and earrings, mostly in 21 karat gold. Enter the department.',
    },
    diamond: {
      word: 'DIAMOND',
      line: 'Pieces set with diamonds, graded as published — colour, clarity and carat where Waseem has verified them.',
      cta: 'Enter Diamond',
      aria: 'Diamond — pieces set with diamonds, graded as Waseem publishes them. Enter the department.',
    },
  },
  heritage: {
    eyebrow: 'Since 1952',
    title: 'Since 1952. Three showrooms.',
    line: 'Waseem Jewellers has sold gold in Lahore since 1952 — founded by Chaudhry Muhammad Afzal, expanded by Chaudhry Waseem Afzal, three showrooms today.',
    showrooms: 'Showrooms',
    cta: 'Book an appointment',
  },
  collections: {
    eyebrow: 'Signature Collections',
    cursor: 'Explore',
  },
  bridal: {
    eyebrow: 'Bridal',
    opening: 'For the day that becomes forever',
    title: 'Bridal, shown by appointment.',
    line: 'Complete suites in polki, gold and diamond — choker, haar, tikka and earrings made to be worn together.',
    closing: ['FOR THE DAY', 'THAT BECOMES', 'FOREVER.'],
    /** The film's credit — the collection it was shot for, and the piece from it that is listed. */
    credit: 'From the Naqsh-e-Gul collection',
    ctaDiscover: 'Discover Bridal',
    ctaConsult: 'Book a bridal appointment',
    close: {
      eyebrow: 'A suite, named in place',
      title: 'Four pieces. One photograph.',
      line: 'Tikka, earrings, choker and haar, as they were worn for the shoot — the figure travels between them and says what each one is.',
      view: 'View the suite',
    },
  },
  product: {
    specsNote: 'Waseem publishes only what has been verified for this piece. Weight, purity and stone grading are confirmed when you see it in Lahore.',
    priceNote: 'Viewings in Lahore by appointment',
  },
  bespoke: {
    eyebrow: 'Bespoke',
    title: 'Made for one person.',
    line: 'Every piece leaves the workshop once. Bring an idea, a stone or a photograph; our jewellers draw it, set it and finish it with you.',
    /** The four things bespoke means here, said once each, beneath the title. */
    tenets: ['Personal craft', 'Precision', 'One-to-one design', 'Finish'],
    /** The stage line while the pair is whole, then while each part is read, then when it is whole again. */
    opening: { label: 'One pair', note: 'Read at the joints, as a jeweller reads it: crown, bell, tassel.' },
    closing: { label: 'Whole again', note: 'The parts are one photograph; a bespoke pair begins the same way, as a drawing of the parts.' },
    cta: 'Begin your bespoke journey',
    view: 'View the pair',
  },
  /**
   * The custom cursor's vocabulary. One word per state, and a state per kind of act: view a
   * piece, explore a collection or world, open a panel, ask the concierge, listen,
   * close, drag, inspect, compare. "Discover" used to cover six of these and said nothing.
   */
  cursor: {
    view: 'View',
    explore: 'Explore',
    open: 'Open',
    ask: 'Ask',
    listen: 'Listen',
    close: 'Close',
    drag: 'Drag',
    inspect: 'Inspect',
    compare: 'Compare',
    play: 'Play',
    pause: 'Pause',
  },
  footer: {
    invitation: 'We receive by appointment.',
    cta: 'Book an appointment',
    mark: 'Waseem Jewellers',
    since: 'Since 1952',
    correspondence: 'Occasional letters from Waseem.',
    /**
     * Nothing receives this address yet — it is kept on the device and nowhere else. The line
     * used to promise a letter, which nobody was positioned to send. Same rule as the
     * consultation form: say what happened, not what a finished system would have done.
     */
    correspondenceSuccess: 'Noted. Letters have not begun; when they do, this is where they will go.',
    legal: '© 2026 Waseem Jewellers · Lahore',
  },
  consultation: {
    eyebrow: 'Book an appointment',
    title: 'Meet us in Lahore.',
    sub: 'Lahore · By appointment',
    /**
     * Two acknowledgements, because two different things can have happened.
     *
     * While no destination is configured — every deployment today — nothing has left the
     * visitor's device, so "received" would be untrue and "a consultant will be in touch"
     * a promise nobody is positioned to keep. That state says what is true: the details are
     * ready, and WhatsApp is how they reach Waseem. Only a submission the server actually
     * delivered may say Waseem has it.
     */
    ready: {
      title: 'Your appointment details are ready.',
      line: 'Continue on WhatsApp to send them to Waseem.',
      whatsapp: 'Continue on WhatsApp',
      close: 'Close',
    },
    delivered: {
      title: 'Your request has been received.',
      line: 'Our team will be in touch to confirm your appointment.',
      whatsapp: 'Also send on WhatsApp',
      close: 'Close',
    },
    consent: (contact: string) => `By sending, you agree to our privacy statement. Questions about your data: ${contact}.`,
    consentLink: 'privacy statement',
  },
} as const;
