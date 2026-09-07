import { create } from 'zustand';
import { detectQuality, type Tier } from '@/lib/quality';

export type OrbRenderer = 'webgl' | 'static';

interface QualityState {
  tier: Tier | 'unresolved';
  dprCap: number;
  reducedMotion: boolean;
  coarse: boolean;
  saveData: boolean;
  webgl: boolean;
  renderer: string;
  detected: boolean;
  orbRenderer: OrbRenderer;
  detect: () => void;
  setReducedMotion: (value: boolean) => void;
}

export const useQualityStore = create<QualityState>()((set, get) => ({
  tier: 'unresolved',
  dprCap: 1,
  reducedMotion: false,
  coarse: false,
  saveData: false,
  webgl: false,
  renderer: '',
  detected: false,
  orbRenderer: 'static',
  detect: () => {
    if (typeof window === 'undefined') return;
    const q = detectQuality();
    set({
      ...q,
      detected: true,
      orbRenderer: q.webgl && q.tier !== 'REDUCED' ? 'webgl' : 'static',
    });
    document.documentElement.setAttribute('data-tier', q.tier.toLowerCase());
  },
  setReducedMotion: (value) => {
    const current = get();
    if (value) {
      set({ reducedMotion: true, tier: 'REDUCED', dprCap: 1, orbRenderer: 'static' });
      document.documentElement.setAttribute('data-tier', 'reduced');
    } else if (current.tier === 'REDUCED') {
      current.detect();
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
