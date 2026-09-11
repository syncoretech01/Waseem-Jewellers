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
  },
  invitation: {
    name: 'Waseem Concierge',
    sub: 'Private jewellery assistance',
    prompt: 'Ask about a piece, a collection or a private appointment.',
  },
  craft: {
    eyebrow: 'The Craft',
    title: 'The anatomy of a piece',
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
    house: 'CRAFTED ACROSS GENERATIONS',
    ctaDiscover: 'Discover Bridal',
    ctaConsult: 'Private consultation',
  },
  wall: {
    eyebrow: 'Selected Pieces',
    title: 'Chosen from the salons at MM Alam Road.',
    cursor: 'View piece',
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
    specsNote: 'Waseem publishes only what has been verified for this piece. Weight, purity and stone grading are confirmed at a private viewing.',
    priceNote: 'Priced on request · Private viewing available in Lahore',
  },
  bespoke: {
    eyebrow: 'Bespoke',
    words: ['An idea', 'Stone', 'Form', 'Craft', 'Yours'],
    cta: 'Begin your bespoke journey',
  },
  footer: {
    invitation: 'We receive by appointment.',
    cta: 'Private consultation',
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
    eyebrow: 'Private consultation',
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
      title: 'Your consultation details are ready.',
      line: 'Continue on WhatsApp to send them to Waseem.',
      whatsapp: 'Continue on WhatsApp',
      close: 'Close',
    },
    delivered: {
      title: 'Your request has been received.',
      line: 'A Waseem consultant will be in touch to confirm your private consultation.',
      whatsapp: 'Also send on WhatsApp',
      close: 'Close',
    },
    consent: (contact: string) => `By sending, you agree to our privacy statement. Questions about your data: ${contact}.`,
    consentLink: 'privacy statement',
  },
  ledger: {
    title: 'Your Selection',
    empty: ['Nothing kept yet.', 'Pieces you save will wait for you here.'],
    viewing: 'Arrange a private viewing for these pieces',
    concierge: 'Ask the concierge about these',
    remove: 'Remove',
    discover: 'Discover Bridal',
  },
} as const;
