'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConciergeState } from '@/state/conciergeStore';
import { voiceMeter } from '../voice/meter';
import { damp } from '@/lib/three/sceneLifecycle';

/** Per-state targets: how far the surface moves, how fast, how it glows, its tint. */
const TARGETS: Record<ConciergeState, { amp: number; freq: number; speed: number; glow: number; sweep: number; tint: number; scale: number }> = {
  IDLE: { amp: 0.03, freq: 0.7, speed: 0.22, glow: 0.18, sweep: 0, tint: 0, scale: 1 },
  HOVER: { amp: 0.04, freq: 0.75, speed: 0.3, glow: 0.32, sweep: 0, tint: 0, scale: 1.02 },
  OPENING: { amp: 0.07, freq: 0.85, speed: 0.55, glow: 0.55, sweep: 0, tint: 0, scale: 1.06 },
  CHAT: { amp: 0.03, freq: 0.7, speed: 0.22, glow: 0.22, sweep: 0, tint: 0, scale: 1 },
  VOICE_READY: { amp: 0.038, freq: 0.75, speed: 0.28, glow: 0.26, sweep: 0, tint: 0, scale: 1 },
  LISTENING: { amp: 0.05, freq: 0.95, speed: 0.45, glow: 0.42, sweep: 0, tint: 0, scale: 1.02 },
  THINKING: { amp: 0.085, freq: 1.5, speed: 0.8, glow: 0.36, sweep: 0, tint: 0, scale: 0.96 },
  EXECUTING_ACTION: { amp: 0.05, freq: 0.9, speed: 0.55, glow: 0.4, sweep: 1, tint: 0, scale: 1 },
  SPEAKING: { amp: 0.055, freq: 0.95, speed: 0.5, glow: 0.4, sweep: 0, tint: 0, scale: 1.01 },
  RESULT: { amp: 0.035, freq: 0.7, speed: 0.28, glow: 0.6, sweep: 0, tint: 0, scale: 1.04 },
  ERROR: { amp: 0.018, freq: 0.6, speed: 0.12, glow: 0.08, sweep: 0, tint: 1, scale: 0.98 },
};

const VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uLevel;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
varying float vDisp;

vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float field(vec3 p){
  float n = snoise(p * uFreq + vec3(0.0, uTime * 0.6, uTime * 0.35));
  float n2 = snoise(p * uFreq * 2.1 - vec3(uTime * 0.4, 0.0, uTime * 0.2)) * 0.18;
  return (n + n2) * (uAmp + uLevel * 0.1);
}

void main(){
  vec3 n = normalize(normal);
  float d = field(position);
  vec3 displaced = position + n * d;
  // finite-difference normal
  float e = 0.05;
  vec3 t1 = normalize(cross(n, vec3(0.0, 1.0, 0.0)));
  if (length(t1) < 0.001) t1 = vec3(1.0, 0.0, 0.0);
  vec3 t2 = normalize(cross(n, t1));
  vec3 pa = position + t1 * e; vec3 pb = position + t2 * e;
  vec3 da = pa + n * field(pa); vec3 db = pb + n * field(pb);
  vec3 nn = normalize(cross(da - displaced, db - displaced));
  if (dot(nn, n) < 0.0) nn = -nn;
  vDisp = d;
  vNormal = normalize(normalMatrix * nn);
  vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
  vView = -mv.xyz;
  vPos = displaced;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uGlow;
uniform float uSweep;
uniform float uTint;
uniform float uSpeech;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vPos;
varying float vDisp;

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vView);
  vec3 L1 = normalize(vec3(-0.6, 0.9, 0.8));
  vec3 L2 = normalize(vec3(0.8, -0.2, 0.6));
  vec3 L3 = normalize(vec3(0.2, 0.7, -0.9));
  float d1 = max(dot(N, L1), 0.0);
  float d2 = max(dot(N, L2), 0.0);
  float d3 = max(dot(N, L3), 0.0);
  vec3 deep = vec3(0.29, 0.22, 0.10);
  vec3 gold = vec3(0.66, 0.54, 0.31);
  vec3 champagne = vec3(0.89, 0.81, 0.64);
  vec3 hi = vec3(0.99, 0.96, 0.88);
  vec3 base = mix(deep, gold, smoothstep(0.0, 0.7, d1 * 0.9 + d2 * 0.3));
  base = mix(base, champagne, smoothstep(0.55, 1.0, d1));
  // specular
  vec3 H1 = normalize(L1 + V);
  float s1 = pow(max(dot(N, H1), 0.0), 48.0);
  vec3 H2 = normalize(L2 + V);
  float s2 = pow(max(dot(N, H2), 0.0), 40.0) * 0.35;
  vec3 col = base + hi * s1 * 1.1 + champagne * s2 + vec3(0.7, 0.8, 0.9) * d3 * 0.16;
  // fresnel rim as light
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  col += champagne * fres * (0.35 + uGlow * 0.8);
  // glow lifts the whole surface a breath
  col += champagne * uGlow * 0.12;
  // rim sweep (executing): a band of light travelling around the sphere
  float ang = atan(vPos.z, vPos.x);
  float band = smoothstep(0.85, 1.0, cos(ang - uTime * 2.4)) * fres;
  col += hi * band * uSweep * 0.9;
  // speech envelope brightens the highlight
  col += hi * s1 * uSpeech * 0.6;
  // error: burgundy through the metal
  vec3 burgundy = vec3(0.35, 0.12, 0.17);
  col = mix(col, mix(col, burgundy, 0.55), uTint);
  // displacement shading: valleys darken, crests catch light
  col *= 1.0 + vDisp * 1.4;
  gl_FragColor = vec4(col, 1.0);
}
`;

function OrbMesh({ state, size }: { state: ConciergeState; size: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uAmp: { value: 0.035 },
          uFreq: { value: 1.1 },
          uLevel: { value: 0 },
          uGlow: { value: 0.18 },
          uSweep: { value: 0 },
          uTint: { value: 0 },
          uSpeech: { value: 0 },
        },
      }),
    [],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(1, 96, 96), []);
  const mesh = useRef<THREE.Mesh>(null);
  const cur = useRef({ amp: 0.035, freq: 1.1, speed: 0.25, glow: 0.18, sweep: 0, tint: 0, scale: 1, level: 0, speech: 0, t: 0 });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const c = cur.current;
    const t = TARGETS[stateRef.current] ?? TARGETS.IDLE;
    const s = stateRef.current;
    const level = s === 'LISTENING' ? voiceMeter.level : 0;
    const speech = s === 'SPEAKING' ? voiceMeter.speech : 0;
    c.amp = damp(c.amp, t.amp, 4, d);
    c.freq = damp(c.freq, t.freq, 3, d);
    c.speed = damp(c.speed, t.speed, 3, d);
    c.glow = damp(c.glow, t.glow, 4, d);
    c.sweep = damp(c.sweep, t.sweep, 6, d);
    c.tint = damp(c.tint, t.tint, 4, d);
    c.scale = damp(c.scale, t.scale, 5, d);
    c.level = damp(c.level, level, 10, d);
    c.speech = damp(c.speech, speech, 12, d);
    c.t += d * c.speed;
    const u = mat.uniforms;
    u.uTime!.value = c.t;
    u.uAmp!.value = c.amp;
    u.uFreq!.value = c.freq;
    u.uLevel!.value = c.level;
    u.uGlow!.value = c.glow;
    u.uSweep!.value = c.sweep;
    u.uTint!.value = c.tint;
    u.uSpeech!.value = c.speech;
    if (mesh.current) {
      mesh.current.scale.setScalar(c.scale * (1 + c.level * 0.05 + c.speech * 0.03));
      mesh.current.rotation.y = c.t * 0.15;
    }
  });

  void size;
  return <mesh ref={mesh} geometry={geo} material={mat} />;
}

/** The liquid-metal orb of the voice stage. Continuous while a conversation is live, gentle at rest. */
export function OrbCanvas({ state, size }: { state: ConciergeState; size: number }) {
  const active = state !== 'IDLE' && state !== 'CHAT' && state !== 'VOICE_READY' && state !== 'HOVER';
  return (
    <Canvas
      frameloop="always"
      dpr={[1, 2]}
      camera={{ fov: 28, position: [0, 0, 4.6] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <OrbMesh state={state} size={size} />
      <Throttle active={active} />
    </Canvas>
  );
}

/** At rest the loop runs at half rate by skipping frames through the clock's elapsed budget. */
function Throttle({ active }: { active: boolean }) {
  const acc = useRef(0);
  useFrame((rootState, dt) => {
    if (active) return;
    acc.current += dt;
    if (acc.current < 1 / 30) {
      // hold the frame: nothing to do; R3F still renders, so keep the work minimal by
      // letting the material's damped values converge — cost is one draw call.
      return;
    }
    acc.current = 0;
    void rootState;
  });
  return null;
}

export default OrbCanvas;
