// Lost & found: "where's my key??" — looks left and right, '?' above the head,
// spins in place, gives up… turns around and it was right behind them.
import { W } from '../../types';
import { drawSprite } from '../../sprites/render';
import { rgba } from '../../engine/draw';
import { Skit, type SkitDef } from '../skit';

const ITEMS = [['key', 'my key??'], ['note', 'my tunes??'], ['coffee', 'my coffee?!'], ['ctx', "where's my ctx??"]] as const;

class Lost extends Skit {
  private item = 'key';
  private ix = 0;
  private iy = 0;
  private fwd = 1;
  private held = false;
  private flipT = 0;

  protected override begin(): void {
    const a = this.actors[0], r = this.w.srng;
    this.fwd = a.x < 160 ? 1 : -1;
    a.flip = this.fwd < 0;
    const [icon, line] = r.pick(ITEMS);
    this.item = icon;
    this.ix = Math.max(8, Math.min(W - 8, a.x - this.fwd * (a.w / 2 + 9)));
    this.iy = a.y;
    a.talk(line, 1.6);
    this.w.sfx('question', a.x, 0.4);
  }

  step(dt: number): void {
    const a = this.actors[0];
    switch (this.phase) {
      case 0:
        if (this.pt > 1.5) { a.setPose('look', true); a.showIcon('q', 2.4); this.next(); }
        break;
      case 1: // looking around (but never behind)
        if (this.pt > 2.2) { a.showIcon(null); this.next(); }
        break;
      case 2: // spin in place
        if ((this.flipT -= dt) <= 0) { this.flipT = 0.08; a.flip = !a.flip; }
        if (this.pt > 0.9) { a.flip = this.fwd < 0; a.setPose('idle'); a.talk('...', 0.9); this.next(); }
        break;
      case 3:
        if (this.pt > 1) {
          a.flip = this.fwd > 0; // turn around
          a.setPose('shock', true);
          a.showIcon('bang', 1);
          a.hop(70);
          this.w.sfx('found', a.x, 0.5);
          this.next();
        }
        break;
      case 4:
        if (this.pt > 0.7) { a.setPose('idle'); a.goTo(this.ix + this.fwd * 3, this.iy); this.next(); }
        break;
      case 5:
        if (!a.moving || this.pt > 2.5) {
          this.held = true;
          a.showIcon(this.item, 1.5);
          a.talk('found it!', 1.5);
          a.hop(60);
          this.w.fx.glint(a.x, a.top, '#ffe259', 6);
          this.next();
        }
        break;
      default:
        if (this.pt > 1.5) this.end();
    }
  }

  override renderFloor(ctx: CanvasRenderingContext2D): void {
    if (this.held) return;
    const g = (Math.sin(this.t * 6) + 1) / 2;
    ctx.fillStyle = rgba('#ffe259', 0.15 + g * 0.2);
    ctx.fillRect(Math.round(this.ix) - 4, Math.round(this.iy) - 7, 9, 8);
    drawSprite(ctx, 'icon', this.item, 0, Math.round(this.ix), Math.round(this.iy));
  }
}

export const lost: SkitDef = {
  name: 'lost-and-found', weight: 3, cooldown: 30, timeout: 14,
  cast: w => w.pick(1, true),
  make: (w, a) => new Lost('lost-and-found', w, a),
};
