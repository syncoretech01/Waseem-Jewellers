'use client';

import { lazy, Suspense, useEffect, useMemo, useRef, type ComponentType, type ReactElement } from 'react';
import { useSiteStore, type SectionId } from '@/state/siteStore';
import { chapterGate, hydrateChaptersOnIdle } from '@/lib/perf/chapterGates';

/**
 * A below-fold chapter that is server-rendered in full and hydrated only on approach.
 *
 * The markup is the real chapter at its real height from the first byte — the server renders
 * the component like any other. What is deferred is the client: the chapter's module is not
 * imported, its effects do not run and its ScrollTriggers, observers and SplitText do not
 * exist until the chapter comes within a viewport and a half of the visitor, or the page has
 * been idle for a moment after the loading ritual, whichever is first. Until then React
 * leaves the server's DOM exactly where it is — a Suspense boundary whose content has not
 * resolved is *dehydrated*, never replaced — so nothing pops, nothing reflows and nothing is
 * re-requested. When the gate opens, the chunk arrives, React attaches to the existing nodes
 * in place, and the chapter's own reveals play as they would have.
 *
 * Only for chapters that do not pin. A pin inserts a spacer the height of its scroll, and a
 * spacer arriving late would move every chapter below it under the visitor. The chapters that
 * qualify on the homepage are the department rows, the bridal room and the history.
 *
 * The wrapper carries `data-section`, so a glide requested before the chapter has hydrated
 * (`sectionElement()` falls back to that attribute) still finds where to go; the chapter's
 * own registration takes over once it is mounted. `runtime.scrollTo` opens every gate before
 * it glides, so the chapter is hydrating while the page travels to it.
 */

const MARGIN = '150%';

/**
 * `lazyChapter('gold', () => import('./chapters/Ch03Gold').then((m) => m.Ch03Gold))` returns a
 * component with the chapter's own props. On the server the loader runs at once; on the
 * client it waits for the gate.
 */
export function lazyChapter<P extends object>(id: SectionId, load: () => Promise<ComponentType<P>>): ComponentType<P> {
  const Chapter = lazy(async () => {
    if (typeof window !== 'undefined') await chapterGate(id).promise;
    return { default: await load() };
  });

  function LazyChapter(props: P): ReactElement {
    const ref = useRef<HTMLDivElement>(null);
    /**
     * A dehydrated boundary that receives an update before it has hydrated is client-rendered:
     * React cannot hydrate against new props, so it drops the server DOM and renders the
     * fallback — the pop this component exists to prevent. Two rules keep that from happening:
     * nothing here subscribes to React state (the ritual is watched through the store's own
     * subscription, below), and the boundary element is memoised on the chapter's props, so a
     * render of this wrapper for any other reason hands React the same element and it bails out.
     */
    const boundary = useMemo(
      () => (
        <Suspense fallback={null}>
          <Chapter {...props} />
        </Suspense>
      ),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the prop values, not the props object
      Object.values(props),
    );

    // on approach
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const gate = chapterGate(id);
      if (gate.opened) return;
      if (process.env.NODE_ENV === 'development' && /lazy=never/.test(window.location.search)) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            gate.open();
            io.disconnect();
          }
        },
        { rootMargin: `${MARGIN} 0px` },
      );
      io.observe(el);
      return () => io.disconnect();
    }, []);

    // or in the quiet moments after the ritual, one chapter per idle callback, so no chapter is ever reached cold
    useEffect(() => {
      if (chapterGate(id).opened) return;
      if (process.env.NODE_ENV === 'development' && /lazy=(never|approach)/.test(window.location.search)) return;
      const past = (s: { loaderDone: boolean; routeKind: string }) => s.loaderDone || s.routeKind !== 'home';
      if (past(useSiteStore.getState())) {
        hydrateChaptersOnIdle();
        return;
      }
      return useSiteStore.subscribe((s) => {
        if (past(s)) hydrateChaptersOnIdle();
      });
    }, []);

    return (
      <div ref={ref} data-section={id} data-lazy-chapter={id}>
        {boundary}
      </div>
    );
  }
  LazyChapter.displayName = `LazyChapter(${id})`;
  return LazyChapter;
}
