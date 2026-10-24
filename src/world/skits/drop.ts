// Dropped packet: an agent rushes across with a task, the packet slips out,
// they run on, screech to a halt ('!'), run back, pick it up and deliver.
import { W } from '../../types';
import { PAL } from '../../data/theme';
import { drawSprite } from '../../sprites/render';
import { rgba } from '../../engine/draw';
import { FLOOR_BOT, FLOOR_TOP, legalize, segmentClear } from '../layout';
import { Skit, type SkitDef } from '../skit';

class Drop extends Skit {
  private dx = 0;
  private dy = 0;
  private sx = 0;
  private px = 0;
  private py = 0;
  private pz = 0;
  private vx = 0;
  private vz = 0;
  private dropped = false;
  private picked = false;

  protected override begin(): void {
    const a = this.actors[0], r = this.w.srng;
    // a long run that doesn't pass behind Orca (so the drop is visible)
    const dest = { x: 0, y: 0 };
    for (let i = 0; i < 16; i++) {
      dest.x = a.x < 160 ? r.range(a.x + 90, 300) : r.range(20, a.x - 90);
      dest.y = r.range(FLOOR_TOP + 4, FLOOR_BOT - 4);
      legalize(dest, a.halfW);
      if (Math.abs(dest.x - a.x) > 70 && segmentClear(a.x, a.y, dest.x, dest.y)) break;
      dest.x = a.x < 160 ? a.x + 80 : a.x - 80; dest.y = a.y; // fallback: short dash
    }
    legalize(dest, a.halfW);
    this.dx = dest.x; this.dy = dest.y;
    a.carry = 'task';
    a.face(dest.x);
    a.talk(r.pick(['urgent!', 'hotfix!', 'p0!!']), 1);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w;
    if (this.dropped && !this.picked) this.physics(dt);
    switch (this.phase) {
      case 0:
        if (this.pt > 0.6) { this.sx = a.x; a.goTo(this.dx, this.dy, true); this.next(); }
        break;
      case 1:
        if (Math.abs(a.x - this.sx) > Math.abs(this.dx - this.sx) * 0.3 || !a.moving) {
          a.carry = null;
          this.dropped = true;
          this.px = a.x + a.dir * (a.w / 2); this.py = a.y;
          this.pz = a.h * 0.4; this.vx = a.dir * 40; this.vz = 30;
          w.sfx('drop', a.x, 0.45);
          this.next();
        }
        break;
      case 2: // runs on, oblivious
        if (this.pt > 0.75 || !a.moving) {
          a.stop();
          w.fx.skid(a.x + a.dir * (a.w / 2), a.y, a.dir);
          a.setPose('shock', true);
          a.showIcon('bang', 1.1);
          w.sfx('oops', a.x, 0.45);
          this.next();
        }
        break;
      case 3:
        if (this.pt > 0.8) { a.setPose('idle'); a.goTo(this.px - a.dir * 4, this.py, true); this.next(); }
        break;
      case 4:
        if (!a.moving || this.pt > 4) {
          this.picked = true;
          a.carry = 'task';
          a.hop(70);
          a.talk('phew', 1.1);
          this.next();
        }
        break;
      case 5:
        if (this.pt > 1) {
          a.carry = null;
          a.face(w.orca.x);
          a.talk('>_ done', 1.2);
          const o = w.orca;
          w.links.send('result', a, o, { sfx: 'result', onArrive: () => o.flash() });
          this.next();
        }
        break;
      default:
        if (this.pt > 1.1) this.end();
    }
  }

  private physics(dt: number): void {
    this.vz -= 300 * dt;
    this.pz += this.vz * dt;
    if (this.pz <= 0) {
      this.pz = 0;
      this.vz = Math.abs(this.vz) > 25 ? -this.vz * 0.45 : 0;
      this.vx *= 0.5;
    }
    this.px = Math.max(6, Math.min(W - 6, this.px + this.vx * dt));
    this.vx *= Math.pow(0.15, dt);
  }

  override renderFloor(ctx: CanvasRenderingContext2D): void {
    if (!this.dropped || this.picked) return;
    const x = Math.round(this.px), y = Math.round(this.py - this.pz);
    ctx.fillStyle = rgba('#000000', 0.5);
    ctx.fillRect(x - 2, Math.round(this.py), 5, 1);
    ctx.fillStyle = rgba(PAL.neonA, 0.3 + 0.2 * Math.sin(this.t * 10));
    ctx.fillRect(x - 3, y - 5, 7, 7);
    drawSprite(ctx, 'packet', 'task', 0, x, y);
  }
}

export const drop: SkitDef = {
  name: 'dropped-packet', weight: 3, cooldown: 30, timeout: 16,
  cast: w => w.pick(1, true),
  make: (w, a) => new Drop('dropped-packet', w, a),
};
