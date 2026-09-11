'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQualityStore } from './qualityStore';
import { migrateSelectionStorage, useSiteStore } from './siteStore';
import { runtime } from './runtime';
import { loadIndex } from '@/data/clientIndex';
import { installFpsMonitor } from '@/lib/perf/fpsMonitor';

/** Resolves the quality tier once on the client and follows reduced-motion changes live. */
export function QualityDetector() {
  const detect = useQualityStore((s) => s.detect);
  const setReducedMotion = useQualityStore((s) => s.setReducedMotion);
  useEffect(() => {
    detect();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    // detection says what the device claims; the monitor says what it is achieving
    const uninstall = installFpsMonitor();
    return () => {
      mq.removeEventListener('change', onChange);
      uninstall();
    };
  }, [detect, setReducedMotion]);
  return null;
}

/** Publishes the App Router instance to the imperative runtime registry. */
export function RuntimeBridge() {
  const router = useRouter();
  useEffect(() => {
    runtime.router = router;
    return () => {
      if (runtime.router === router) runtime.router = null;
    };
  }, [router]);
  return null;
}

/** Publishes pathname + search (with an epoch) so experiences react to soft navigations. */
export function RouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const setRoute = useSiteStore((s) => s.setRoute);
  useEffect(() => {
    setRoute(pathname, search);
  }, [pathname, search, setRoute]);
  return null;
}

/** Rehydrates the persisted selection after mount so SSR and client markup agree. */
export function StoreHydrator() {
  useEffect(() => {
    const finish = () => {
      useSiteStore.getState().setHydrated();
      /**
       * A kept piece can stop existing between visits — withdrawn upstream, renamed, or
       * withheld pending a name from Waseem — and the ledger would go on holding a slug
       * that resolves to nothing, showing the visitor a blank card. The index is the only
       * thing that can answer whether a slug is still real, so pruning waits for it rather
       * than running now and emptying the ledger against an index that has not loaded.
       *
       * It is fetched only when something needs it, so this does not pull the catalogue
       * down for a visitor with an empty selection.
       */
      if (!useSiteStore.getState().selection.length) return;
      void loadIndex().then(({ bySlug }) => {
        if (bySlug.size) useSiteStore.getState().pruneSelection((slug) => bySlug.has(slug));
      });
    };
    // v1 -> v2 first, so rehydrate reads a ledger that already carries the old selection
    migrateSelectionStorage();
    const result = useSiteStore.persist.rehydrate();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).then(finish).catch(finish);
    } else {
      finish();
    }
  }, []);
  return null;
}
