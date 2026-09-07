'use client';

/**
 * One pointer model for the whole page: normalised position (−1…1 from the viewport centre),
 * velocity and a light direction derived from it. Chapters read it inside their own tickers;
 * nothing here writes to the DOM.
 */
export const pointer = {
  x: 0,
  y: 0,
  /** −1…1 */
  nx: 0,
  ny: 0,
  vx: 0,
  vy: 0,
  /** degrees, direction the specular highlight travels from */
  angle: 210,
  active: false,
  fine: false,
};

let bound = false;
let lastT = 0;

function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  const now = performance.now();
  const dt = Math.max(8, now - lastT);
  lastT = now;
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  pointer.vx = (e.clientX - pointer.x) / dt;
  pointer.vy = (e.clientY - pointer.y) / dt;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.nx = nx;
  pointer.ny = ny;
  pointer.active = true;
  if (Math.abs(pointer.vx) + Math.abs(pointer.vy) > 0.05) {
    pointer.angle = (Math.atan2(pointer.vy, pointer.vx) * 180) / Math.PI + 180;
  }
}

function onLeave() {
  pointer.active = false;
  pointer.vx = 0;
  pointer.vy = 0;
}

/** Idempotent; the first chapter that needs the pointer binds it. */
export function bindPointer() {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  pointer.fine = window.matchMedia('(pointer: fine)').matches;
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
}

/** Position of the pointer relative to an element, −1…1 on both axes (0,0 = centre). */
export function pointerIn(el: Element) {
  const r = el.getBoundingClientRect();
  const x = ((pointer.x - r.left) / Math.max(1, r.width)) * 2 - 1;
  const y = ((pointer.y - r.top) / Math.max(1, r.height)) * 2 - 1;
  return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), inside: x >= -1 && x <= 1 && y >= -1 && y <= 1 };
}
