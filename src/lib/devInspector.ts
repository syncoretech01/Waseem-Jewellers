/**
 * Development-only leak inspector, exposed as window.__wj. Never renders DOM and
 * is tree-shaken from production builds.
 */
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';

interface Inspector {
  triggers: () => number;
  tweens: () => number;
  tickerFns: () => number;
  gl: () => unknown;
  glInfo: unknown[];
}

declare global {
  interface Window {
    __wj?: Inspector;
  }
}

export function installDevInspector() {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
  const glInfo: unknown[] = [];
  window.__wj = {
    triggers: () => ScrollTrigger.getAll().length,
    tweens: () => gsap.globalTimeline.getChildren(true, true, true).length,
    tickerFns: () => {
      const ticker = gsap.ticker as unknown as { _listeners?: unknown[] };
      return ticker._listeners?.length ?? -1;
    },
    gl: () => glInfo[glInfo.length - 1] ?? null,
    glInfo,
  };
}

export function reportGL(info: unknown) {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
  window.__wj?.glInfo.push(info);
}
