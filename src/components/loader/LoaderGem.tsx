'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createStoneGeometry } from '@/lib/three/gemGeometry3d';
import { useGemEnvironment, damp } from '@/lib/three/sceneLifecycle';

interface LoaderGemProps {
  /** 0…1, follows the ritual's fill. */
  progress: () => number;
  /** true once the ritual is leaving: the camera dollies into the crown. */
  exiting: () => boolean;
  onFirstFrame?: () => void;
}

/**
 * Progressive enhancement over the SVG stone: the same step cut seen from above through an
 * orthographic camera, so its outline matches the drawing exactly; it rises additively with the
 * facets, then dollies into the crown as the ritual hands over to the hero.
 */
export function LoaderGem({ progress, exiting, onFirstFrame }: LoaderGemProps) {
  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      orthographic
      camera={{ position: [0, 6, 0], zoom: 1, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl, camera }) => {
        gl.setClearColor(0x000000, 0);
        // a camera looking straight down needs an up vector off its own axis
        camera.up.set(0, 0, -1);
        camera.lookAt(0, 0, 0);
      }}
    >
      <Stone progress={progress} exiting={exiting} onFirstFrame={onFirstFrame} />
    </Canvas>
  );
}

function Stone({ progress, exiting, onFirstFrame }: LoaderGemProps) {
  const tent = useGemEnvironment(128);
  const geo = useMemo(() => createStoneGeometry({ crownHeight: 0.2, pavilionHeight: 0.46 }), []);
  const mat = useMemo(
    () =>
      // additive: the stone can only add light to the drawing beneath it, never darken it
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#e4cfa3'),
        metalness: 0.2,
        roughness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        flatShading: true,
        emissive: new THREE.Color('#a8894f'),
        emissiveIntensity: 0.3,
      }),
    [],
  );
  useEffect(() => {
    mat.envMap = tent;
    mat.needsUpdate = true;
  }, [mat, tent]);
  const mesh = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const state = useRef({ opacity: 0, zoom: 1, tilt: 0, exitT: 0, sent: false });

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((_, dt) => {
    const s = state.current;
    const d = Math.min(dt, 0.05);
    const p = progress();
    // the stone (girdle 1 unit) fills the canvas: zoom so 1 unit ≈ 92% of the shorter side
    const fit = (Math.min(size.width, size.height) * 0.92) / 1.0;
    const targetOpacity = Math.min(1, Math.max(0, (p - 0.35) / 0.45));
    s.opacity = damp(s.opacity, targetOpacity, 5, d);
    mat.opacity = s.opacity * 0.85;
    if (exiting()) {
      s.exitT = Math.min(1, s.exitT + d / 1.5);
      const e = s.exitT < 0.5 ? 2 * s.exitT * s.exitT : 1 - Math.pow(-2 * s.exitT + 2, 2) / 2;
      s.zoom = fit * (1 + e * 2.4);
      s.tilt = e * 0.55;
      mat.emissiveIntensity = 0.15 + e * 0.9;
    } else {
      s.zoom = damp(s.zoom || fit, fit, 8, d);
    }
    camera.zoom = s.zoom;
    camera.up.set(0, 0, -1);
    camera.position.set(Math.sin(s.tilt) * 6, Math.cos(s.tilt) * 6, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (mesh.current) mesh.current.rotation.y = Math.PI / 2 + p * 0.02;
    if (!s.sent && s.opacity > 0.02) {
      s.sent = true;
      onFirstFrame?.();
    }
  });

  return (
    <>
      <directionalLight color="#f1e2bf" intensity={2.4} position={[2, 5, 3]} />
      <directionalLight color="#bfd3e6" intensity={0.9} position={[-3, 3, -2]} />
      <mesh ref={mesh} geometry={geo} material={mat} rotation={[0, Math.PI / 2, 0]} />
    </>
  );
}

export default LoaderGem;
