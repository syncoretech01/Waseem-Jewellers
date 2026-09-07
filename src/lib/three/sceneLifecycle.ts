'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from '@/lib/motion/gsap';
import { createStudioEnvironment, createGemEnvironment } from './studioEnvironment';

/**
 * Demand rendering driven from outside React: a ticker asks for a frame whenever
 * `needsFrame()` says something changed (scroll progress, pointer, state targets still
 * settling). Nothing renders while the scene is still.
 */
export function useDemandInvalidate(needsFrame: () => boolean) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const tick = () => {
      if (needsFrame()) invalidate();
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
    };
  }, [needsFrame, invalidate]);
}

/** Mounts the procedural studio as `scene.environment`; returns the cube texture for refraction. */
export function useStudioEnvironment(size = 256) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  // cached per renderer; it lives as long as the renderer does
  const env = useMemo(() => createStudioEnvironment(gl, size), [gl, size]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- the scene is a mutable three.js object
    scene.environment = env.texture;
    return () => {
      if (scene.environment === env.texture) scene.environment = null;
    };
  }, [scene, env]);
  return env.texture;
}

/** The stone's own light tent (never set as the scene environment). */
export function useGemEnvironment(size = 256) {
  const gl = useThree((s) => s.gl);
  return useMemo(() => createGemEnvironment(gl, size), [gl, size]).texture;
}

/** Reports a lost WebGL context so the host can fall back and, once, remount. */
export function useContextLoss(onLost: () => void) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const handler = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', handler);
    return () => el.removeEventListener('webglcontextlost', handler);
  }, [gl, onLost]);
}

/** Disposes every geometry and material beneath an object. */
export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry?.dispose();
      const m = o.material as THREE.Material | THREE.Material[];
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  });
}

export const damp = THREE.MathUtils.damp;
