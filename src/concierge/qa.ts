'use client';

/**
 * The hidden QA view of the voice: what was heard, written where only a tester looks.
 *
 * A visitor never sees a transcript of their own words — a wrong reading printed back is
 * worse than a wrong reading acted on and corrected in one breath. The words are still kept
 * (the session, the tools, the trace and the tests all read them), and a tester can show
 * them with `?qa=1` on the URL or `window.__wjConciergeQA = true` in the console. Off by
 * default on every build, including development.
 */
export function qaMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__wjConciergeQA) return true;
  try {
    return new URLSearchParams(window.location.search).get('qa') === '1';
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    __wjConciergeQA?: boolean;
  }
}
