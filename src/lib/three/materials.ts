'use client';

import * as THREE from 'three';

export const GOLD = '#C8A664';
/** The body colour of the stone: a deep Colombian green, between #0b5c3f and #0f6b4a. */
export const EMERALD = '#0d6445';

/** Yellow gold as the house photographs it: warm, mirror-polished with a soft clearcoat. */
export function createGoldMaterial(overrides: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(GOLD),
    metalness: 1,
    roughness: 0.28,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.25,
    ...overrides,
  });
}

/**
 * The gold that touches the stone — the bezel, the claws, the gallery: the same alloy with the
 * stone's green in it, as a setting reflects the stone it holds. The tint in the base colour
 * is small and fixed; the emissive is the cast proper, and the scene raises and lowers it
 * with the stone's distance from its seat.
 */
export function createCastGoldMaterial(overrides: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return createGoldMaterial({
    color: new THREE.Color(GOLD).lerp(new THREE.Color(EMERALD), 0.09),
    emissive: new THREE.Color('#1c7a52'),
    emissiveIntensity: 0.05,
    ...overrides,
  });
}

/**
 * The stone for LOW: no ray tracing, but the same body. Half-metallic, so every flat facet
 * mirrors the stone's light tent in the body colour — the banded flashes a step cut is known
 * for, without a single refracted ray — over a deep, dark-green floor so the facets turned
 * from the light go to velvet rather than to black. A light clearcoat for the polish, well
 * short of plastic.
 */
export function createStoneFallbackMaterial(envMap: THREE.Texture | null = null) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0c6042'),
    metalness: 0.62,
    roughness: 0.14,
    clearcoat: 0.3,
    clearcoatRoughness: 0.14,
    ior: 1.57,
    envMap,
    envMapIntensity: 1.8,
    emissive: new THREE.Color('#0a4a31'),
    emissiveIntensity: 0.34,
    flatShading: true,
  });
}
