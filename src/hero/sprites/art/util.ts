// Tiny helpers for composing pixel-matrix frames out of parts.
// A frame is an array of equal-length strings; '.' is transparent.
import type { SpriteAnim } from '../../types';

export type Frame = string[];
/** [x, y] or [x, y, char] — a single pixel relative to some origin. */
export type Pt = readonly [number, number] | readonly [number, number, string];

export class Grid {
  private c: string[][];
  constructor(readonly w: number, readonly h: number) {
    this.c = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
  }
  /** Copy the opaque pixels of `rows` with their top-left at (x, y). */
  stamp(rows: readonly string[], x = 0, y = 0): this {
    for (let j = 0; j < rows.length; j++) {
      const yy = y + j;
      if (yy < 0 || yy >= this.h) continue;
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        const xx = x + i;
        if (ch === '.' || ch === ' ' || xx < 0 || xx >= this.w) continue;
        this.c[yy][xx] = ch;
      }
    }
    return this;
  }
  set(x: number, y: number, ch: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y][x] = ch;
    return this;
  }
  get(x: number, y: number): string {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y][x] : '.';
  }
  /** Plot points relative to (ox, oy); points without a char use `ch`. */
  pts(list: readonly Pt[], ox: number, oy: number, ch: string): this {
    for (const p of list) this.set(ox + p[0], oy + p[1], p.length > 2 ? (p as readonly [number, number, string])[2] : ch);
    return this;
  }
  out(): Frame {
    return this.c.map(r => r.join(''));
  }
}

/** Mirror horizontally. */
export function mirror(f: Frame): Frame {
  return f.map(r => [...r].reverse().join(''));
}

/** Shift the pixels of columns x0..x1 vertically by dy (vacated cells become '.'). */
export function shiftCols(f: Frame, x0: number, x1: number, dy: number): Frame {
  if (!dy) return f.slice();
  const h = f.length;
  const rows = f.map(r => [...r]);
  for (let x = x0; x <= x1; x++) {
    const col = f.map(r => r[x] ?? '.');
    for (let y = 0; y < h; y++) {
      const src = y - dy;
      rows[y][x] = src >= 0 && src < h ? col[src] : '.';
    }
  }
  return rows.map(r => r.join(''));
}

/** Replace palette keys. */
export function recolor(f: Frame, map: Record<string, string>): Frame {
  return f.map(r => [...r].map(ch => map[ch] ?? ch).join(''));
}

export function anim(frames: Frame[], fps: number, loop = true): SpriteAnim {
  return loop ? { frames, fps } : { frames, fps, loop: false };
}

/** Dev sanity check: equal row widths per frame, and every char is in the palette. */
export function validate(name: string, palette: Record<string, string>, anims: Record<string, SpriteAnim>): void {
  for (const [an, a] of Object.entries(anims)) {
    a.frames.forEach((f, i) => {
      const w = f[0]?.length ?? 0;
      f.forEach((r, j) => {
        if (r.length !== w) console.warn(`[sprites] ${name}.${an}[${i}] row ${j} is ${r.length} wide, expected ${w}`);
        for (const ch of r) if (ch !== '.' && !(ch in palette)) console.warn(`[sprites] ${name}.${an}[${i}] unknown colour '${ch}'`);
      });
    });
  }
}
