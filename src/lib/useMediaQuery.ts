'use client';

import { useSyncExternalStore } from 'react';

/**
 * A media query as a value. Server-rendered as `false`, then the live answer — with no
 * setState inside an effect, so the first client paint and the first subscription agree.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The width at which the concierge is a rail beside the page rather than a sheet over it. */
export const RAIL_QUERY = '(min-width: 1280px)';
