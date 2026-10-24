// World geometry: horizon, floor plane, Orca's keep-out zone, agent homes.
import type { CharacterId, Rng } from '../types';
import { W } from '../types';

/** Horizon line (sky above, grid floor below). */
export const HZ = 70;
/** Agents' feet live in [FLOOR_TOP, FLOOR_BOT]. */
export const FLOOR_TOP = 86;
export const FLOOR_BOT = 172;
/** Minimum gap between a sprite and the screen edge. */
export const EDGE = 4;

/** Orca's bottom-centre anchor (before bobbing). */
export const ORCA_X = 160;
export const ORCA_Y = 112;

/** Agents' feet never rest inside this ellipse (Orca's body + rings). */
export const KEEP = { x: 160, y: 106, rx: 52, ry: 24 } as const;

export interface Pt { x: number; y: number }

export function keepDist(x: number, y: number): number {
  const dx = (x - KEEP.x) / KEEP.rx, dy = (y - KEEP.y) / KEEP.ry;
  return Math.sqrt(dx * dx + dy * dy);
}

export function insideKeep(x: number, y: number, margin = 1): boolean {
  return keepDist(x, y) < margin;
}

/** Push a point radially out of the keep ellipse (scaled by margin). Mutates p. */
export function pushOut(p: Pt, margin = 1.04): void {
  let nx = (p.x - KEEP.x) / KEEP.rx, ny = (p.y - KEEP.y) / KEEP.ry;
  let d = Math.sqrt(nx * nx + ny * ny);
  if (d >= margin) return;
  if (d < 1e-3) { nx = 0; ny = 1; d = 1; }
  p.x = KEEP.x + (nx / d) * KEEP.rx * margin;
  p.y = KEEP.y + (ny / d) * KEEP.ry * margin;
}

export function clampPt(p: Pt, halfW: number): void {
  const lo = EDGE + halfW, hi = W - EDGE - halfW;
  p.x = p.x < lo ? lo : p.x > hi ? hi : p.x;
  p.y = p.y < FLOOR_TOP ? FLOOR_TOP : p.y > FLOOR_BOT ? FLOOR_BOT : p.y;
}

/** Make p a legal standing spot: inside the floor, outside Orca's zone. */
export function legalize(p: Pt, halfW: number): void {
  clampPt(p, halfW);
  pushOut(p);
  clampPt(p, halfW);
  // pushing out of the ellipse near the top edge can land back inside after clamping
  if (insideKeep(p.x, p.y)) { p.y = KEEP.y + KEEP.ry * 1.05; clampPt(p, halfW); }
}

/** Does the straight segment stay clear of Orca's zone? */
export function segmentClear(x0: number, y0: number, x1: number, y1: number, margin = 1.05): boolean {
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    if (insideKeep(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, margin)) return false;
  }
  return true;
}

/** A random legal spot within r of (cx, cy). Writes into out. */
export function randomSpot(rng: Rng, cx: number, cy: number, r: number, halfW: number, out: Pt): Pt {
  for (let i = 0; i < 10; i++) {
    out.x = cx + rng.range(-r, r);
    out.y = cy + rng.range(-r * 0.55, r * 0.55);
    clampPt(out, halfW);
    if (!insideKeep(out.x, out.y, 1.08)) return out;
  }
  legalize(out, halfW);
  return out;
}

/**
 * Where each agent hangs out (feet). Two per flank and two in front, DeepSeek
 * front and centre below its big cousin. Benched characters keep a spot for
 * when they come back.
 */
export const HOMES: Partial<Record<CharacterId, Pt>> = {
  clawd: { x: 58, y: 102 },
  glm: { x: 40, y: 146 },
  gemini: { x: 106, y: 158 },
  deepseek: { x: 172, y: 164 },
  gpt: { x: 248, y: 150 },
  grok: { x: 268, y: 106 },
  // benched
  codex: { x: 230, y: 152 },
  qwen: { x: 284, y: 128 },
  kimi: { x: 214, y: 90 },
};

/**
 * Orca's on-screen footprint (sprite, floor rings and its label). Workstations
 * must not cover any of it; agents' feet are kept out by KEEP instead.
 */
export const ORCA_VIS = { x: 120, y: 72, w: 80, h: 56 } as const;

export function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
}

/** Meeting seats around Orca (feet positions), all outside KEEP. One per main agent. */
export const SEATS: readonly Pt[] = [
  { x: 92, y: 112 }, { x: 228, y: 112 }, { x: 120, y: 138 }, { x: 200, y: 138 }, { x: 160, y: 146 },
  { x: 108, y: 90 }, { x: 212, y: 90 },
];
