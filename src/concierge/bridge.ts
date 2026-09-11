/**
 * A tiny bridge so any component can ask for the concierge without importing it:
 * product ENQUIRE, the collection intro line, the ledger, the 404 page.
 */
export interface ConciergeRequest {
  /**
   * What to do. `open` is the default and what every caller meant before this existed;
   * `close`, `expand` and `toggle` let the orb drive the panel without importing the
   * controller — which is what kept the whole concierge graph in the initial bundle.
   */
  action?: 'open' | 'close' | 'expand' | 'toggle';
  mode?: 'chat' | 'voice';
  /** Pre-composed visitor line, submitted immediately. */
  submit?: string;
  /** Text placed in the field but not sent. */
  prefill?: string;
  product?: string;
  collection?: string;
  autoListen?: boolean;
  example?: boolean;
}

const EVENT = 'wj:concierge';

export function requestConcierge(req: ConciergeRequest = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ConciergeRequest>(EVENT, { detail: req }));
}

export function onConciergeRequest(handler: (req: ConciergeRequest) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<ConciergeRequest>).detail ?? {});
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
