'use client';

import * as THREE from 'three';

/**
 * A procedural jeweller's studio, rendered once per renderer into a small HDR cube map:
 * a soft gradient sphere, a champagne key panel, an ivory fill, a cool rim and a warm
 * bounce from below. It lights gold and refracts through stone without any download.
 */
export interface StudioEnvironment {
  texture: THREE.CubeTexture;
  dispose: () => void;
}

const cache = new WeakMap<THREE.WebGLRenderer, StudioEnvironment>();
const gemCache = new WeakMap<THREE.WebGLRenderer, StudioEnvironment>();

function panel(color: THREE.ColorRepresentation, intensity: number, w: number, h: number) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  const mat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return mesh;
}

export function createStudioEnvironment(gl: THREE.WebGLRenderer, size = 256): StudioEnvironment {
  const cached = cache.get(gl);
  if (cached) return cached;

  const scene = new THREE.Scene();

  // the room: a dark warm gradient, brighter towards the top
  const roomGeo = new THREE.SphereGeometry(40, 32, 16);
  const roomMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#3a3126') },
      mid: { value: new THREE.Color('#241d16') },
      bottom: { value: new THREE.Color('#0a0806') },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vWorld;
      void main(){ float h = normalize(vWorld).y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.9, h)) : mix(mid, bottom, smoothstep(0.0, 0.8, -h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(roomGeo, roomMat));

  // key: a large champagne softbox, high and to the left
  const key = panel('#f1e2bf', 6, 14, 9);
  key.position.set(-10, 12, 8);
  key.lookAt(0, 0, 0);
  scene.add(key);

  // fill: ivory, right and level
  const fill = panel('#f4efe6', 1.6, 12, 12);
  fill.position.set(16, 3, 4);
  fill.lookAt(0, 0, 0);
  scene.add(fill);

  // rim: cool, behind and above — the edge light on gold
  const rim = panel('#bfd3e6', 4, 10, 4);
  rim.position.set(4, 10, -16);
  rim.lookAt(0, 0, 0);
  scene.add(rim);

  // bounce: warm, from below
  const bounce = panel('#8c6b3a', 1.2, 18, 18);
  bounce.position.set(0, -14, 2);
  bounce.lookAt(0, 0, 0);
  scene.add(bounce);

  // a thin bright strip: the reflection line jewellers photograph gold with
  const strip = panel('#ffffff', 9, 20, 0.7);
  strip.position.set(0, 9, 12);
  strip.lookAt(0, 0, 0);
  scene.add(strip);

  // the sweep: a broad, dim, warm card at the front near the horizon, so the walls of a
  // bezel and the inside of a band hold a soft warm reflection rather than the dark
  const sweep = panel('#8a7250', 0.9, 30, 8);
  sweep.position.set(2, -2.5, 16);
  sweep.lookAt(0, 0, 0);
  scene.add(sweep);

  const target = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const cam = new THREE.CubeCamera(0.1, 100, target);
  const prevTone = gl.toneMapping;
  gl.toneMapping = THREE.NoToneMapping;
  cam.update(gl, scene);
  gl.toneMapping = prevTone;

  const env: StudioEnvironment = {
    texture: target.texture,
    dispose: () => {
      target.dispose();
      roomGeo.dispose();
      roomMat.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      cache.delete(gl);
    },
  };
  cache.set(gl, env);
  return env;
}

/**
 * The stone's light tent: soft, near-white and striped, so refraction has light to bend and
 * dark bands to contrast it against — the way gems are photographed, not the way rooms look.
 * No panel is bright enough to bleach the green: the deep colour is the point.
 */
export function createGemEnvironment(gl: THREE.WebGLRenderer, size = 256): StudioEnvironment {
  const cached = gemCache.get(gl);
  if (cached) return cached;
  const scene = new THREE.Scene();
  const roomGeo = new THREE.SphereGeometry(40, 48, 24);
  const roomMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#f6f3ec') },
      mid: { value: new THREE.Color('#4a4743') },
      bottom: { value: new THREE.Color('#2a2826') },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vWorld;
      void main(){
        vec3 n = normalize(vWorld); float h = n.y;
        vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.85, h)) : mix(mid, bottom, smoothstep(0.0, 0.7, -h));
        float a = atan(n.z, n.x);
        float bands = 0.5 + 0.5 * sin(a * 5.0 + h * 2.0);
        c *= mix(0.22, 1.35, smoothstep(0.3, 0.7, bands));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(roomGeo, roomMat));
  const strips: [THREE.ColorRepresentation, number, THREE.Vector3, number, number][] = [
    ['#ffffff', 3.1, new THREE.Vector3(-8, 14, 10), 16, 1.2],
    ['#f4ecdc', 2.7, new THREE.Vector3(12, 10, 6), 12, 1.6],
    ['#ffffff', 2.4, new THREE.Vector3(0, 6, -16), 20, 0.9],
    ['#eadfc8', 1.1, new THREE.Vector3(-14, 7, -4), 8, 5],
    ['#ffffff', 2.8, new THREE.Vector3(6, 15, -2), 14, 0.7],
    ['#0b0a09', 0.02, new THREE.Vector3(10, -4, 10), 10, 4],
    ['#0b0a09', 0.02, new THREE.Vector3(-6, -3, 14), 8, 5],
  ];
  strips.forEach(([color, intensity, pos, w, h]) => {
    const m = panel(color, intensity, w, h);
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  });
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const cam = new THREE.CubeCamera(0.1, 100, target);
  const prevTone = gl.toneMapping;
  gl.toneMapping = THREE.NoToneMapping;
  cam.update(gl, scene);
  gl.toneMapping = prevTone;
  const env: StudioEnvironment = {
    texture: target.texture,
    dispose: () => {
      target.dispose();
      roomGeo.dispose();
      roomMat.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      gemCache.delete(gl);
    },
  };
  gemCache.set(gl, env);
  return env;
}
