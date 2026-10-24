// Sprite cache + drawing. Every (sprite, anim, frame, flip, scale, outline,
// solid) combination is rasterised once into an offscreen canvas and then
// blitted with drawImage, so drawing a sprite in the main loop is cheap.
import type { DrawSpriteOpts, SpriteDef, SpriteId } from '../types';
import { SPRITES } from './defs';

interface FrameCache {
  rows: string[];
  w: number;
  h: number;
  variants: Map<string, HTMLCanvasElement>;
}

const cache = new Map<string, FrameCache[]>();

function frames(id: SpriteId, anim: string): FrameCache[] {
  const key = id + ':' + anim;
  let fc = cache.get(key);
  if (fc) return fc;
  const def: SpriteDef | undefined = SPRITES[id];
  const a = def?.anims[anim] ?? def?.anims.idle ?? (def ? Object.values(def.anims)[0] : undefined);
  const list = a?.frames.length ? a.frames : [['M']];
  fc = list.map(rows => ({ rows, w: Math.max(...rows.map(r => r.length)), h: rows.length, variants: new Map() }));
  cache.set(key, fc);
  return fc;
}

function raster(id: SpriteId, f: FrameCache, flip: boolean, s: number, outline?: string, solid?: string): HTMLCanvasElement {
  const pal = SPRITES[id]?.palette ?? {};
  const pad = outline ? 1 : 0;
  const c = document.createElement('canvas');
  c.width = f.w * s + pad * 2;
  c.height = f.h * s + pad * 2;
  const ctx = c.getContext('2d')!;
  const paint = (ox: number, oy: number, colour?: string) => {
    for (let j = 0; j < f.h; j++) {
      const row = f.rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        ctx.fillStyle = colour ?? pal[ch] ?? '#ff00ff';
        ctx.fillRect(pad + ox + (flip ? f.w - 1 - i : i) * s, pad + oy + j * s, s, s);
      }
    }
  };
  if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) paint(dx, dy, outline);
  paint(0, 0, solid);
  return c;
}

/** Number of frames in an animation (falls back to idle / first anim). */
export function frameCount(id: SpriteId, anim: string): number {
  return frames(id, anim).length;
}

export function hasAnim(id: SpriteId, anim: string): boolean {
  return !!SPRITES[id]?.anims[anim];
}

/** Frame index for an animation that has been playing for t seconds. */
export function frameAt(id: SpriteId, anim: string, t: number): number {
  const def = SPRITES[id];
  const a = def?.anims[anim] ?? def?.anims.idle;
  if (!a || a.frames.length <= 1) return 0;
  const n = Math.floor(Math.max(0, t) * a.fps);
  return a.loop === false ? Math.min(n, a.frames.length - 1) : n % a.frames.length;
}

/** Size in px of a frame at the given scale (without outline). */
export function spriteSize(id: SpriteId, anim = 'idle', scale = 1, frame = 0): { w: number; h: number } {
  const fc = frames(id, anim);
  const f = fc[((frame % fc.length) + fc.length) % fc.length];
  return { w: f.w * scale, h: f.h * scale };
}

/**
 * Draw a sprite anchored at bottom-centre (cx, by). Returns the drawn
 * bounding box (useful for hit tests and placing bubbles).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  id: SpriteId,
  anim: string,
  frame: number,
  cx: number,
  by: number,
  o: DrawSpriteOpts = {},
): { x: number; y: number; w: number; h: number } {
  const fc = frames(id, anim);
  const f = fc[((frame % fc.length) + fc.length) % fc.length];
  const s = Math.max(1, Math.round(o.scale ?? 1));
  const flip = !!o.flip;
  const key = (flip ? 'f' : 'n') + s + (o.outline ?? '') + '|' + (o.solid ?? '');
  let img = f.variants.get(key);
  if (!img) {
    img = raster(id, f, flip, s, o.outline, o.solid);
    f.variants.set(key, img);
  }
  const w = f.w * s, h = f.h * s;
  const x = Math.round(cx - w / 2), y = Math.round(by - h);
  const pad = o.outline ? 1 : 0;
  if (o.alpha !== undefined && o.alpha < 1) {
    if (o.alpha <= 0) return { x, y, w, h };
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * o.alpha;
    ctx.drawImage(img, x - pad, y - pad);
    ctx.globalAlpha = prev;
  } else ctx.drawImage(img, x - pad, y - pad);
  return { x, y, w, h };
}

/** Drop all cached rasters (e.g. after hot-reloading sprite data). */
export function clearSpriteCache(): void {
  cache.clear();
}
