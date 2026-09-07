'use client';

import * as THREE from 'three';

export const GOLD = '#C8A664';
export const EMERALD = '#0e6b4c';

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

/** The stone for lower tiers: a deep, glossy, faintly translucent emerald without ray tracing. */
export function createStoneFallbackMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#12805a'),
    metalness: 0,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    ior: 1.58,
    reflectivity: 1,
    envMapIntensity: 1.6,
    transparent: true,
    opacity: 0.94,
    flatShading: true,
  });
}
