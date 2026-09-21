import { create } from 'zustand';
import { detectQuality, type Tier } from '@/lib/quality';

interface QualityState {
  tier: Tier | 'unresolved';
  dprCap: number;
  reducedMotion: boolean;
  coarse: boolean;
  saveData: boolean;
  webgl: boolean;
  renderer: string;
  premium: boolean;
  weak: boolean;
  detected: boolean;
  /** Resolve the tier. Runs once; `force` re-runs it (used when reduced motion is turned off). */
  detect: (force?: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  /** One step down, from the frame-rate monitor. Never up, never past LOW, never from REDUCED. */
  demote: (to: 'MEDIUM' | 'LOW', measuredFps: number) => void;
  /**
   * The step below LOW: WebGL is withheld, so the craft chapter lets its object go and shows
   * the still of the same object. For a phone that is already LOW and still cannot hold a
   * frame — the visitor gets the prerendered chapter rather than a stuttering live one.
   */
  demoteToStill: (measuredFps: number) => void;
  /** The tier the device was detected at, kept so a demotion can be seen for what it is. */
  detectedTier: Tier | 'unresolved';
  /** The FPS that caused a demotion, or null. For the dev inspector and for honesty in the budget. */
  demotedAtFps: number | null;
}

export const useQualityStore = create<QualityState>()((set, get) => ({
  tier: 'unresolved',
  dprCap: 1,
  reducedMotion: false,
  coarse: false,
  saveData: false,
  webgl: false,
  renderer: '',
  premium: false,
  weak: false,
  detected: false,
  detectedTier: 'unresolved',
  demotedAtFps: null,
  detect: (force = false) => {
    if (typeof window === 'undefined') return;
    // once: the probe creates a WebGL context, and a second detection would undo a demotion
    if (get().detected && !force) return;
    const q = detectQuality();
    set({
      ...q,
      detected: true,
      detectedTier: q.tier,
      demotedAtFps: null,
    });
    const html = document.documentElement;
    html.setAttribute('data-tier', q.tier.toLowerCase());
    html.removeAttribute('data-demoted');
    if (q.weak) html.setAttribute('data-weak', '1');
    if (q.premium) html.setAttribute('data-premium', '1');
  },
  /**
   * The same cascade a detection produces, so nothing downstream needs to know it was a
   * demotion: the DPR cap tightens, `useCanWebGL` flips on the way to LOW, the video picks
   * its lighter variant, and `data-tier` lets CSS follow. REDUCED is untouched because it is
   * the visitor's own preference, and demoting *to* it would be claiming they asked.
   */
  demote: (to, measuredFps) => {
    const current = get();
    if (current.tier === 'REDUCED' || current.tier === 'unresolved') return;
    const order = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
    if (order[to] >= order[current.tier as keyof typeof order]) return;
    set({
      tier: to,
      dprCap: Math.min(to === 'LOW' ? 1 : 1.5, window.devicePixelRatio || 1),
      demotedAtFps: measuredFps,
    });
    document.documentElement.setAttribute('data-tier', to.toLowerCase());
    document.documentElement.setAttribute('data-demoted', String(measuredFps));
  },
  demoteToStill: (measuredFps) => {
    const current = get();
    if (current.tier !== 'LOW' || !current.webgl) return;
    set({ webgl: false, dprCap: 1, demotedAtFps: measuredFps });
    document.documentElement.setAttribute('data-demoted', String(measuredFps));
    document.documentElement.setAttribute('data-still', '1');
  },
  setReducedMotion: (value) => {
    const current = get();
    if (value) {
      set({ reducedMotion: true, tier: 'REDUCED', dprCap: 1 });
      document.documentElement.setAttribute('data-tier', 'reduced');
    } else if (current.tier === 'REDUCED') {
      current.detect(true);
    }
  },
}));

/** Primitive selectors only — Zustand 5 needs stable snapshots. */
export const useTier = () => useQualityStore((s) => s.tier);
export const useIsReduced = () => useQualityStore((s) => s.tier === 'REDUCED');
export const useIsHigh = () => useQualityStore((s) => s.tier === 'HIGH');
export const useIsCoarse = () => useQualityStore((s) => s.coarse);
export const useCanWebGL = () =>
  useQualityStore((s) => s.detected && s.webgl && s.tier !== 'REDUCED' && s.tier !== 'LOW');
export const useDprCap = () => useQualityStore((s) => s.dprCap);
