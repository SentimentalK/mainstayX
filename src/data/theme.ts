// Synthwave palette (from design/synthwave/theme.js). Use these instead of
// hard-coding colours so the whole page stays in one palette.
export const PAL = {
  sky0: '#120428', sky1: '#c2367d', far: '#2a0a3f', sunTop: '#ffe259', sunBot: '#ff3d7f',
  neonA: '#ff4fd8', neonB: '#3df5ff', ground: '#14021f', grid: '#a0249a',
  frame: '#2b1640', frameHi: '#ff9de6', door: '#3a1f5c', doorDark: '#1c0d2e', doorHi: '#7a4fb0',
  inside0: '#ffffff', inside1: '#ffe259', warp0: '#12011f', star: '#ffd6f5',
} as const;

export const WORLD_PAL = { sky0: '#0d0221', sky1: '#4b0f5c', floor: '#12021e', grid: '#5a1680' } as const;

export const UI = { bg: '#0d0221', fg: '#ffe6f7', accent: '#ff4fd8', accent2: '#3df5ff' } as const;

/** Bloom blur radius at 4× scale (CSS px), scanline opacity. */
export const POST = { bloom: 6, scan: 0.12 } as const;
