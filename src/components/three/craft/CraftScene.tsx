'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useQualityStore } from '@/state/qualityStore';
import { createStoneGeometry, createBezelGeometry, clawPositions } from '@/lib/three/gemGeometry3d';
import { createGoldMaterial, createCastGoldMaterial, createStoneFallbackMaterial } from '@/lib/three/materials';
import { EmeraldMaterial, facetPlanes } from '@/lib/three/emeraldMaterial';
import { useDemandInvalidate, useStudioEnvironment, useGemEnvironment, useContextLoss, damp } from '@/lib/three/sceneLifecycle';
import { craftProgress } from '@/components/home/chapters/craftProgress';
import { bindPointer, pointer } from '@/lib/motion/pointer';

interface CraftSceneProps {
  /** The renderer exists and the programs are compiling. */
  onStarted?: () => void;
  onReady?: () => void;
  onLost?: () => void;
}

const STONE = 1.08;
/** Band centre: its top clears the culet; the shoulders carry the head above it. */
const BAND_Y = -0.58 - 0.08 - 1.18;
/** The opening pose, and the orbit the scroll carries the object through. */
const REST_ANGLE = -0.42;
const ORBIT = 1.05;
/** The turn hand finishing adds, so the close settles a three-quarter view with the stone to the light. */
const FINISH_TURN = 0.32;
/** The pointer's whole say: ±0.2 rad, a shade under 12°. */
const POINTER_TURN = 0.2;

/** Smooth window: 0 before `from`, 1 after `to`. */
function win(p: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (p - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * The signature craft object: an emerald-cut stone in a closed gold bezel with four claws
 * on a comfort-fit band. Scroll progress (from the chapter's scrub) drives the deconstruction;
 * every value is damped in the frame loop so the object never snaps. The object is a study —
 * an emerald in a gold setting — and stands for no piece in the catalogue.
 */
export function CraftScene({ onStarted, onReady, onLost }: CraftSceneProps) {
  const tier = useQualityStore((s) => s.tier);
  const dprCap = useQualityStore((s) => s.dprCap);
  const premium = useQualityStore((s) => s.premium);
  const [lost, setLost] = useState(false);
  // never, until the programs are linked: a frame drawn before that blocks the main thread
  // for the whole compile (1.4 s measured on an Intel GPU, in the middle of the window chapter).
  // Held as state rather than a constant prop, because the Canvas re-applies its prop on
  // every reconfigure and would otherwise freeze the loop again on a demotion.
  const [loop, setLoop] = useState<'never' | 'demand'>('never');
  const handleLinked = useCallback(() => setLoop('demand'), []);
  const handleLost = useCallback(() => {
    setLost(true);
    onLost?.();
  }, [onLost]);
  if (lost) return null;
  return (
    <Canvas
      frameloop={loop}
      dpr={[1, Math.max(1, Math.min(dprCap, tier === 'HIGH' ? 1.75 : 1.5))]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ fov: 26, near: 0.1, far: 60, position: [0, 2.6, 8.6] }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => {
        onStarted?.();
        gl.setClearColor(0x000000, 0);
        // the info-log queries three makes on a program's first use are a sync point with the
        // driver; with the programs linked in parallel and polled, they have nothing to add
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== 'production';
      }}
    >
      <CraftObject tier={tier} premium={premium} onReady={onReady} onLinked={handleLinked} onLost={handleLost} />
    </Canvas>
  );
}

function CraftObject({ tier, premium, onReady, onLinked, onLost }: { tier: string; premium: boolean; onReady?: () => void; onLinked: () => void; onLost: () => void }) {
  const studio = useStudioEnvironment(256);
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
  const goldCast = useMemo(() => createCastGoldMaterial(), []);
  // decided once: a tier demoted mid-scroll must not swap the stone's material while it is being looked at.
  // A premium phone that is given the live object (LOW tier, DPR 1.5) gets the MEDIUM stone: the
  // flat LOW stone is never shown on a phone — where it cannot be afforded, the sequence stands instead
  const [refract] = useState(() => tier === 'HIGH' || tier === 'MEDIUM' || premium);
  const [high] = useState(() => tier === 'HIGH');
  const stoneMat = useMemo(
    () =>
      refract
        ? new EmeraldMaterial({ envMap: tent, reflMap: studio, planes: facetPlanes(stoneGeo), bounces: high ? 3 : 2, dispersion: high ? 0.011 : 0.007, jardin: high ? 0.34 : 0.28 })
        : createStoneFallbackMaterial(tent),
    [refract, high, tent, studio, stoneGeo],
  );

  const group = useRef<THREE.Group>(null);
  const stone = useRef<THREE.Mesh>(null);
  const bezel = useRef<THREE.Mesh>(null);
  const band = useRef<THREE.Group>(null);
  const claws = useRef<THREE.Group>(null);
  const keyLight = useRef<THREE.DirectionalLight>(null);
  const rimLight = useRef<THREE.DirectionalLight>(null);
  const glow = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const frameloop = useThree((s) => s.frameloop);
  const invalidate = useThree((s) => s.invalidate);
  // a portrait stage stands further back: the camera's field of view is vertical, so on a
  // phone the band would otherwise fill the width and run behind the labels
  const size = useThree((s) => s.size);
  const far = Math.max(1, 0.9 / Math.max(0.2, size.width / size.height));
  const ready = useRef(false);

  // damped state
  const cur = useRef({ lift: 0, bezelDrop: 0, bandDrop: 0, claw: 0, finish: 0, pull: 0, spin: 0, px: 0, py: 0 });
  const dirty = useRef(true);
  const lastProgress = useRef(-1);
  // the rim light's drift: advanced only inside frames, so an idle stage costs nothing
  const drift = useRef(0);

  /**
   * The programs are linked in parallel (KHR_parallel_shader_compile, polled by three) while
   * the canvas draws nothing; only once every material reports ready does the frame loop
   * start and the first frame is asked for. The fallback timer is for a driver that never
   * reports — it is long enough that a normal compile is never cut short by it.
   */
  useEffect(() => {
    bindPointer();
    let cancelled = false;
    const start = () => {
      if (cancelled || ready.current) return;
      ready.current = true;
      onLinked();
      onReady?.();
    };
    void gl.compileAsync(scene, camera).then(start);
    const t = window.setTimeout(start, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [gl, scene, camera, onReady, onLinked]);

  // the first frame, once the loop is allowed to run
  useEffect(() => {
    if (frameloop === 'demand') invalidate();
  }, [frameloop, invalidate]);

  // the emerald reads the camera in its own space; its world matrix is current only at render time
  useEffect(() => {
    const mesh = stone.current;
    if (!mesh || !(stoneMat instanceof EmeraldMaterial)) return;
    mesh.onBeforeRender = () => stoneMat.update(mesh);
    return () => {
      mesh.onBeforeRender = () => {};
    };
  }, [stoneMat]);

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
      goldCast.dispose();
      stoneMat.dispose();
    },
    [stoneGeo, bezelGeo, clawGeo, bandGeo, shoulderGeo, galleryGeo, gold, goldSoft, goldCast, stoneMat],
  );

  useDemandInvalidate(
    useCallback(() => {
      if (dirty.current) return true;
      if (craftProgress.value !== lastProgress.current) return true;
      const c = cur.current;
      if (pointer.active && (Math.abs(pointer.nx - c.px) > 0.002 || Math.abs(pointer.ny - c.py) > 0.002)) return true;
      // the pointer has left: the object eases back to rest
      if (!pointer.active && (Math.abs(c.px) > 0.002 || Math.abs(c.py) > 0.002)) return true;
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
    const held = pointer.fine && pointer.active;
    // a pose set by the render script (scripts/assets/craft-frames.mjs, through the development
    // handle on craftProgress) stands in for the scroll's choreography; `null` on every visitor's
    // page, where nothing below this line is any different from before
    const pose = craftProgress.pose;
    const target = pose
      ? {
          lift: pose.lift,
          bezelDrop: pose.bezelDrop / far,
          bandDrop: pose.bandDrop / far,
          claw: pose.claw,
          finish: pose.finish,
          pull: pose.pull,
          // the pose names the object's whole turn, so the finish's own turn is taken out of it
          spin: pose.spin - pose.finish * FINISH_TURN,
          px: 0,
          py: 0,
        }
      : {
          lift: win(p, 0.12, 0.3) * 0.62 * together,
          bezelDrop: (win(p, 0.3, 0.48) * 0.42 * together) / far,
          bandDrop: (win(p, 0.48, 0.64) * 0.95 * together) / far,
          claw: win(p, 0.64, 0.82) * together,
          finish: win(p, 0.64, 0.82),
          pull: win(p, 0.82, 1),
          spin: p * ORBIT,
          // the pointer turns the object a little; damped, and slower on the way back
          px: held ? pointer.nx : 0,
          py: held ? pointer.ny : 0,
        };
    let moving = false;
    (Object.keys(target) as (keyof typeof target)[]).forEach((k) => {
      const rate = (k === 'px' || k === 'py') && !held ? 3.2 : l;
      const next = damp(c[k], target[k], rate, d);
      if (Math.abs(next - c[k]) > 0.0004) moving = true;
      c[k] = next;
    });
    dirty.current = moving;
    // the rim light's drift is held still under a pose, so every state carries the same highlight
    if (moving && !pose) drift.current += d;

    if (group.current) {
      group.current.rotation.y = REST_ANGLE + c.spin + c.finish * FINISH_TURN + c.px * POINTER_TURN;
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
    // hand finishing: the polish tightens, the clearcoat clears, the studio reads brighter
    gold.roughness = 0.28 - c.finish * 0.07;
    gold.clearcoatRoughness = 0.2 - c.finish * 0.09;
    gold.envMapIntensity = 1.25 + c.finish * 0.45;
    goldSoft.roughness = 0.34 - c.finish * 0.06;
    goldSoft.clearcoatRoughness = 0.2 - c.finish * 0.06;
    goldCast.roughness = gold.roughness;
    goldCast.clearcoatRoughness = gold.clearcoatRoughness;
    goldCast.envMapIntensity = gold.envMapIntensity;
    // the stone's green on the gold that holds it: gone while the stone is lifted away
    const seated = 1 - Math.min(1, c.lift / 0.3);
    goldCast.emissiveIntensity = (0.04 + c.finish * 0.03) * seated;
    if (stoneMat instanceof EmeraldMaterial) stoneMat.setPolish(c.finish);
    if (keyLight.current) {
      keyLight.current.intensity = 2.2 + c.finish * 1.4;
      keyLight.current.position.set(2.2 + c.px * 0.8, 3.6 + c.finish * 0.8, 3 - c.py * 0.5);
    }
    if (rimLight.current) {
      // a thin highlight that travels over the gold as the object turns or the pointer moves:
      // it orbits against the scroll and slides with the drift, never with the clock
      const a = 2.35 - c.spin * 0.7 + Math.sin(drift.current * 0.45) * 0.55 - c.px * 0.35;
      rimLight.current.position.set(Math.cos(a) * 3.4, 1.6 + Math.sin(drift.current * 0.31) * 0.5 + c.py * 0.4, Math.sin(a) * 3.4);
      rimLight.current.intensity = 0.75 + c.finish * 0.35;
    }
    if (glow.current) {
      // the stone's own green into the setting, as a highlight on the claws and the lip:
      // strongest once the stone is polished and back in its seat
      glow.current.intensity = (0.55 + c.finish * 0.35) * seated;
    }
    camera.position.x = c.px * 0.3;
    camera.position.y = (2.6 - c.py * 0.15 + c.pull * 0.9) * far;
    camera.position.z = (8.6 + c.pull * 2.2) * far;
    // and looks a little lower on a portrait stage, so the object sits above the index rather than
    // behind it: at 0.9 the band still crossed the index's first rows at the metal beat on a
    // 390 x 844 phone; at 1.23 it clears them, and the sequence's box (craft.css) stands in step
    camera.lookAt(0, -0.25 - (far - 1) * 1.23, 0);
  });

  return (
    <>
      <directionalLight ref={keyLight} color="#f1e2bf" intensity={2.2} position={[2.2, 3.6, 3]} />
      <directionalLight color="#bfd3e6" intensity={1.1} position={[-3, 2.4, -2.5]} />
      <directionalLight ref={rimLight} color="#fbf4e4" intensity={0.75} position={[-2.4, 1.6, 2.4]} />
      <group ref={group} rotation={[0.3, REST_ANGLE, 0]} position={[0, -0.15, 0]}>
        <mesh ref={stone} geometry={stoneGeo} material={stoneMat} scale={[STONE, STONE, STONE]} position={[0, 0.02, 0]}>
          {/* the green the stone gives the gold around it, and the faint pool it leaves on the bezel */}
          <pointLight ref={glow} color="#2fa874" intensity={0.55} distance={1.8} decay={2} position={[0, 0.02, 0]} />
        </mesh>
        <mesh ref={bezel} geometry={bezelGeo} material={goldCast} scale={[STONE, 1, STONE]} />
        <group ref={claws}>
          {clawPositions(0.485 * STONE).map((pos, i) => (
            <mesh key={i} geometry={clawGeo} material={goldCast} position={[pos[0], 0.1, pos[2]]} rotation={[-(i < 2 ? 1 : -1) * 0.5, 0, (i === 0 || i === 3 ? 1 : -1) * 0.5]} />
          ))}
        </group>
        <group ref={band} position={[0, BAND_Y, 0]}>
          <mesh geometry={bandGeo} material={goldSoft} />
          <mesh geometry={galleryGeo} material={goldCast} position={[0, 1.18 + 0.22, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={shoulderGeo} material={gold} position={[-0.34, 1.18 + 0.2, 0]} rotation={[0, 0, 0.42]} />
          <mesh geometry={shoulderGeo} material={gold} position={[0.34, 1.18 + 0.2, 0]} rotation={[0, 0, -0.42]} />
        </group>
      </group>
    </>
  );
}

export default CraftScene;
