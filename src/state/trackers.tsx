'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQualityStore } from './qualityStore';
import { useSiteStore } from './siteStore';
import { runtime } from './runtime';

/** Resolves the quality tier once on the client and follows reduced-motion changes live. */
export function QualityDetector() {
  const detect = useQualityStore((s) => s.detect);
  const setReducedMotion = useQualityStore((s) => s.setReducedMotion);
  useEffect(() => {
    detect();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
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
    const finish = () => useSiteStore.getState().setHydrated();
    const result = useSiteStore.persist.rehydrate();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).then(finish).catch(finish);
    } else {
      finish();
    }
  }, []);
  return null;
}
