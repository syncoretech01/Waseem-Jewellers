/** Quality-tier detection. Runs once on the client; the SSR tree is tier-neutral. */
export type Tier = 'HIGH' | 'MEDIUM' | 'LOW' | 'REDUCED';

export interface QualitySnapshot {
  tier: Tier;
  dprCap: number;
  reducedMotion: boolean;
  coarse: boolean;
  saveData: boolean;
  webgl: boolean;
  renderer: string;
  /**
   * A phone that can carry more than the LOW floor: an Apple GPU, a recent Adreno or Mali, or
   * eight gigabytes reported. It stays LOW (the tier every phone path is written against) but
   * the craft object renders at DPR 1.5 rather than 1, so the ring is not soft on a 3× screen.
   */
  premium: boolean;
  /**
   * The other end: two gigabytes or two cores, or a visitor who asked to save data. The tier
   * is LOW and WebGL is withheld, so the craft chapter shows its prerendered still and the
   * three chunk is never fetched — the "premium static" device, not a stuttering live one.
   */
  weak: boolean;
}

const DPR_CAP: Record<Tier, number> = { HIGH: 1.75, MEDIUM: 1.5, LOW: 1, REDUCED: 1 };

function probeWebGL(): { ok: boolean; renderer: string; maxTexture: number } {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return { ok: false, renderer: '', maxTexture: 0 };
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { ok: true, renderer, maxTexture };
  } catch {
    return { ok: false, renderer: '', maxTexture: 0 };
  }
}

function readOverride(): Tier | null {
  const allowed = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_QA_TIER_OVERRIDE === '1';
  if (!allowed) return null;
  const value = new URLSearchParams(window.location.search).get('tier')?.toUpperCase();
  return value === 'HIGH' || value === 'MEDIUM' || value === 'LOW' || value === 'REDUCED' ? value : null;
}

/** A phone GPU from the last few generations, by the unmasked renderer string. */
const PREMIUM_MOBILE_GPU = /apple gpu|apple a1[5-9]|apple m|adreno \(tm\) (7|8)\d\d|adreno (7|8)\d\d|mali-g7[1-9]|mali-g[89]\d|immortalis|xclipse/i;

export function detectQuality(): QualitySnapshot {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  const saveData = Boolean(nav.connection?.saveData);
  const deviceMemory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 4;
  const probe = probeWebGL();
  const software = /swiftshader|llvmpipe|basic render|software/i.test(probe.renderer);
  // two gigabytes or two cores is a device that should be handed a still, not a scene
  const weak = deviceMemory <= 2 || cores <= 2 || saveData;
  const premium = coarse && !weak && (PREMIUM_MOBILE_GPU.test(probe.renderer) || deviceMemory >= 8);

  let tier: Tier;
  if (reducedMotion) tier = 'REDUCED';
  else if (coarse || saveData || deviceMemory <= 4 || window.innerWidth < 768) tier = 'LOW';
  else if (!probe.ok || software) tier = 'LOW';
  else if (/intel|uhd|iris|hd graphics|mali|adreno|powervr/i.test(probe.renderer) || probe.maxTexture < 8192)
    tier = 'MEDIUM';
  else if (/apple m|apple gpu/i.test(probe.renderer)) tier = 'HIGH';
  else if (!probe.renderer && cores < 8) tier = 'MEDIUM';
  else tier = 'HIGH';

  const override = readOverride();
  if (override) tier = override;

  return {
    tier,
    dprCap: Math.min(tier === 'LOW' && premium ? 1.5 : DPR_CAP[tier], window.devicePixelRatio || 1),
    reducedMotion,
    coarse,
    saveData,
    // a weak device keeps its WebGL for the record and is not given the scene: the still stands
    webgl: probe.ok && (!software || override !== null) && (!weak || override !== null),
    renderer: probe.renderer,
    premium,
    weak,
  };
}
