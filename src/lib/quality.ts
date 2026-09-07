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

export function detectQuality(): QualitySnapshot {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  const saveData = Boolean(nav.connection?.saveData);
  const deviceMemory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 4;
  const probe = probeWebGL();
  const software = /swiftshader|llvmpipe|basic render|software/i.test(probe.renderer);

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
    dprCap: Math.min(DPR_CAP[tier], window.devicePixelRatio || 1),
    reducedMotion,
    coarse,
    saveData,
    webgl: probe.ok && !software,
    renderer: probe.renderer,
  };
}
