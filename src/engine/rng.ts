import type { Rng } from '../types';

// mulberry32: tiny, fast, good enough for gameplay randomness.
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: p => next() < p,
    pick: items => items[Math.floor(next() * items.length)],
    fork: salt => createRng((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0),
  };
  return rng;
}
