// Synthwave backdrop: banded sky, twinkling stars, shooting stars, a striped
// sun with drifting gaps, two parallax mountain ranges and a grid floor that
// scrolls toward the viewer. Static parts are pre-rendered once.
import type { PointerState, Rng } from '../types';
import { W, H } from '../types';
import { PAL, WORLD_PAL } from '../data/theme';
import { bands, line, makeLayer, mix, rect, rgba, type Layer } from '../engine/draw';
import { HZ } from './layout';

const N_STARS = 70;
const SUN_R = 25;
const SUN_CY = 58;
const MTN_W = 640; // tileable mountain strip width
const GRID_ROWS = 11;

interface Star { x: number; y: number; ph: number; sp: number; base: number }

export class Backdrop {
  private sky: Layer;
  private sunBase: Layer;
  private sun: Layer;
  private sunCtx: CanvasRenderingContext2D;
  private farMtn: Layer;
  private nearMtn: Layer;
  private floor: Layer;
  private stars: Star[] = [];
  private t = 0;
  private gridPhase = 0;
  private shoot = { on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0 };
  private shootIn: number;

  constructor(private rng: Rng, private reduced: boolean, private pointer: PointerState) {
    for (let i = 0; i < N_STARS; i++)
      this.stars.push({ x: rng.int(0, W - 1), y: rng.int(1, HZ - 14), ph: rng.range(0, 6.28), sp: rng.range(0.6, 2.4), base: rng.range(0.25, 0.9) });
    this.shootIn = rng.range(3, 8);

    this.sky = makeLayer(W, HZ, c => {
      bands(c, 0, HZ, WORLD_PAL.sky0, WORLD_PAL.sky1, 8);
    });

    const d = SUN_R * 2 + 2;
    this.sunBase = makeLayer(d, d, c => {
      // hard-banded disc, yellow top → pink bottom
      for (let y = -SUN_R; y <= SUN_R; y++) {
        const hw = Math.round(SUN_R * Math.sqrt(Math.max(0, 1 - (y * y) / (SUN_R * SUN_R))));
        const band = Math.floor(((y + SUN_R) / (SUN_R * 2)) * 7) / 6;
        rect(c, SUN_R + 1 - hw, SUN_R + 1 + y, hw * 2 + 1, 1, mix(PAL.sunTop, PAL.sunBot, band));
      }
    });
    this.sun = makeLayer(d, d, () => {});
    this.sunCtx = this.sun.getContext('2d')!;

    this.farMtn = mountains(rng, PAL.far, mix(PAL.far, PAL.neonA, 0.35), 24, 9, [2, 3, 5, 9]);
    this.nearMtn = mountains(rng, '#1b0730', mix('#1b0730', PAL.neonA, 0.5), 15, 6, [3, 4, 7, 13]);

    this.floor = makeLayer(W, H - HZ, c => {
      rect(c, 0, 0, W, H - HZ, WORLD_PAL.floor);
      // soft haze just under the horizon
      for (let i = 0; i < 6; i++) rect(c, 0, i, W, 1, mix(WORLD_PAL.floor, PAL.neonA, 0.22 - i * 0.035));
      for (let i = -18; i <= 18; i++) line(c, 160 + i * 8, 0, 160 + i * 44, H - HZ, WORLD_PAL.grid);
    });
  }

  update(dt: number): void {
    this.t += dt;
    this.gridPhase = (this.gridPhase + dt * (this.reduced ? 0.12 : 0.4)) % 1;
    const s = this.shoot;
    if (s.on) {
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0 || s.y > HZ - 4) s.on = false;
    } else if (!this.reduced) {
      this.shootIn -= dt;
      if (this.shootIn <= 0) {
        this.shootIn = this.rng.range(6, 14);
        const dir = this.rng.chance(0.5) ? 1 : -1;
        s.on = true;
        s.x = this.rng.range(40, W - 40); s.y = this.rng.range(4, 22);
        s.vx = dir * this.rng.range(120, 170); s.vy = this.rng.range(30, 55);
        s.life = s.max = this.rng.range(0.45, 0.7);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.t;
    ctx.drawImage(this.sky, 0, 0);

    // stars
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const tw = this.reduced ? 0.7 : 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      ctx.fillStyle = rgba(PAL.star, Math.max(0.05, s.base * tw));
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    const sh = this.shoot;
    if (sh.on) {
      const k = sh.life / sh.max;
      const len = 7, nx = sh.vx / Math.hypot(sh.vx, sh.vy), ny = sh.vy / Math.hypot(sh.vx, sh.vy);
      for (let i = 0; i < len; i++) {
        ctx.fillStyle = rgba(i === 0 ? '#ffffff' : PAL.star, k * (1 - i / len));
        ctx.fillRect(Math.round(sh.x - nx * i * 1.6), Math.round(sh.y - ny * i * 1.6), 1, 1);
      }
    }

    // sun with slowly drifting gaps (cut out of a cached disc)
    const sc = this.sunCtx, d = SUN_R * 2 + 2;
    sc.globalCompositeOperation = 'copy';
    sc.drawImage(this.sunBase, 0, 0);
    sc.globalCompositeOperation = 'source-over';
    const drift = (t * (this.reduced ? 1.2 : 3)) % 7;
    for (let k = 0; k < 6; k++) {
      const y = SUN_R + 1 + Math.round(k * 7 - 3 + drift);
      if (y < SUN_R - 6 || y >= d) continue;
      const th = 1 + Math.floor((y - (SUN_R - 6)) / 9);
      sc.clearRect(0, y, d, th);
    }
    ctx.drawImage(this.sun, 160 - SUN_R - 1, SUN_CY - SUN_R - 1);

    // mountains with light parallax (time drift + pointer)
    const px = this.pointer.inside ? (this.pointer.x - 160) / 160 : 0;
    this.strip(ctx, this.farMtn, t * (this.reduced ? 0.6 : 1.5) + px * 3);
    this.strip(ctx, this.nearMtn, t * (this.reduced ? 1.2 : 3.5) + px * 7);

    // floor: static radial lines + scrolling horizontal rows
    ctx.drawImage(this.floor, 0, HZ);
    const gh = H - HZ;
    for (let k = 0; k < GRID_ROWS; k++) {
      const z = (k + this.gridPhase) / GRID_ROWS;
      const y = HZ + Math.round(gh * z * z);
      if (y <= HZ + 1) continue;
      ctx.fillStyle = mix(WORLD_PAL.floor, WORLD_PAL.grid, 0.35 + 0.65 * z);
      ctx.fillRect(0, y, W, 1);
    }
    ctx.fillStyle = rgba(PAL.neonA, 0.65);
    ctx.fillRect(0, HZ, W, 1);
  }

  private strip(ctx: CanvasRenderingContext2D, layer: Layer, off: number): void {
    const o = Math.round(((off % MTN_W) + MTN_W) % MTN_W);
    const y = HZ - layer.height + 1;
    ctx.drawImage(layer, -o, y);
    if (MTN_W - o < W) ctx.drawImage(layer, MTN_W - o, y);
  }
}

/** Tileable mountain silhouette: sum of sines with integer periods over MTN_W. */
function mountains(rng: Rng, fill: string, rim: string, height: number, base: number, periods: number[]): Layer {
  const ph = periods.map(() => rng.range(0, Math.PI * 2));
  const amp = periods.map((_, i) => 1 / (i + 1.2));
  const ampSum = amp.reduce((a, b) => a + b, 0);
  return makeLayer(MTN_W, height + 1, c => {
    let prev = -1;
    for (let x = 0; x < MTN_W; x++) {
      let v = 0;
      for (let i = 0; i < periods.length; i++) v += amp[i] * Math.sin((x / MTN_W) * Math.PI * 2 * periods[i] + ph[i]);
      v = (v / ampSum + 1) / 2; // 0..1
      v = Math.pow(v, 1.6);
      const top = Math.round(height - base * 0.3 - v * (height - base * 0.3));
      rect(c, x, top, 1, height + 1 - top, fill);
      rect(c, x, top, 1, 1, rim);
      if (prev >= 0 && Math.abs(prev - top) > 1) rect(c, x, Math.min(prev, top), 1, Math.abs(prev - top), rim);
      prev = top;
    }
  });
}
