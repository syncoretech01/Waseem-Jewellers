/**
 * Every consumer-facing concierge string. House register: one or two sentences,
 * no exclamation marks, no software vocabulary, facts only as published.
 *
 * Every line that reports a failure names the next thing the visitor can do — there is no
 * sentence here that leaves them with nothing to press or say. Showrooms, wherever three are
 * named together, are in the order Liberty Market, MM Alam Road, DHA.
 */
export const CONCIERGE = {
  name: 'Waseem Concierge',
  placeholder: 'Ask about a piece, a collection or an appointment.',
  /* the field is narrower than the hero line, so it asks for the same thing in fewer words */
  composerPlaceholder: 'Ask about a piece or an appointment.',
  youMightAsk: 'You might ask',
  suggestions: ['Show me bridal necklaces', 'Something traditional', 'Book an appointment'],
  spokenReplies: 'Spoken replies',
  beginAgain: 'Begin again',
  inView: 'In view',
  broughtFor: 'Brought for',
  compare: 'Compare',
  compareSelected: (n: number) => `Set ${n === 3 ? 'three' : 'two'} side by side`,
  ask: 'Ask',
  bookViewing: 'Book a viewing',
  notPublished: 'not published',
  whichToCompare: 'Tell me which two — the first and the second, say, or their names — and I will set them side by side.',
  compared: (names: string[]) => `${names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join(' and ')}, side by side — only what Waseem publishes, nothing filled in.`,
  letMeShowYou: 'Let me show you',
  youMightSay: 'you might say —',
  /** The next thing to press, wherever a reply could otherwise have ended the conversation. */
  next: {
    tryAgain: 'Try again',
    write: 'Write instead',
    showMe: 'Let me show you',
    once: 'Try that once more',
    nearby: 'Show nearby pieces',
    bridal: 'The bridal pieces',
  },
  voice: {
    /** The state, set as a small label above the line: the visitor always knows which of five things is happening. */
    state: {
      ready: 'Ready',
      listening: 'Listening',
      thinking: 'Thinking',
      bringing: 'Bringing it to you',
      speaking: 'Speaking',
      tryAgain: 'Try again',
      preparing: 'One moment',
      micOff: 'Microphone off',
    },
    ready: 'Speak when you are ready.',
    preparing: 'The microphone, if you will allow it.',
    listening: 'I am listening.',
    thinking: 'A moment.',
    executing: 'Bringing it to you.',
    speaking: 'Speaking.',
    answering: 'Answering.',
    result: 'Here you are.',
    stop: 'Rest the microphone',
    start: 'Speak to the concierge',
    tapToInterrupt: 'Tap to interrupt',
    speakingInterruptible: 'Speaking — tap the ring, or simply speak, to interrupt.',
    hearing: 'A moment — hearing you.',
    hearingUnavailable: 'Hearing is not available just now.',
    /** A rung down from the best hearing this deployment offers — said in the visitor's words, never the engine's. */
    listeningFallback: 'Listening — if I mishear, say it once more or write to me.',
    couldNotHear: 'I did not catch that clearly.',
    /** What is kept of a spoken line the transcript could not write; never shown to a visitor. */
    unheard: 'Not caught in writing.',
    interrupted: 'Go on — I am listening.',
    write: 'Write instead',
    preparingLabel: 'Opening the microphone',
    deniedLabel: 'The microphone is switched off for this site',
    unavailable: 'Speech is not offered in this browser.',
    /** The session ended on its own — the network, or a long silence. */
    sessionEnded: 'The line went quiet.',
  },
  greeting: (hour: number) => `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}. I am the Waseem Concierge — ask about a piece, a collection or an appointment.`,
  greetingAgain: 'Still here. What would you like to see?',
  thanks: 'A pleasure.',
  close: 'Until next time.',
  help: 'I can bring pieces to you, open a collection, set two side by side, or book you a viewing.',
  /**
   * Not understood: one short question, and nothing else. This once listed what the concierge
   * could show, open and book — a paragraph read to every visitor whose sentence the engine
   * could not parse, in English whatever they had spoken. The other languages' lines are in
   * `replies.ts`, beside this one.
   */
  unknown: 'Sorry — once more?',
  outOfScope: 'That is outside what we make, I am afraid. I can help with pieces, collections and appointments.',
  watches: 'We work in gold and diamond jewellery. I can show you pieces, or book a viewing at Liberty Market.',
  micDenied: 'Your microphone is switched off for this site.',
  micNoAnswer: 'The microphone did not open.',
  noSpeech: 'I did not catch that — once more, a little closer.',
  /**
   * Said once, and only once, and only when it is true.
   *
   * No browser on most platforms carries an Urdu or Punjabi voice. Reading the reply aloud in
   * English anyway would be confident nonsense; saying nothing at all would look like a
   * fault. Naming it plainly and continuing in writing is what a person would do.
   */
  noVoiceForLanguage: 'I have no voice for this language in your browser — I will write instead.',
  error: 'Forgive me — shall we try that once more?',
  errorLink: 'once more',
  house: 'Waseem Jewellers was founded in Lahore in 1952 by Chaudhry Muhammad Afzal, and receives visitors today at three showrooms across the city.',
  showrooms: 'Three showrooms in Lahore — Liberty Market, MM Alam Road and DHA — open from noon until half past nine.',
  collections: 'Five worlds — Rukh-e-Jana, Aks-e-Noor, Rang-e-Jamal, Dewan and Royal Wedding. Say a name and I will take you there.',
  bridal: 'Bridal. Take your time — I am here if a piece speaks to you.',
  diamond: 'Diamond — bracelets, pendants, earrings, rings and nose pins set in gold. Shall I open one?',
  gold: 'Gold — pendants, chains, bracelets, bangles and rings, mostly twenty-one karat. Shall I open one?',
  traditional: 'For a traditional hand I would begin with polki and kundan — these are closest to how our jewellers have always worked.',
  consultation: 'With pleasure. Choose a showroom and a time that suits you — Liberty Market, MM Alam Road or DHA.',
  /**
   * Below the confidence floor the engine asks rather than acts. It names both readings, so
   * the visitor answers a question instead of correcting a mistake — and no piece opens that
   * nobody asked for.
   */
  clarify: (a: string, b: string) => `Forgive me — did you mean ${a}, or ${b}?`,
  /** 583 of 599 pieces carry no published price, so a budget is carried rather than filtered on. */
  budgetNoted: 'I have noted the figure you mentioned — most pieces here are priced on request, so I will bring it to our team with your enquiry.',
  byWeight: (n: number) => `${n === 1 ? 'One piece' : `${n} pieces`}, ordered by the weight Waseem publishes. The actual weight is confirmed at a viewing.`,
  similarResult: (n: number) => `${n === 1 ? 'One piece' : `${n} pieces`} in the same spirit.`,
  matchingResult: (n: number) => `${n === 1 ? 'One piece' : `${n} pieces`} that would be worn with it.`,
  priceOf: (name: string, label: string) => `${name} — ${label.toLowerCase()}. I can arrange a viewing whenever suits you.`,
  restart: 'Begun again. What would you like to see?',
  /** Said when the running topic supplied the subject, so the visitor can see it and correct it. */
  stillIn: (topic: string) => `Still in ${topic} — say otherwise and I will widen it.`,
  // true whether or not anything was sent: the reference exists either way
  consultationKnown: (code: string) => `Your reference is ${code}. I can arrange a further viewing whenever you wish.`,
  priceOnRequest: 'This piece is priced on request — we share full details when you visit, and I can book a time.',
  priceKnown: (label: string, karat?: string) => `This piece is ${label}${karat ? `, in ${karat}` : ''}. Shall I arrange a viewing?`,
  /** Saving is not offered on this build; the intent is answered with what is. */
  savingNotOffered: 'Saving pieces is not offered here. I can set two side by side for you, or prepare a viewing.',
  selectionNotOffered: 'There is no saved selection here — tell me what you are looking for and I will bring it, or I can prepare a viewing.',
  whichPiece: 'Which piece would you like? I can bring the bridal pieces first.',
  whichPieceSimilar: 'Show me the piece you have in mind and I will find its company.',
  opened: (name: string) => `Here it is — the ${name}.`,
  similar: 'Four pieces in the same spirit — the same stones, a different hand.',
  similarCount: (n: string) => `${n} pieces in the same spirit — the same stones, a different hand.`,
  world: (name: string, mood: string) => `${name} — ${mood.replace(/\.$/, '').toLowerCase()}. I will leave you with it.`,
  searchResult: (count: string, what: string, houses: string[]) =>
    houses.length > 1
      ? `${count} ${what}, drawn from ${houses.slice(0, -1).join(', ')} and ${houses[houses.length - 1]}. Tell me which one draws you.`
      : `${count} ${what}. Tell me which one draws you.`,
  nothing: 'Nothing quite like that in the collection today. I can show you nearby pieces, or the bridal pieces instead.',
  /** The nearby search, said back: what was kept of the request. */
  nearby: (what: string) => `Nearby — ${what}, with the other conditions set aside.`,
  nearbyNothing: 'Nothing nearby either. Tell me the kind of piece, and I will begin from there.',
  tellAbout: (name: string, lede: string) => `The ${name}: ${lede.charAt(0).toLowerCase()}${lede.slice(1)} Weight, purity and stones are confirmed by our jewellers when you see it in the showroom.`,
  tellAboutSpecs: (name: string, lede: string, specs: string) => `The ${name}: ${lede.charAt(0).toLowerCase()}${lede.slice(1)} ${specs}`,
  labels: {
    searching: (what: string) => `Exploring ${what}…`,
    found: (count: string, what: string) => `${count} ${what}`,
    nothing: 'Nothing quite like that',
    opening: (name: string) => `Opening ${name}…`,
    opened: (name: string) => name,
    showing: (name: string) => `Showing the ${name}…`,
    shown: (name: string) => name,
    similar: 'Pieces in the same spirit…',
    similarDone: (count: string) => `${count} pieces in the same spirit`,
    matching: 'Pieces that would be worn with it…',
    matchingDone: (name: string) => `Worn with the ${name}`,
    matchingNone: 'Nothing in the collection is a natural companion to this one',
    refining: 'Narrowing…',
    /** The weight is published, so the comparison is a real one and can be said plainly. */
    lighterDone: 'Lighter pieces',
    heavierDone: 'Heavier pieces',
    /**
     * The weight is *not* published, so the comparison is one of form. Saying which is the
     * whole point: a visitor told "lighter" assumes a scale was involved.
     */
    lighterByForm: 'Lighter in form',
    heavierByForm: 'Heavier in form',
    weightUnknown: 'Waseem has not published a weight for this piece',
    filtering: 'Refining the page…',
    filtered: (phrase: string) => phrase,
    cleared: 'Filters cleared',
    price: 'Checking what is published…',
    priceOnRequest: 'Price on request',
    consultation: 'Opening the appointment form…',
    consultationDone: 'Appointment form',
    compare: 'Setting them side by side…',
    compareDone: 'Side by side',
    bridal: 'Exploring Bridal…',
    bridalDone: 'Bridal',
    gold: 'Opening Gold…',
    goldDone: 'Gold',
    diamond: 'Opening Diamond…',
    diamondDone: 'Diamond',
    going: (label: string) => `Taking you to ${label}…`,
    gone: (label: string) => label,
    navigating: (label: string) => `Opening ${label}…`,
    // operating the site
    back: 'Going back…',
    backDone: 'Back',
    menu: 'Menu',
    menuClosed: 'Menu closed',
    closing: 'Until next time',
    frame: (n: number, of: number) => `Photograph ${n} of ${of}`,
    framing: 'Turning the photograph…',
    gate: (material: 'gold' | 'diamond') => (material === 'gold' ? 'Gold' : 'Diamond'),
    kinds: 'The kinds',
    // the appointment, at every step
    filling: 'Writing it into the appointment form…',
    filled: 'Noted for your appointment',
    reviewing: 'Reading it back…',
    review: 'Please check the form',
    sending: 'Sending your request…',
    /** Kept on the device, nothing sent: the reference and WhatsApp are the visitor's next step. */
    prepared: (reference: string) => `Ready · ${reference}`,
    delivered: (reference: string) => `Sent · ${reference}`,
    notSent: (reference: string) => `Not sent · ${reference}`,
    missing: 'A detail or two still needed',
  },
} as const;
