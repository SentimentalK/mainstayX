// Pixel drawing primitives for the 320×180 low-res canvas. Everything snaps
// to whole pixels; hard colour steps read as pixel art, smooth gradients don't.
import { W } from '../types';

type Ctx = CanvasRenderingContext2D;

// ---------- colour ----------

export function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1, 7), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

const mixCache = new Map<string, string>();
/** Blend two #rrggbb colours. Results are cached (t is quantised to 1/64). */
export function mix(a: string, b: string, t: number): string {
  const q = Math.round(Math.min(1, Math.max(0, t)) * 64);
  const key = a + b + q;
  let out = mixCache.get(key);
  if (out === undefined) {
    const A = hex(a), B = hex(b), f = q / 64;
    out = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * f).toString(16).padStart(2, '0')).join('');
    mixCache.set(key, out);
  }
  return out;
}

/** rgba() string for a #rrggbb colour. Cached. */
const rgbaCache = new Map<string, string>();
export function rgba(c: string, a: number): string {
  const q = Math.round(a * 100);
  const key = c + q;
  let out = rgbaCache.get(key);
  if (out === undefined) {
    const [r, g, b] = hex(c);
    out = `rgba(${r},${g},${b},${q / 100})`;
    rgbaCache.set(key, out);
  }
  return out;
}

// ---------- primitives ----------

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(ctx: Ctx, x: number, y: number, c: string): void {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** Run fn with globalAlpha multiplied by a. */
export function alpha(ctx: Ctx, a: number, fn: () => void): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  fn();
  ctx.globalAlpha = prev;
}

/** Horizontal colour bands from c0 to c1 between y0 and y1, full width. */
export function bands(ctx: Ctx, y0: number, y1: number, c0: string, c1: string, steps: number, x = 0, w = W): void {
  const h = (y1 - y0) / steps;
  for (let i = 0; i < steps; i++) rect(ctx, x, y0 + i * h, w, Math.ceil(h) + 1, mix(c0, c1, steps > 1 ? i / (steps - 1) : 0));
}

/** Bresenham line. dash > 0 draws dash-on / dash-off segments; phase shifts them. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string, dash = 0, phase = 0): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, n = Math.round(phase);
  ctx.fillStyle = c;
  for (let guard = 0; guard < 4096; guard++) {
    if (!dash || ((n++ % (dash * 2)) + dash * 2) % (dash * 2) < dash) ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

/** 1px rectangle outline. */
export function frame(ctx: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  rect(ctx, x, y, w, 1, c); rect(ctx, x, y + h - 1, w, 1, c);
  rect(ctx, x, y, 1, h, c); rect(ctx, x + w - 1, y, 1, h, c);
}

/** 1px ellipse outline. */
export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string): void {
  ctx.fillStyle = c;
  const steps = Math.max(24, Math.ceil((rx + ry) * 2));
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), 1, 1);
  }
}

/** Filled ellipse (scanline). */
export function disc(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string): void {
  ctx.fillStyle = c;
  const r = Math.max(1, Math.round(ry));
  for (let y = -r; y <= r; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r))));
    ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
  }
}

// ---------- cached layers ----------

export type Layer = HTMLCanvasElement;

/** Paint once into an offscreen canvas; blit it each frame with ctx.drawImage. */
export function makeLayer(w: number, h: number, paint: (ctx: Ctx) => void): Layer {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  return c;
}

