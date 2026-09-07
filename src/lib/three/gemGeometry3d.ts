'use client';

import * as THREE from 'three';

/**
 * The house stone in three dimensions: a step cut whose crown rings mirror the SVG facets
 * exactly (so the loader can hand the drawing to the object without a pop), with a
 * three-step pavilion beneath the girdle. Flat-shaded: every facet is its own plane.
 */

/** Corner-cut octagon in the XZ plane at `scale` (1 = girdle), height `y`. Matches gemGeometry.ts rings. */
function ring(scale: number, y: number, cut = 0.1667): THREE.Vector3[] {
  const a = -0.5 * scale;
  const b = 0.5 * scale;
  const c = cut * scale;
  return [
    new THREE.Vector3(a + c, y, a),
    new THREE.Vector3(b - c, y, a),
    new THREE.Vector3(b, y, a + c),
    new THREE.Vector3(b, y, b - c),
    new THREE.Vector3(b - c, y, b),
    new THREE.Vector3(a + c, y, b),
    new THREE.Vector3(a, y, b - c),
    new THREE.Vector3(a, y, a + c),
  ];
}

/** SVG rings: insets 2 / 12 / 22 / 32 of a 100 box, corner cuts 16 / 12 / 8.5 / 5. */
const CROWN = [
  { scale: 1, cut: 16 / 96 },
  { scale: 76 / 96, cut: 12 / 76 },
  { scale: 56 / 96, cut: 8.5 / 56 },
  { scale: 36 / 96, cut: 5 / 36 },
];

export interface StoneOptions {
  crownHeight?: number;
  girdleHeight?: number;
  pavilionHeight?: number;
}

/** Rings run clockwise seen from above, so faces are emitted a → d → c → b to keep normals outward. */
function pushQuad(out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) {
  out.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
  out.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
}

function pushFan(out: number[], centre: THREE.Vector3, loop: THREE.Vector3[], reverse = false) {
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]!;
    const q = loop[(i + 1) % loop.length]!;
    if (reverse) out.push(centre.x, centre.y, centre.z, p.x, p.y, p.z, q.x, q.y, q.z);
    else out.push(centre.x, centre.y, centre.z, q.x, q.y, q.z, p.x, p.y, p.z);
  }
}

function band(out: number[], upper: THREE.Vector3[], lower: THREE.Vector3[]) {
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    // outward-facing winding (counter-clockwise seen from outside)
    pushQuad(out, upper[i]!, lower[i]!, lower[j]!, upper[j]!);
  }
}

export function createStoneGeometry({ crownHeight = 0.2, girdleHeight = 0.035, pavilionHeight = 0.46 }: StoneOptions = {}) {
  const out: number[] = [];
  const g = girdleHeight / 2;
  const crownRings = [
    ring(CROWN[0]!.scale, g, CROWN[0]!.cut),
    ring(CROWN[1]!.scale, g + crownHeight * 0.45, CROWN[1]!.cut),
    ring(CROWN[2]!.scale, g + crownHeight * 0.8, CROWN[2]!.cut),
    ring(CROWN[3]!.scale, g + crownHeight, CROWN[3]!.cut),
  ];
  // table
  pushFan(out, new THREE.Vector3(0, g + crownHeight, 0), crownRings[3]!);
  // crown steps (from the table outward and down)
  band(out, crownRings[3]!, crownRings[2]!);
  band(out, crownRings[2]!, crownRings[1]!);
  band(out, crownRings[1]!, crownRings[0]!);
  // girdle
  const girdleLow = ring(1, -g, CROWN[0]!.cut);
  band(out, crownRings[0]!, girdleLow);
  // pavilion steps to the culet
  const pav1 = ring(0.78, -g - pavilionHeight * 0.34, 0.16);
  const pav2 = ring(0.5, -g - pavilionHeight * 0.68, 0.16);
  const culet = ring(0.09, -g - pavilionHeight, 0.16);
  band(out, girdleLow, pav1);
  band(out, pav1, pav2);
  band(out, pav2, culet);
  pushFan(out, new THREE.Vector3(0, -g - pavilionHeight, 0), culet, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** A closed bezel collar following the girdle: outer octagon at 1.14, inner at 1.01, a little taller than the girdle. */
export function createBezelGeometry(height = 0.12, thickness = 0.065) {
  const out: number[] = [];
  const cut = CROWN[0]!.cut;
  const top = height * 0.55;
  const bottom = -height * 0.45;
  const outerTop = ring(1 + thickness, top, cut);
  const outerBottom = ring(1 + thickness, bottom, cut);
  const innerTop = ring(1.01, top, cut);
  const innerBottom = ring(1.01, bottom, cut);
  band(out, outerTop, outerBottom);
  // inner wall faces inward
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    pushQuad(out, innerTop[j]!, innerBottom[j]!, innerBottom[i]!, innerTop[i]!);
  }
  // top and bottom lips
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    pushQuad(out, innerTop[i]!, innerTop[j]!, outerTop[j]!, outerTop[i]!);
    pushQuad(out, outerBottom[i]!, outerBottom[j]!, innerBottom[j]!, innerBottom[i]!);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Positions of the four claws at the stone's corners (girdle scale 1). */
export function clawPositions(radius = 0.56): [number, number, number][] {
  return [
    [-radius, 0, -radius],
    [radius, 0, -radius],
    [radius, 0, radius],
    [-radius, 0, radius],
  ];
}
