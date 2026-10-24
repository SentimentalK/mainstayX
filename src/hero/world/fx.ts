// Particle presets + expanding rings for the world. Everything is pooled and
// emitted through one reused spec object, so presets don't allocate.
import type { Rng } from '../types';
import { PAL } from '../data/theme';
import { Particles, type ParticleSpec } from '../engine/particles';
import { ellipse } from '../engine/draw';

interface Ring { on: boolean; x: number; y: number; r0: number; r1: number; t: number; dur: number; color: string; flat: number }

const CONFETTI = [PAL.neonA, PAL.neonB, PAL.sunTop, '#7cff6b', '#ffffff', PAL.sunBot];
const RING_CAP = 20;

export class Fx {
  readonly p = new Particles(700);
  private rings: Ring[] = [];
  private sp: ParticleSpec = { x: 0, y: 0 };
  /** Particle count multiplier (reducedMotion → fewer). */
  readonly k: number;

  constructor(private rng: Rng, reduced: boolean) {
    this.k = reduced ? 0.4 : 1;
    for (let i = 0; i < RING_CAP; i++) this.rings.push({ on: false, x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 1, color: '#fff', flat: 0.3 });
  }

  get count(): number { return this.p.count; }
  get ringCount(): number { let n = 0; for (const r of this.rings) if (r.on) n++; return n; }

  private n(base: number): number { return Math.max(1, Math.round(base * this.k)); }

  /** Emit one particle (no allocation). */
  emit(x: number, y: number, vx: number, vy: number, life: number, color: string, gravity = 0, drag = 1, size = 1, floor = Infinity): void {
    const s = this.sp;
    s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.life = life; s.color = color;
    s.gravity = gravity; s.drag = drag; s.size = size; s.floor = floor; s.fade = true;
    this.p.emit(s);
  }

  update(dt: number): void {
    this.p.update(dt);
    for (const r of this.rings) if (r.on && (r.t += dt) >= r.dur) r.on = false;
  }

  render(ctx: CanvasRenderingContext2D): void { this.p.render(ctx); }

  /** Rings are drawn on the floor layer (under sprites). */
  renderRings(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      if (!r.on) continue;
      const k = r.t / r.dur;
      const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k));
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * (1 - k) * 0.9;
      ellipse(ctx, r.x, r.y, rad, Math.max(1, rad * r.flat), r.color);
      ctx.globalAlpha = prev;
    }
  }

  ring(x: number, y: number, r0: number, r1: number, dur: number, color: string = PAL.neonB, flat = 0.3): void {
    let slot = this.rings[0];
    for (const r of this.rings) { if (!r.on) { slot = r; break; } if (r.t / r.dur > slot.t / slot.dur) slot = r; }
    slot.on = true; slot.x = x; slot.y = y; slot.r0 = r0; slot.r1 = r1; slot.t = 0; slot.dur = dur; slot.color = color; slot.flat = flat;
  }

  /** Typing sparks off a keyboard. */
  sparks(x: number, y: number, color: string = PAL.sunTop): void {
    const r = this.rng;
    for (let i = this.n(2); i > 0; i--)
      this.emit(x + r.range(-3, 3), y, r.range(-22, 22), r.range(-45, -20), r.range(0.18, 0.35), r.chance(0.3) ? '#ffffff' : color, 160);
  }

  /** Dust puffs behind running feet. dir = facing (+1 right). */
  dust(x: number, y: number, dir: number, n = 1): void {
    const r = this.rng;
    for (let i = this.n(n); i > 0; i--)
      this.emit(x + r.range(-1, 1), y - r.range(0, 2), -dir * r.range(8, 24), r.range(-14, -4), r.range(0.25, 0.45), r.chance(0.5) ? '#8a5aa8' : '#c79be0', 0, 0.1);
  }

  /** Screeching halt: a spray of dust in front of the feet. */
  skid(x: number, y: number, dir: number): void {
    const r = this.rng;
    for (let i = this.n(8); i > 0; i--)
      this.emit(x, y - 1, dir * r.range(10, 50), r.range(-30, -8), r.range(0.3, 0.55), r.chance(0.5) ? '#8a5aa8' : '#e0c0f0', 90, 1, 1, y);
  }

  confetti(x: number, y: number, n = 10): void {
    const r = this.rng;
    for (let i = this.n(n); i > 0; i--)
      this.emit(x + r.range(-4, 4), y, r.range(-40, 40), r.range(-75, -35), r.range(0.7, 1.3), CONFETTI[r.int(0, CONFETTI.length - 1)], 110, 0.35, r.chance(0.25) ? 2 : 1);
  }

  poof(x: number, y: number): void {
    const r = this.rng;
    const n = this.n(14);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r.range(-0.2, 0.2), s = r.range(18, 40);
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s * 0.7 - 6, r.range(0.3, 0.55), r.chance(0.6) ? '#f4e8ff' : '#c79be0', 0, 0.05, r.chance(0.4) ? 2 : 1);
    }
  }

  /** Water spout column from Orca's blowhole (call every frame while blowing). */
  spout(x: number, y: number): void {
    const r = this.rng;
    for (let i = this.n(2); i > 0; i--)
      this.emit(x + r.range(-1, 1), y, r.range(-10, 10), r.range(-95, -70), r.range(0.55, 0.85),
        r.chance(0.35) ? '#ffffff' : r.chance(0.5) ? PAL.neonB : '#8fdcff', 170, 1, r.chance(0.2) ? 2 : 1);
  }

  /** Papers flying out (context overflow). */
  papers(x: number, y: number): void {
    const r = this.rng;
    for (let i = this.n(16); i > 0; i--)
      this.emit(x + r.range(-3, 3), y, r.range(-55, 55), r.range(-90, -40), r.range(0.9, 1.5), r.chance(0.7) ? '#f4f0ff' : '#b9c2ff', 120, 0.25, 2);
  }

  /** Impact stars. */
  impact(x: number, y: number): void {
    const r = this.rng;
    for (let i = this.n(10); i > 0; i--) {
      const a = r.range(0, Math.PI * 2), s = r.range(25, 60);
      this.emit(x, y, Math.cos(a) * s, Math.sin(a) * s - 10, r.range(0.25, 0.5), r.chance(0.5) ? PAL.sunTop : '#ffffff', 0, 0.05);
    }
  }

  /** Squashed bug. */
  splat(x: number, y: number): void {
    const r = this.rng;
    for (let i = this.n(10); i > 0; i--)
      this.emit(x, y - 1, r.range(-45, 45), r.range(-40, -10), r.range(0.35, 0.7), r.chance(0.5) ? '#7cff6b' : '#3df5ff', 150, 1, 1, y);
  }

  /** Tiny glints, e.g. around a stamped packet. */
  glint(x: number, y: number, color: string = '#ffffff', n = 5): void {
    const r = this.rng;
    for (let i = this.n(n); i > 0; i--)
      this.emit(x + r.range(-5, 5), y + r.range(-4, 3), 0, r.range(-14, -4), r.range(0.3, 0.6), color);
  }
}
