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
    /** {total} is the live count of listable pieces. */
    line: (total: number) => `Gold, diamond and bridal jewellery — ${total} pieces, every weight and purity published.`,
    cta: 'Discover the collection',
    /** The film's credit: the collection it was shot for, and the listed piece from it. */
    credit: 'In the film',
    view: 'View the piece',
    /** Beside a department's name: how many pieces stand behind the door. */
    pieces: (n: number) => `${n} pieces`,
  },
  window: {
    eyebrow: 'The Window',
    title: 'Photographed as they are.',
    /** {total} is the live count of listable pieces. */
    line: (total: number) => `${total} pieces, each with its weight and purity published. Priced on request, shown by appointment in Lahore.`,
    kinds: 'By kind',
    view: 'View the piece',
    all: 'The whole collection',
  },
  departments: {
    gold: {
      eyebrow: 'Gold',
      title: (n: number) => `${n} pieces in gold, mostly 21 karat.`,
      line: 'Pendants, chains, bangles, rings, earrings — weighed and marked, and worn every day in Lahore.',
      cta: 'Explore Gold',
      /** The figure: gold looked at closely, then the door to the set it belongs to. */
      figure: { eyebrow: 'Gold, closely', view: 'View the set' },
    },
    diamond: {
      eyebrow: 'Diamond',
      title: (n: number) => `${n} pieces set with diamonds.`,
      line: 'Set in 18 to 21 karat gold, graded as published — colour, clarity and carat where Waseem has them.',
      cta: 'Explore Diamond',
      /** The suite the studio shot: a listed piece with its published grading, closing the chapter. */
      suite: { eyebrow: 'Graded as published', title: 'A sapphire, in a pavé surround.', line: 'The one diamond suite Waseem photographed as a campaign — and publishes at 21K, 94.68 grams, with 13.26 carats of diamonds graded H and VVS1.' },
    },
    men: { eyebrow: 'Men', title: (n: number) => `${n} pieces for men.`, line: 'Rings, bracelets and cufflinks — weight, in the hand.', cta: 'Explore Men' },
    kids: { eyebrow: 'Kids', title: (n: number) => `${n} pieces for children.`, line: 'Small, and made properly.', cta: 'Explore Kids' },
    kinds: 'By kind',
  },
  invitation: {
    eyebrow: 'Waseem Concierge',
    title: 'Ask for what you have in mind.',
    line: 'Speak or write — in English, Urdu or Punjabi. The concierge knows every piece, its weight and its purity, and brings a tray to you.',
    examples: ['Show me something elegant for walima', 'Mujhe baraat ke liye kuch heavy gold mein dikhao', 'menu ehde varga par thora halka dikhao'],
    speak: 'Speak to the concierge',
    write: 'Write instead',
  },
  craft: {
    eyebrow: 'The Craft',
    title: 'The anatomy of a piece',
    coda: {
      eyebrow: 'The same anatomy, in one piece',
      title: 'Stone, halo, shank.',
      line: 'The object above is a drawing. This is a ring you can see in Lahore: the same parts, photographed once, named where they sit.',
      view: 'View the piece',
    },
    labels: [
      { key: 'stone', numeral: '01', name: 'Stone', note: 'Chosen for colour first, then cut to keep it.' },
      { key: 'setting', numeral: '02', name: 'Setting', note: 'A closed bezel and four claws hold the stone above the light.' },
      { key: 'metal', numeral: '03', name: 'Metal', note: 'Gold shaped to sit against the skin and carry the weight.' },
      { key: 'finish', numeral: '04', name: 'Hand finishing', note: 'Surfaces brought from matte to mirror, edge by edge.' },
      { key: 'craft', numeral: '05', name: 'Craft', note: 'Assembled once, worn for a lifetime.' },
    ],
    closing: ['MADE', 'ONLY ONCE.'],
  },
  heritage: {
    eyebrow: 'Since 1952',
    title: 'Three generations. Three showrooms.',
    line: 'Waseem Jewellers has made and sold gold in Lahore since 1952 — the same family, the same workshop, three showrooms today.',
    showrooms: 'Showrooms',
    closing: 'CRAFTED ACROSS GENERATIONS.',
    cta: 'Book an appointment',
  },
  collections: {
    eyebrow: 'Signature Collections',
    cursor: 'Explore',
  },
  bridal: {
    eyebrow: 'Bridal',
    opening: 'For the day that becomes forever',
    /** {n} is the live count of bridal pieces. */
    title: (n: number) => `${n} bridal pieces, shown by appointment.`,
    line: 'Complete suites in polki, kundan, gold and diamond — choker, haar, tikka and earrings made to be worn together.',
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
    priceNote: 'Priced on request · Viewings in Lahore by appointment',
  },
  bespoke: {
    eyebrow: 'Bespoke',
    title: 'Made for one person.',
    line: 'Every piece leaves the workshop once. Bring an idea, a stone or a photograph, and our jewellers take it from there.',
    /** The words that open and close the figure; the middle ones are the regions' own names. */
    opening: 'One pair',
    closing: 'Yours',
    cta: 'Begin your bespoke journey',
    view: 'View the pair',
  },
  /**
   * The custom cursor's vocabulary. One word per state, and a state per kind of act: view a
   * piece, explore a collection or world, open a panel, ask the concierge, listen, save,
   * close, drag, inspect, compare. "Discover" used to cover six of these and said nothing.
   */
  cursor: {
    view: 'View',
    explore: 'Explore',
    open: 'Open',
    ask: 'Ask',
    listen: 'Listen',
    save: 'Save',
    saved: 'Kept',
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
  ledger: {
    title: 'Your Selection',
    empty: ['Nothing kept yet.', 'Pieces you save will wait for you here.'],
    viewing: 'Book a viewing of these pieces',
    concierge: 'Ask the concierge about these',
    remove: 'Remove',
    discover: 'Discover Bridal',
  },
} as const;
