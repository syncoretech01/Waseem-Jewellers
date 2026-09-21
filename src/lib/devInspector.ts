/**
 * Development-only leak inspector, exposed as window.__wj. Never renders DOM and
 * is tree-shaken from production builds.
 */
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { useSiteStore } from '@/state/siteStore';

interface Inspector {
  gsap: typeof gsap;
  triggers: () => number;
  tweens: () => number;
  tickerFns: () => number;
  gl: () => unknown;
  glInfo: unknown[];
  site: () => { consultationOpen: boolean; focusedProduct: string | null; pendingSection: string | null; pendingSpotlight: string | null; section: string | null };
  closeOverlays: () => void;
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
    gsap,
    site: () => {
      const s = useSiteStore.getState();
      return { consultationOpen: s.consultation.open, focusedProduct: s.focusedProduct, pendingSection: s.pendingSection, pendingSpotlight: s.pendingSpotlight, section: s.section };
    },
    closeOverlays: () => {
      const s = useSiteStore.getState();
      s.closeConsultation();
      s.closeMenu();
    },
  };
}

export function reportGL(info: unknown) {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;
  window.__wj?.glInfo.push(info);
}
