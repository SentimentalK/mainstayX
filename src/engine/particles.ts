// Pooled pixel particles. No allocation after construction.
import { rgba } from './draw';

export interface ParticleSpec {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** Seconds. */
  life?: number;
  color?: string;
  /** Square size in px (1..3). */
  size?: number;
  /** px/s² downward. */
  gravity?: number;
  /** Velocity multiplier per second (0..1, 1 = no drag). */
  drag?: number;
  /** Fade out over the last part of life. Default true. */
  fade?: boolean;
  /** Stop and settle when reaching this y (floor). */
  floor?: number;
}

interface P {
  alive: boolean; x: number; y: number; vx: number; vy: number;
  life: number; max: number; color: string; size: number;
  gravity: number; drag: number; fade: boolean; floor: number;
}

export class Particles {
  private pool: P[] = [];
  private cursor = 0;
  count = 0;

  constructor(capacity = 600) {
    for (let i = 0; i < capacity; i++)
      this.pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 1, gravity: 0, drag: 1, fade: true, floor: Infinity });
  }

  emit(s: ParticleSpec): void {
    const pool = this.pool;
    let p: P | undefined;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[(this.cursor + i) % pool.length];
      if (!c.alive) { p = c; this.cursor = (this.cursor + i + 1) % pool.length; break; }
    }
    if (!p) { p = pool[this.cursor]; this.cursor = (this.cursor + 1) % pool.length; this.count--; }
    p.alive = true;
    p.x = s.x; p.y = s.y; p.vx = s.vx ?? 0; p.vy = s.vy ?? 0;
    p.life = p.max = s.life ?? 0.6;
    p.color = s.color ?? '#ffffff';
    p.size = s.size ?? 1;
    p.gravity = s.gravity ?? 0;
    p.drag = s.drag ?? 1;
    p.fade = s.fade ?? true;
    p.floor = s.floor ?? Infinity;
    this.count++;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; this.count--; continue; }
      const d = p.drag === 1 ? 1 : Math.pow(p.drag, dt);
      p.vx *= d; p.vy = p.vy * d + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > p.floor) { p.y = p.floor; p.vy = 0; p.vx *= 0.8; }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.life / p.max;
      ctx.fillStyle = p.fade && k < 0.4 ? rgba(p.color, k / 0.4) : p.color;
      const s = p.size;
      ctx.fillRect(Math.round(p.x - (s >> 1)), Math.round(p.y - (s >> 1)), s, s);
    }
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
    this.count = 0;
  }
}
