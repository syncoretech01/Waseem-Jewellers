'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQualityStore } from './qualityStore';
import { useSiteStore } from './siteStore';
import { safeStorage } from '@/lib/safeStorage';
import { runtime } from './runtime';
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

/**
 * Clears what earlier builds kept in the browser. The selection ledger — a saved list of
 * pieces under `wj:selection:v1` and `v2` — is no longer offered anywhere on the site, so a
 * returning visitor's browser should not go on holding it. Nothing else is persisted.
 */
export function StorageSweeper() {
  useEffect(() => {
    for (const key of ['wj:selection:v1', 'wj:selection:v2']) safeStorage.removeItem(key);
  }, []);
  return null;
}
