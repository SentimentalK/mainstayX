// Bug hunt: a little pixel bug scuttles across the floor; an agent spots it,
// chases it down and stomps it. "lgtm". (Or it gets away: "wontfix".)
import { W } from '../../types';
import { drawSprite } from '../../sprites/render';
import { rgba } from '../../engine/draw';
import { Skit, type SkitDef } from '../skit';

class BugHunt extends Skit {
  private bx = 0;
  private by = 0;
  private vx = 0;
  private vy = 0;
  private turn = 0;
  private alive = true;
  private retarget = 0;

  protected override begin(): void {
    const a = this.actors[0], r = this.w.srng;
    const fromLeft = a.x > 160;
    this.bx = fromLeft ? 8 : W - 8;
    this.by = r.range(134, 168);
    this.vx = fromLeft ? 32 : -32;
    a.face(this.bx);
    a.showIcon('bug', 1.2);
    a.talk('a bug!', 1.2);
    this.w.sfx('question', a.x, 0.4);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w, r = w.srng;
    if (this.alive) this.scuttle(dt, this.phase === 3);
    switch (this.phase) {
      case 0:
        if (this.pt > 0.8) this.next();
        break;
      case 1: // chase
        if ((this.retarget -= dt) <= 0) { this.retarget = 0.15; a.goTo(this.bx, this.by, true); }
        if (a.dist(this.bx, this.by) < 8) { a.stop(); a.hop(85); this.next(); }
        else if (this.pt > 7) { a.stop(); a.talk('wontfix', 1.5); a.showIcon('sweat', 1.5); this.next(3); }
        break;
      case 2: // stomp on landing
        if (this.pt > 0.1 && a.z <= 0.01) {
          this.alive = false;
          w.fx.splat(this.bx, this.by);
          w.fx.dust(a.x, a.y, 1, 3); w.fx.dust(a.x, a.y, -1, 3);
          w.sfx('bump', a.x, 0.4);
          w.shake(1, 0.12);
          a.talk(r.pick(['lgtm', 'fixed', 'squashed']), 1.4);
          a.showIcon('check', 1.4);
          this.next(4);
        }
        break;
      case 3: // it got away
        if (this.pt > 1.8) this.end();
        break;
      default:
        if (this.pt > 1.6) this.end();
    }
  }

  private scuttle(dt: number, flee: boolean): void {
    const r = this.w.srng, a = this.actors[0];
    if ((this.turn -= dt) <= 0) {
      this.turn = r.range(0.25, 0.7);
      this.vy = r.range(-28, 28);
      if (!flee && a.dist(this.bx, this.by) < 26 && r.chance(0.35)) this.vx = -this.vx; // dodge!
    }
    const sp = flee ? 2.2 : 1;
    this.bx += this.vx * sp * dt;
    this.by += this.vy * dt;
    if (this.by < 132) { this.by = 132; this.vy = Math.abs(this.vy); }
    if (this.by > 170) { this.by = 170; this.vy = -Math.abs(this.vy); }
    if (!flee) {
      if (this.bx < 8) { this.bx = 8; this.vx = Math.abs(this.vx); }
      if (this.bx > W - 8) { this.bx = W - 8; this.vx = -Math.abs(this.vx); }
    } else if (this.bx < -10 || this.bx > W + 10) this.alive = false;
  }

  override renderFloor(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;
    const x = Math.round(this.bx), y = Math.round(this.by) - ((this.t * 14) & 1);
    ctx.fillStyle = rgba('#000000', 0.5);
    ctx.fillRect(x - 2, Math.round(this.by), 5, 1);
    drawSprite(ctx, 'icon', 'bug', 0, x, y, { flip: this.vx < 0 });
  }
}

export const bug: SkitDef = {
  name: 'bug-hunt', weight: 2.5, cooldown: 40, timeout: 14,
  cast: w => w.pick(1, true),
  make: (w, a) => new BugHunt('bug-hunt', w, a),
};
