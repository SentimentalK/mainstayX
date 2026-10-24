// Synthwave backdrop behind the door: banded sky, twinkling stars, striped
// sun whose stripes drift toward the horizon, mountains, and a perspective
// grid that scrolls gently toward the viewer. Static parts are pre-rendered
// layers; only stars, sun stripes, grid rows and the odd shooting star are
// drawn per frame.
import type { Rng } from '../../types';
import { W, H } from '../../types';
import { PAL } from '../../data/theme';
import { bands, line, makeLayer, mix, rect, type Layer } from '../../engine/draw';
import { HZ } from './layout';

const SUN_CX = 160, SUN_CY = 96, SUN_R = 44;
const STARS = 60;
const GRID_ROWS = 8;

/** Sun row colours, index = y + SUN_R (0 = top). */
const SUN_COLS: string[] = [];
for (let i = 0; i <= SUN_R; i++) SUN_COLS.push(mix(PAL.sunTop, PAL.sunBot, i / SUN_R));
const SUN_HALF: number[] = [];
for (let i = 0; i <= SUN_R; i++) { const y = i - SUN_R; SUN_HALF.push(Math.sqrt(SUN_R * SUN_R - y * y) | 0); }
/** Grid row colours by depth (dimmer near the horizon). */
const GRID_COLS: string[] = [];
for (let i = 0; i <= 8; i++) GRID_COLS.push(mix(mix(PAL.ground, PAL.grid, 0.45), PAL.grid, i / 8));
const TRAIL = 9;
const TRAIL_COLS: string[] = [];
for (let i = 0; i < TRAIL; i++) TRAIL_COLS.push(mix('#ffffff', PAL.neonA, i / (TRAIL - 1)));

export class Backdrop {
  private sky: Layer;
  private mountains: Layer;
  private ground: Layer;
  private sx = new Float32Array(STARS);
  private sy = new Float32Array(STARS);
  private sa = new Float32Array(STARS);
  private sp = new Float32Array(STARS);
  private sf = new Float32Array(STARS);
  private t = 0;
  private sunPhase = 0;
  private gridPhase = 0;
  // shooting star
  private shootOn = false;
  private shootX = 0; private shootY = 0; private shootVx = 0; private shootVy = 0;
  private shootLife = 0; private shootMax = 1;
  private shootNext: number;

  constructor(private rng: Rng, private reduced: boolean) {
    // Fixed fork so every scene with this seed gets the same stars and mountains.
    const r = rng;
    for (let i = 0; i < STARS; i++) {
      this.sx[i] = Math.floor(r.next() * W);
      this.sy[i] = Math.floor(r.next() * 60);
      this.sa[i] = 0.3 + r.next() * 0.7;
      this.sp[i] = r.next() * Math.PI * 2;
      this.sf[i] = 0.8 + r.next() * 2.6;
    }
    this.sky = makeLayer(W, HZ, c => bands(c, 0, HZ, PAL.sky0, PAL.sky1, 10));
    this.mountains = makeLayer(W, HZ, c => {
      let h = 14;
      for (let x = 0; x < W; x++) {
        h = Math.max(4, Math.min(30, h + (r.next() - 0.5) * 4));
        const f = Math.min(1, Math.max(0, (Math.abs(x - 160) - 48) / 24));
        const dip = 0.35 + 0.65 * f * f * (3 - 2 * f); // lower in front of the sun
        rect(c, x, HZ - h * dip, 1, h * dip + 1, PAL.far);
        // faint rim light on the ridge
        rect(c, x, Math.round(HZ - h * dip), 1, 1, mix(PAL.far, PAL.sunBot, 0.25));
      }
    });
    this.ground = makeLayer(W, H, c => {
      rect(c, 0, HZ, W, H - HZ, PAL.ground);
      bands(c, HZ, HZ + 14, mix(PAL.ground, PAL.sunBot, 0.22), PAL.ground, 7);
      for (let i = -14; i <= 14; i++) line(c, 160 + i * 10, HZ, 160 + i * 52, H, PAL.grid);
    });
    this.shootNext = 3 + rng.next() * 5;
  }

  update(dt: number): void {
    this.t += dt;
    const slow = this.reduced ? 0.4 : 1;
    this.sunPhase = (this.sunPhase + dt * 2.2 * slow) % 7;
    this.gridPhase = (this.gridPhase + dt * 0.35 * slow) % 1;
    if (this.shootOn) {
      this.shootLife -= dt;
      this.shootX += this.shootVx * dt;
      this.shootY += this.shootVy * dt;
      if (this.shootLife <= 0) this.shootOn = false;
    } else if (!this.reduced) {
      this.shootNext -= dt;
      if (this.shootNext <= 0) {
        const r = this.rng;
        this.shootOn = true;
        const dir = r.chance(0.5) ? 1 : -1;
        this.shootX = dir > 0 ? r.range(20, 140) : r.range(180, 300);
        this.shootY = r.range(6, 30);
        const sp = r.range(150, 220);
        this.shootVx = dir * sp;
        this.shootVy = sp * r.range(0.25, 0.45);
        this.shootLife = this.shootMax = r.range(0.35, 0.6);
        this.shootNext = r.range(6, 13);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(this.sky, 0, 0);
    // stars
    const t = this.t;
    ctx.fillStyle = PAL.star;
    const prev = ctx.globalAlpha;
    for (let i = 0; i < STARS; i++) {
      const tw = 0.55 + 0.45 * Math.sin(t * this.sf[i] + this.sp[i]);
      const a = this.sa[i] * tw;
      ctx.globalAlpha = prev * a;
      ctx.fillRect(this.sx[i], this.sy[i], 1, 1);
      if (a > 0.82 && this.sa[i] > 0.9) {
        ctx.globalAlpha = prev * (a - 0.6);
        ctx.fillRect(this.sx[i] - 1, this.sy[i], 3, 1);
        ctx.fillRect(this.sx[i], this.sy[i] - 1, 1, 3);
      }
    }
    // shooting star
    if (this.shootOn) {
      const k = this.shootLife / this.shootMax;
      const fade = k > 0.7 ? (1 - k) / 0.3 : k / 0.7;
      const len = Math.hypot(this.shootVx, this.shootVy);
      const ux = this.shootVx / len, uy = this.shootVy / len;
      for (let i = 0; i < TRAIL; i++) {
        ctx.globalAlpha = prev * fade * (1 - i / TRAIL);
        ctx.fillStyle = TRAIL_COLS[i];
        ctx.fillRect(Math.round(this.shootX - ux * i * 1.6), Math.round(this.shootY - uy * i * 1.6), 1, 1);
      }
    }
    ctx.globalAlpha = prev;
    // sun with drifting stripes (stripes thicken toward the horizon)
    const ph = Math.floor(this.sunPhase);
    for (let i = 0; i <= SUN_R; i++) {
      const y = i - SUN_R, k = -y;
      if (y > -SUN_R * 0.6 && (k + ph) % 7 < 3 - k / 14) continue;
      const half = SUN_HALF[i];
      ctx.fillStyle = SUN_COLS[i];
      ctx.fillRect(SUN_CX - half, SUN_CY + y, half * 2, 1);
    }
    ctx.drawImage(this.mountains, 0, 0);
    ctx.drawImage(this.ground, 0, 0);
    // horizontal grid rows scrolling toward the viewer
    const s = this.gridPhase;
    for (let k = 0; k <= GRID_ROWS; k++) {
      const d = (k + s) / GRID_ROWS;
      const y = Math.round(HZ + (H - HZ) * d * d);
      if (y >= H) break;
      ctx.fillStyle = GRID_COLS[Math.min(8, k)];
      ctx.fillRect(0, y, W, 1);
    }
    ctx.fillStyle = PAL.sunBot;
    ctx.fillRect(0, HZ, W, 1);
  }
}
