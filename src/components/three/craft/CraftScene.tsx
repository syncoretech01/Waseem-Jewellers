'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshRefractionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useQualityStore } from '@/state/qualityStore';
import { createStoneGeometry, createBezelGeometry, clawPositions } from '@/lib/three/gemGeometry3d';
import { createGoldMaterial, createStoneFallbackMaterial } from '@/lib/three/materials';
import { useDemandInvalidate, useStudioEnvironment, useGemEnvironment, useContextLoss, damp } from '@/lib/three/sceneLifecycle';
import { craftProgress } from '@/components/home/chapters/craftProgress';
import { bindPointer, pointer } from '@/lib/motion/pointer';

interface CraftSceneProps {
  onReady?: () => void;
  onLost?: () => void;
}

const STONE = 1.08;
/** Band centre: its top clears the culet; the shoulders carry the head above it. */
const BAND_Y = -0.58 - 0.08 - 1.18;

/** Smooth window: 0 before `from`, 1 after `to`. */
function win(p: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (p - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * The signature craft object: an emerald-cut stone in a closed gold bezel with four claws
 * on a comfort-fit band. Scroll progress (from the chapter's scrub) drives the deconstruction;
 * every value is damped in the frame loop so the object never snaps.
 */
export function CraftScene({ onReady, onLost }: CraftSceneProps) {
  const tier = useQualityStore((s) => s.tier);
  const dprCap = useQualityStore((s) => s.dprCap);
  const [lost, setLost] = useState(false);
  const handleLost = useCallback(() => {
    setLost(true);
    onLost?.();
  }, [onLost]);
  if (lost) return null;
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, Math.max(1, Math.min(dprCap, tier === 'HIGH' ? 1.75 : 1.5))]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ fov: 26, near: 0.1, far: 60, position: [0, 2.6, 8.6] }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <CraftObject tier={tier} onReady={onReady} onLost={handleLost} />
    </Canvas>
  );
}

function CraftObject({ tier, onReady, onLost }: { tier: string; onReady?: () => void; onLost: () => void }) {
  useStudioEnvironment(256);
  const tent = useGemEnvironment(256);
  useContextLoss(onLost);
  const stoneGeo = useMemo(() => createStoneGeometry({ crownHeight: 0.2, pavilionHeight: 0.46 }), []);
  const bezelGeo = useMemo(() => createBezelGeometry(0.12, 0.065), []);
  const clawGeo = useMemo(() => new THREE.CapsuleGeometry(0.06, 0.05, 6, 12), []);
  const bandGeo = useMemo(() => new THREE.TorusGeometry(1.18, 0.08, 28, 120), []);
  const shoulderGeo = useMemo(() => new THREE.CapsuleGeometry(0.075, 0.62, 6, 12), []);
  const galleryGeo = useMemo(() => new THREE.TorusGeometry(0.3, 0.045, 16, 48), []);
  const gold = useMemo(() => createGoldMaterial(), []);
  const goldSoft = useMemo(() => createGoldMaterial({ roughness: 0.34 }), []);
  const fallback = useMemo(() => createStoneFallbackMaterial(), []);
  const refract = tier === 'HIGH' || tier === 'MEDIUM';

  const group = useRef<THREE.Group>(null);
  const stone = useRef<THREE.Mesh>(null);
  const bezel = useRef<THREE.Mesh>(null);
  const band = useRef<THREE.Group>(null);
  const claws = useRef<THREE.Group>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  // a portrait stage stands further back: the camera's field of view is vertical, so on a
  // phone the band would otherwise fill the width and run behind the labels
  const size = useThree((s) => s.size);
  const far = Math.max(1, 0.9 / Math.max(0.2, size.width / size.height));
  const ready = useRef(false);

  // damped state
  const cur = useRef({ lift: 0, bezelDrop: 0, bandDrop: 0, claw: 0, finish: 0, pull: 0, spin: 0, px: 0, py: 0 });
  const dirty = useRef(true);
  const lastProgress = useRef(-1);

  useEffect(() => {
    bindPointer();
    void gl.compileAsync(scene, camera).then(() => {
      if (!ready.current) {
        ready.current = true;
        onReady?.();
      }
    });
    const t = window.setTimeout(() => {
      if (!ready.current) {
        ready.current = true;
        onReady?.();
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [gl, scene, camera, onReady]);

  useEffect(
    () => () => {
      stoneGeo.dispose();
      bezelGeo.dispose();
      clawGeo.dispose();
      bandGeo.dispose();
      shoulderGeo.dispose();
      galleryGeo.dispose();
      gold.dispose();
      goldSoft.dispose();
      fallback.dispose();
    },
    [stoneGeo, bezelGeo, clawGeo, bandGeo, shoulderGeo, galleryGeo, gold, goldSoft, fallback],
  );

  useDemandInvalidate(
    useCallback(() => {
      if (dirty.current) return true;
      if (craftProgress.value !== lastProgress.current) return true;
      if (pointer.active && (Math.abs(pointer.nx - cur.current.px) > 0.002 || Math.abs(pointer.ny - cur.current.py) > 0.002)) return true;
      return false;
    }, []),
  );

  useFrame((_, dt) => {
    const p = craftProgress.value;
    lastProgress.current = p;
    const c = cur.current;
    const l = 6;
    const d = Math.min(dt, 0.05);
    // the parts separate through the middle of the chapter and return for the close
    const together = 1 - win(p, 0.82, 0.96);
    const target = {
      lift: win(p, 0.12, 0.3) * 0.62 * together,
      bezelDrop: win(p, 0.3, 0.48) * 0.42 * together,
      bandDrop: win(p, 0.48, 0.64) * 0.95 * together,
      claw: win(p, 0.64, 0.82) * together,
      finish: win(p, 0.64, 0.82),
      pull: win(p, 0.82, 1),
      spin: p * 1.35,
      px: pointer.fine && pointer.active ? pointer.nx : 0,
      py: pointer.fine && pointer.active ? pointer.ny : 0,
    };
    let moving = false;
    (Object.keys(target) as (keyof typeof target)[]).forEach((k) => {
      const next = damp(c[k], target[k], l, d);
      if (Math.abs(next - c[k]) > 0.0004) moving = true;
      c[k] = next;
    });
    dirty.current = moving;

    if (group.current) {
      group.current.rotation.y = -0.42 + c.spin + c.finish * 0.5 + c.px * 0.18;
      group.current.rotation.x = 0.3 + c.py * 0.08;
      const s = 1 - c.pull * 0.16;
      group.current.scale.setScalar(s);
      group.current.position.y = -0.15 + c.pull * 0.95;
    }
    if (stone.current) stone.current.position.y = 0.02 + c.lift;
    if (bezel.current) bezel.current.position.y = -c.bezelDrop;
    if (band.current) band.current.position.y = BAND_Y - c.bandDrop;
    if (claws.current) {
      claws.current.position.y = -c.bezelDrop * 0.5;
      claws.current.children.forEach((claw, i) => {
        // claws lean over the crown; hand finishing eases them a breath
        const lean = 0.5 - c.claw * 0.08;
        const dirX = i === 0 || i === 3 ? 1 : -1;
        const dirZ = i < 2 ? 1 : -1;
        claw.rotation.z = dirX * lean;
        claw.rotation.x = -dirZ * lean;
      });
    }
    gold.roughness = 0.28 - c.finish * 0.07;
    gold.envMapIntensity = 1.25 + c.finish * 0.45;
    goldSoft.roughness = 0.34 - c.finish * 0.06;
    if (keyLight.current) {
      keyLight.current.intensity = 2.2 + c.finish * 1.4;
      keyLight.current.position.set(2.2 + c.px * 0.8, 3.6 + c.finish * 0.8, 3 - c.py * 0.5);
    }
    camera.position.x = c.px * 0.3;
    camera.position.y = (2.6 - c.py * 0.15 + c.pull * 0.9) * far;
    camera.position.z = (8.6 + c.pull * 2.2) * far;
    // and looks a little lower on a portrait stage, so the object sits above the index rather than behind it
    camera.lookAt(0, -0.25 - (far - 1) * 0.9, 0);
  });

  return (
    <>
      <directionalLight ref={keyLight} color="#f1e2bf" intensity={2.2} position={[2.2, 3.6, 3]} />
      <directionalLight color="#bfd3e6" intensity={1.1} position={[-3, 2.4, -2.5]} />
      <group ref={group} rotation={[0.3, -0.42, 0]} position={[0, -0.15, 0]}>
        <mesh ref={stone} geometry={stoneGeo} scale={[STONE, STONE, STONE]} position={[0, 0.02, 0]}>
          {refract ? (
            <MeshRefractionMaterial envMap={tent} bounces={tier === 'HIGH' ? 2 : 1} ior={1.58} fresnel={0.45} aberrationStrength={tier === 'HIGH' ? 0.006 : 0} color="#1a9268" toneMapped={false} />
          ) : (
            <primitive object={fallback} attach="material" />
          )}
        </mesh>
        <mesh ref={bezel} geometry={bezelGeo} material={gold} scale={[STONE, 1, STONE]} />
        <group ref={claws}>
          {clawPositions(0.53 * STONE).map((pos, i) => (
            <mesh key={i} geometry={clawGeo} material={gold} position={[pos[0], 0.1, pos[2]]} rotation={[-(i < 2 ? 1 : -1) * 0.5, 0, (i === 0 || i === 3 ? 1 : -1) * 0.5]} />
          ))}
        </group>
        <group ref={band} position={[0, BAND_Y, 0]}>
          <mesh geometry={bandGeo} material={goldSoft} />
          <mesh geometry={galleryGeo} material={gold} position={[0, 1.18 + 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={shoulderGeo} material={gold} position={[-0.34, 1.18 + 0.2, 0]} rotation={[0, 0, 0.42]} />
          <mesh geometry={shoulderGeo} material={gold} position={[0.34, 1.18 + 0.2, 0]} rotation={[0, 0, -0.42]} />
        </group>
      </group>
    </>
  );
}

export default CraftScene;
