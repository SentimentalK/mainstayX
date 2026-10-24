export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0..1 progress of t through [a, b]. */
export const progress = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);

export const easeInQuad = (t: number) => t * t;
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeInExpo = (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10));
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
export const easeOutBounce = (t: number) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
/** Damped spring-ish wobble, 1 at t=0 decaying to 0. */
export const wobble = (t: number, freq = 18, decay = 6) => Math.exp(-decay * t) * Math.cos(freq * t);
