/**
 * Consumer-facing copy for the homepage chapters. Register: no exclamation marks, no
 * superlatives — and "House" is not Waseem's name for itself. Say Waseem, Waseem Jewellers,
 * our jewellers, our team, a Waseem consultant. See BRAND.md.
 */
export const COPY = {
  hero: {
    eyebrow: 'Waseem Jewellers · Lahore · Since 1952',
    collection: 'Rukh-e-Jana',
    line: 'A celebration of heritage, devotion and eternal beauty.',
    cta: 'Discover the collection',
    /** The film's credit: the collection it was shot for, and the listed piece from it. */
    credit: 'In the film',
    view: 'View the piece',
  },
  closeLook: {
    eyebrow: 'The Close Look',
    /** {total} is the live count of listable pieces. */
    title: (total: number) => `${total} pieces are in the collection. Look closely at one.`,
    line: 'One photograph, and the parts of it named in place. Nothing is rendered — it is the same frame, looked at from the distance a jeweller looks from.',
    view: 'View the piece',
    more: 'Two more to begin with',
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
    closing: 'CRAFTED ACROSS GENERATIONS.',
  },
  collections: {
    eyebrow: 'Signature Collections',
    cursor: 'Explore',
  },
  bridal: {
    eyebrow: 'Bridal',
    opening: 'For the day that becomes forever',
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
  wall: {
    eyebrow: 'Selected Pieces',
    title: 'Chosen at MM Alam Road.',
    cursor: 'View piece',
    /** The scene slot: gold looked at closely, then the door to the set it belongs to. */
    figure: { eyebrow: 'Gold, closely', view: 'View the set' },
  },
  slider: {
    eyebrow: 'The Collection',
    hint: 'Drag',
  },
  duality: {
    // the giant word names the material; the line beneath names the department it opens
    heading: 'Gold and Diamond',
    gold: { word: 'Gold', title: 'Gold', line: 'Pendants, chains, bangles, rings — mostly 21 karat' },
    diamond: { word: 'Diamond', title: 'Diamond', line: 'Set in gold, graded as published' },
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
