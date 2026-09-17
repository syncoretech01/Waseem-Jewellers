'use client';

import * as THREE from 'three';

/**
 * The emerald: a small ray tracer for one convex stone.
 *
 * A step cut is a convex polyhedron, so a ray inside it leaves through whichever facet plane
 * it reaches first — no acceleration structure, no dependency, and the facet normal at the
 * hit is exact. The eye ray refracts in at the front facet, bounces by total internal
 * reflection off the pavilion until a facet lets it out, and the light it finally sees is
 * read from the stone's light tent. Along the way the path length is summed and the colour
 * absorbed by Beer–Lambert, so the thick centre goes deep and the thin crown edges stay
 * lively; the exit refraction is split a little by wavelength (beryl's dispersion is low,
 * 0.014, and it is kept there); the polished surface mirrors the studio by Schlick's
 * Fresnel; and a stretched, low-contrast noise along the path stands for the jardin — the
 * silk an emerald is allowed to have.
 */

/** Facet planes (outward unit normal, offset) of a convex, flat-shaded, non-indexed geometry. */
export function facetPlanes(geometry: THREE.BufferGeometry, epsilon = 1e-4): THREE.Vector4[] {
  const pos = geometry.getAttribute('position');
  const planes: THREE.Vector4[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    const d = n.dot(a);
    const seen = planes.some((p) => Math.abs(p.x - n.x) < epsilon && Math.abs(p.y - n.y) < epsilon && Math.abs(p.z - n.z) < epsilon && Math.abs(p.w - d) < epsilon);
    if (!seen) planes.push(new THREE.Vector4(n.x, n.y, n.z, d));
  }
  return planes;
}

/**
 * A tileable value-noise volume, two octaves, one byte per texel: the jardin is one trilinear
 * fetch instead of a lattice of hashes per pixel.
 */
function createJardinTexture(size = 32) {
  const data = new Uint8Array(size * size * size);
  const lattice = (period: number, seed: number) => {
    const grid = new Float32Array(period * period * period);
    let x = seed;
    for (let i = 0; i < grid.length; i++) {
      // a small LCG: the same silk on every machine
      x = (x * 1664525 + 1013904223) >>> 0;
      grid[i] = x / 4294967296;
    }
    return (u: number, v: number, w: number) => grid[((w % period) * period + (v % period)) * period + (u % period)]!;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const octave = (period: number, seed: number) => {
    const g = lattice(period, seed);
    return (x: number, y: number, z: number) => {
      const fx = x * period;
      const fy = y * period;
      const fz = z * period;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const iz = Math.floor(fz);
      const tx = smooth(fx - ix);
      const ty = smooth(fy - iy);
      const tz = smooth(fz - iz);
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const c00 = lerp(g(ix, iy, iz), g(ix + 1, iy, iz), tx);
      const c10 = lerp(g(ix, iy + 1, iz), g(ix + 1, iy + 1, iz), tx);
      const c01 = lerp(g(ix, iy, iz + 1), g(ix + 1, iy, iz + 1), tx);
      const c11 = lerp(g(ix, iy + 1, iz + 1), g(ix + 1, iy + 1, iz + 1), tx);
      return lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
    };
  };
  const o1 = octave(4, 7);
  const o2 = octave(8, 19);
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        const w = z / size;
        const n = o1(u, v, w) * 0.62 + o2(u, v, w) * 0.38;
        data[(z * size + y) * size + x] = Math.round(Math.max(0, Math.min(1, n)) * 255);
      }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

export interface EmeraldMaterialOptions {
  /** The stone's light tent — what the light through the stone bends. */
  envMap: THREE.Texture;
  /** The studio — what the polished surface mirrors (the same one the gold sees). */
  reflMap: THREE.Texture;
  /** Facet planes in the stone's own space, from `facetPlanes`. */
  planes: THREE.Vector4[];
  /** Internal bounces before the ray is let out regardless. 2 shows the pavilion through the table; 3 is exact for a step cut. */
  bounces?: number;
  /** Per-channel refractive-index offset at the exit facet. 0 disables the split. */
  dispersion?: number;
  /** Strength of the jardin veil, 0–1. */
  jardin?: number;
}

const DEFAULTS = {
  /** Beryl. */
  ior: 1.57,
  /**
   * Absorption per unit of path (the stone is one unit wide): colour survives a 1-unit path
   * as exp(-absorption), a deep green; red dies first, then blue. Together with the tint this
   * puts the body between #0b5c3f and #0f6b4a and the thick centre below it.
   */
  absorption: new THREE.Vector3(4.2, 0.8, 1.35),
  /** The hue every transmitted ray carries, applied once (linear): green with the blue kept, never yellow. */
  tint: new THREE.Color(0.05, 0.58, 0.42),
  /** Tent light through the stone. */
  envIntensity: 0.85,
  /** Studio in the surface: polished facets hold the studio's strips clearly. */
  reflIntensity: 0.9,
  /** Mip level per unit of path: the deeper the light comes from, the softer it is. */
  depthLod: 0.9,
  /** The gold behind the pavilion as the studio lights it, seen by rays that leave downward (linear). */
  setting: new THREE.Color(0.4, 0.27, 0.1),
} as const;

const vertexShader = /* glsl */ `
  uniform mat4 modelMatrixInverse;
  varying vec3 vObj;
  varying vec3 vNrm;
  varying vec3 vCamObj;
  void main() {
    vObj = position;
    vNrm = normal;
    vCamObj = (modelMatrixInverse * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform samplerCube envMap;
  uniform samplerCube reflMap;
  uniform mat4 modelMatrix;
  uniform vec4 planes[PLANE_COUNT];
  uniform float ior;
  uniform float dispersion;
  uniform vec3 absorption;
  uniform vec3 tint;
  uniform float envIntensity;
  uniform float reflIntensity;
  uniform float depthLod;
  uniform float jardin;
  uniform vec3 setting;
  #ifdef JARDIN
    uniform sampler3D jardinMap;
  #endif
  varying vec3 vObj;
  varying vec3 vNrm;
  varying vec3 vCamObj;

  #ifdef JARDIN
    // the silk: a baked, tileable value noise, stretched along the stone — wisps rather than clouds
    float veil(vec3 p) {
      float n = texture(jardinMap, p * vec3(0.55, 0.22, 0.55) + vec3(0.31, 0.77, 0.13)).r;
      return smoothstep(0.5, 0.82, n);
    }
  #endif

  // the first facet plane a ray leaving from inside reaches
  void exitHit(vec3 o, vec3 d, out float tMin, out vec3 nHit) {
    tMin = 1e9;
    nHit = vec3(0.0, 1.0, 0.0);
    for (int i = 0; i < PLANE_COUNT; i++) {
      // selects rather than branches: on an integrated GPU the predicated form is half the cost
      vec4 pl = planes[i];
      float dn = dot(d, pl.xyz);
      float t = (pl.w - dot(o, pl.xyz)) / max(dn, 1e-6);
      bool closer = dn > 1e-6 && t < tMin;
      tMin = closer ? t : tMin;
      nHit = closer ? pl.xyz : nHit;
    }
    tMin = max(tMin, 0.0);
  }

  vec3 toWorld(vec3 d) {
    return normalize(mat3(modelMatrix) * d);
  }

  void main() {
    vec3 N = normalize(vNrm);
    vec3 V = normalize(vObj - vCamObj);
    float cosI = clamp(-dot(V, N), 0.0, 1.0);
    float f0 = (ior - 1.0) / (ior + 1.0);
    f0 *= f0;
    float F = f0 + (1.0 - f0) * pow(1.0 - cosI, 5.0);

    // the polished surface: the studio's panels are bright enough to bleach a facet seen at a
    // grazing angle, so the reflection is compressed — a highlight, never a white sheet
    vec3 refl = textureLod(reflMap, toWorld(reflect(V, N)), 1.2).rgb;
    refl = refl / (1.0 + refl) * reflIntensity;

    // into the stone
    vec3 d = refract(V, N, 1.0 / ior);
    vec3 o = vObj + d * 1e-4;
    float path = 0.0;
    vec3 outG = d;
    vec3 outR = d;
    vec3 outB = d;
    vec3 firstHit = vObj;
    bool exited = false;
    for (int b = 0; b < BOUNCES; b++) {
      float t;
      vec3 nHit;
      exitHit(o, d, t, nHit);
      path += t;
      vec3 hit = o + d * t;
      if (b == 0) firstHit = hit;
      vec3 tr = refract(d, -nHit, ior);
      if (dot(tr, tr) > 0.0) {
        outG = tr;
        #ifdef SPLIT
          outR = refract(d, -nHit, ior - dispersion);
          outB = refract(d, -nHit, ior + dispersion);
          if (dot(outR, outR) == 0.0) outR = outG;
          if (dot(outB, outB) == 0.0) outB = outG;
        #endif
        exited = true;
        break;
      }
      d = reflect(d, nHit);
      o = hit + d * 1e-4;
    }
    if (!exited) {
      // still inside after the last bounce: the light it would have met next
      outG = d;
      outR = d;
      outB = d;
      path += 0.4;
    }

    float lod = depthLod * path;
    vec3 wG = toWorld(outG);
    #ifdef SPLIT
      vec3 light = vec3(textureLod(envMap, toWorld(outR), lod).r, textureLod(envMap, wG, lod).g, textureLod(envMap, toWorld(outB), lod).b);
    #else
      vec3 light = textureLod(envMap, wG, lod).rgb;
    #endif
    // rays that leave through the pavilion meet the closed bezel, not the tent: the gold's
    // reflection, which itself came in through the stone and paid the absorption once already
    float below = smoothstep(-0.05, -0.55, wG.y);
    light = mix(light, setting * exp(-absorption * 0.7), below);

    // absorption along the path, and the silk that scatters a little of it
    vec3 T = exp(-absorption * path);
    #ifdef JARDIN
      float j = jardin * veil(mix(vObj, firstHit, 0.6));
      vec3 ambient = textureLod(envMap, wG, 5.0).rgb;
      vec3 seen = mix(light, ambient * 1.15, j * 0.7);
      vec3 body = seen * envIntensity * T * tint;
      body += ambient * tint * j * 0.09 * (1.0 - T.g);
    #else
      vec3 body = light * envIntensity * T * tint;
    #endif
    // the faintest scatter: nothing in the stone is ever black
    body += tint * 0.01;

    vec3 col = body * (1.0 - F) + refl * F;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class EmeraldMaterial extends THREE.ShaderMaterial {
  private readonly inverse = new THREE.Matrix4();
  private readonly jardinMap: THREE.Data3DTexture | null;

  constructor({ envMap, reflMap, planes, bounces = 2, dispersion = 0.008, jardin = 0.3 }: EmeraldMaterialOptions) {
    const jardinMap = jardin > 0 ? createJardinTexture() : null;
    super({
      name: 'EmeraldMaterial',
      defines: {
        PLANE_COUNT: String(planes.length),
        BOUNCES: String(Math.max(1, Math.min(4, Math.round(bounces)))),
        ...(dispersion > 0 ? { SPLIT: '' } : {}),
        ...(jardin > 0 ? { JARDIN: '' } : {}),
      },
      uniforms: {
        envMap: { value: envMap },
        reflMap: { value: reflMap },
        planes: { value: planes },
        modelMatrixInverse: { value: new THREE.Matrix4() },
        ior: { value: DEFAULTS.ior },
        dispersion: { value: dispersion },
        absorption: { value: DEFAULTS.absorption.clone() },
        tint: { value: DEFAULTS.tint.clone() },
        envIntensity: { value: DEFAULTS.envIntensity },
        reflIntensity: { value: DEFAULTS.reflIntensity },
        depthLod: { value: DEFAULTS.depthLod },
        jardin: { value: jardin },
        jardinMap: { value: jardinMap },
        setting: { value: DEFAULTS.setting.clone() },
      },
      vertexShader,
      fragmentShader,
    });
    this.jardinMap = jardinMap;
  }

  override dispose() {
    this.jardinMap?.dispose();
    super.dispose();
  }

  /** Call from the mesh's `onBeforeRender`, once its world matrix is current. */
  update(mesh: THREE.Object3D) {
    this.inverse.copy(mesh.matrixWorld).invert();
    (this.uniforms.modelMatrixInverse!.value as THREE.Matrix4).copy(this.inverse);
  }

  /** Hand finishing brightens the stone's surface a breath: the polish, not the colour. */
  setPolish(polish: number) {
    this.uniforms.reflIntensity!.value = DEFAULTS.reflIntensity * (0.9 + 0.35 * polish);
    this.uniforms.envIntensity!.value = DEFAULTS.envIntensity * (0.94 + 0.12 * polish);
  }
}
