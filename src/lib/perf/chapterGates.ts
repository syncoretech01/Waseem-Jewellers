/**
 * The gates lazily hydrated chapters wait behind (`src/components/motion/LazyChapter.tsx`).
 *
 * One promise per chapter id, opened by the chapter's own wrapper when the visitor approaches
 * or the page goes idle — and all at once by `openAllChapterGates()` before a programmatic
 * glide, so a chapter the concierge or the menu is about to take the visitor to exists by the
 * time they arrive. A plain module rather than part of the component, so the runtime's
 * `scrollTo` can open the gates without importing React.
 */

export interface ChapterGate {
  promise: Promise<void>;
  open: () => void;
  opened: boolean;
}

const gates = new Map<string, ChapterGate>();

export function chapterGate(id: string): ChapterGate {
  let g = gates.get(id);
  if (!g) {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    const gate: ChapterGate = {
      promise,
      opened: false,
      open: () => {
        if (gate.opened) return;
        gate.opened = true;
        resolve();
      },
    };
    gates.set(id, gate);
    g = gate;
  }
  return g;
}

/** Opens every gate: every lazy chapter hydrates now. */
export function openAllChapterGates() {
  for (const g of gates.values()) g.open();
}

let idleScheduled = false;

/**
 * Opens the pending gates one at a time, one per idle callback, in the order the chapters
 * were registered (top of the page first). One chapter's hydration per quiet moment, rather
 * than all of them in the first — which would land beside the craft object's compile in the
 * same idle window and put a long task under the hero.
 */
export function hydrateChaptersOnIdle() {
  if (idleScheduled || typeof window === 'undefined') return;
  idleScheduled = true;
  const next = () => {
    const pending = [...gates.values()].find((g) => !g.opened);
    if (!pending) {
      idleScheduled = false;
      return;
    }
    pending.open();
    schedule();
  };
  const schedule = () => {
    // Safari has no requestIdleCallback; a short timeout stands in for it there
    const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
    if (ric) ric(next, { timeout: 4000 });
    else window.setTimeout(next, 700);
  };
  schedule();
}

/** For the inspector: which chapters are still waiting. */
export function pendingChapterGates(): string[] {
  return [...gates.entries()].filter(([, g]) => !g.opened).map(([id]) => id);
}
