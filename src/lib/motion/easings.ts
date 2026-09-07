/** Shared easing vocabulary — GSAP uses the registered 'wj.out'; Motion and Lenis use these. */
export const EASE = {
  out: [0.16, 1, 0.3, 1] as const,
  inOutQuart: [0.76, 0, 0.24, 1] as const,
  silk: [0.65, 0, 0.35, 1] as const,
  luxe: [0.22, 0.61, 0.36, 1] as const,
};

export const DUR = {
  micro: 0.3,
  ui: 0.48,
  component: 0.8,
  scene: 0.9,
  cinema: 1.4,
  route: 0.9,
};

export const expoOut = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const quartOut = (t: number) => 1 - Math.pow(1 - t, 4);
export const expoInOut = (t: number) =>
  t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
