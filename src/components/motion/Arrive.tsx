'use client';

import { useArrive } from '@/motion/hooks/useFlipTarget';

/** Mount inside any route without a FLIP destination so the curtain lifts on arrival. */
export function Arrive() {
  useArrive();
  return null;
}
