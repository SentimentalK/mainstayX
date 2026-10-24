// Orca, the dispatcher: floats and bobs at the centre, tail wags (swim),
// pulsing rings below, blows a water spout now and then, calls meetings and
// pings sonar rings. It turns to face whoever it's talking to.
import type { OrcaAnim, Rng } from '../types';
import { PAL } from '../data/theme';
import { drawSprite, frameAt, spriteSize } from '../sprites/render';
import { ellipse } from '../engine/draw';
import { ORCA_X, ORCA_Y } from './layout';
import type { Fx } from './fx';
import type { Anchor } from './links';

const SCALE = 2;

export class Orca implements Anchor {
  readonly id = 'orca' as const;
  x = ORCA_X;
  y = ORCA_Y;
  hx = ORCA_X;
  hy = ORCA_Y - 14;
  flip = false;
  hovered = false;
  /** Hit box (updated every step). */
  box = { x: 0, y: 0, w: 0, h: 0 };
  say: string | null = null;
  sayT = 0;
  private t = 0;
  private anim: OrcaAnim = 'swim';
  private animT = 0;
  private hold = 0;
  private flashT = 0;
  private hopZ = 0;
  private hopV = 0;
  private blowIn: number;
  private pingIn: number;
  private w: number;
  private h: number;

  constructor(private rng: Rng, private fx: Fx, private reduced: boolean, private sfx: (n: 'spout' | 'ping', x: number, v?: number) => void) {
    this.blowIn = rng.range(4, 8);
    this.pingIn = rng.range(10, 16);
    const s = spriteSize('orca', 'swim', SCALE);
    this.w = s.w; this.h = s.h;
  }

  get busy(): boolean { return this.hold > 0; }

  /** Face toward an x position (sprites face right; flip = face left). */
  face(x: number): void { if (Math.abs(x - this.x) > 4) this.flip = x < this.x; }

  /** force: restart the spout even mid-animation (skits that need it on cue). */
  blow(force = false): void {
    if (this.hold > 0 && !force) return;
    this.setAnim('blow', 1.3);
    this.sfx('spout', this.x, 0.45);
  }

  call(dur = 1.6): void {
    this.setAnim('call', dur);
    this.fx.ring(this.x, this.y + 4, 20, 90, 1.3, PAL.neonA, 0.32);
    this.fx.ring(this.x, this.y + 4, 10, 70, 1.6, PAL.sunTop, 0.32);
  }

  /** Sonar ping (sfx is the caller's choice: ambient pings are quieter). */
  ping(vol = 0.35): void {
    this.fx.ring(this.x, this.y + 4, 12, 110, 1.6, PAL.neonB, 0.3);
    this.fx.ring(this.hx, this.hy, 4, 30, 0.7, PAL.neonB, 1);
    this.sfx('ping', this.x, vol);
  }

  flash(): void { this.flashT = 0.18; }

  hop(): void { if (this.hopZ <= 0) this.hopV = 70; }

  talk(text: string, dur = 1.4): void { this.say = text; this.sayT = dur; }

  private setAnim(a: OrcaAnim, hold: number): void {
    this.anim = a; this.animT = 0; this.hold = hold;
  }

  update(dt: number): void {
    this.t += dt;
    this.animT += dt;
    if (this.hold > 0 && (this.hold -= dt) <= 0) { this.anim = 'swim'; this.animT = 0; }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.sayT > 0 && (this.sayT -= dt) <= 0) this.say = null;
    if (this.hopZ > 0 || this.hopV > 0) {
      this.hopV -= 300 * dt; this.hopZ += this.hopV * dt;
      if (this.hopZ <= 0) { this.hopZ = 0; this.hopV = 0; }
    }
    const amp = this.reduced ? 1 : 2.5;
    const bob = Math.sin(this.t * 1.7) * amp;
    this.y = ORCA_Y - 3 + bob - this.hopZ;
    this.hx = this.x;
    this.hy = this.y - this.h * 0.5;
    this.box.x = this.x - this.w / 2; this.box.y = this.y - this.h; this.box.w = this.w; this.box.h = this.h;

    if (this.anim === 'blow' && this.hold > 0.25) {
      this.fx.spout(this.x + (this.flip ? -4 : 4), this.y - this.h + 2);
    }
    if ((this.blowIn -= dt) <= 0) { this.blowIn = this.rng.range(9, 16); this.blow(); }
    if ((this.pingIn -= dt) <= 0) { this.pingIn = this.rng.range(14, 24); if (this.hold <= 0) this.ping(0.18); }
  }

  /** Pulse rings on the floor under Orca. */
  renderFloor(ctx: CanvasRenderingContext2D): void {
    const cy = ORCA_Y + 4;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = 0.85;
    ellipse(ctx, this.x, cy, 34, 6, PAL.neonA);
    for (let i = 0; i < 2; i++) {
      const k = ((this.t * 0.45 + i * 0.5) % 1);
      ctx.globalAlpha = prev * (1 - k) * 0.6;
      ellipse(ctx, this.x, cy, 34 + k * 20, 6 + k * 4, PAL.neonA);
    }
    // soft shadow that shrinks as Orca rises
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000000';
    const sw = Math.round(36 - (ORCA_Y - this.y) * 0.8);
    ctx.fillRect(Math.round(this.x - sw / 2), cy - 1, sw, 2);
    ctx.globalAlpha = prev;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const f = frameAt('orca', this.anim, this.animT);
    const outline = this.hovered ? '#ffffff' : PAL.neonA;
    drawSprite(ctx, 'orca', this.anim, f, this.x, this.y, { flip: this.flip, scale: SCALE, outline });
    if (this.flashT > 0)
      drawSprite(ctx, 'orca', this.anim, f, this.x, this.y, { flip: this.flip, scale: SCALE, solid: '#ffffff', alpha: Math.min(1, this.flashT / 0.12) * 0.8 });
  }
}
