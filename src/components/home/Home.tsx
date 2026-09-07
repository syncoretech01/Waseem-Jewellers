'use client';

import { useEffect } from 'react';
import { useSiteStore } from '@/state/siteStore';

/**
 * The homepage experience. The full chapter sequence (CH00–CH10) arrives with M4;
 * until then the house mark stands alone and the loading ritual is considered complete on mount.
 */
export function Home() {
  const setLoaderDone = useSiteStore((s) => s.setLoaderDone);
  useEffect(() => {
    setLoaderDone(true);
  }, [setLoaderDone]);
  return (
    <main className="min-h-svh">
      <section className="flex min-h-svh flex-col items-center justify-center gap-6 px-gutter text-center">
        <p className="micro text-fg-2">Since 1952</p>
        <h1 className="display text-display-l">The House of Waseem</h1>
      </section>
    </main>
  );
}
