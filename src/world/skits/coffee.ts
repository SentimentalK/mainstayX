// Coffee run: "brb", walks to the coffee machine at the screen edge, waits
// while it brews (steam), then zooms back home in turbo mode.
import { W } from '../../types';
import { PAL } from '../../data/theme';
import { rect, rgba } from '../../engine/draw';
import { EDGE } from '../layout';
import { Skit, type SkitDef } from '../skit';

const MW = 8, MH = 13;

class Coffee extends Skit {
  private mx = 0;
  private my = 0;
  private side = -1;
  private steamT = 0;
  private alpha = 0;

  protected override begin(): void {
    const a = this.actors[0];
    this.side = a.x < 160 ? -1 : 1;
    this.mx = this.side < 0 ? EDGE : W - EDGE - MW;
    this.my = a.y;
    const tx = this.side < 0 ? this.mx + MW + a.halfW - 1 : this.mx - a.halfW + 1;
    a.goTo(tx, a.y, false);
    a.talk('brb', 1.2);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w;
    this.alpha = Math.min(1, this.alpha + dt * 2);
    switch (this.phase) {
      case 0:
        if (!a.moving || this.pt > 8) { a.stop(); a.flip = this.side < 0; a.setPose('back', true); this.next(); }
        break;
      case 1: // brewing
        if ((this.steamT -= dt) <= 0) {
          this.steamT = 0.12;
          w.fx.emit(this.mx + MW / 2 + w.srng.range(-1, 1), this.my - MH - 1, w.srng.range(-3, 3), -14, 0.8, '#e8dfff');
        }
        if (this.pt > 1.6) {
          a.setPose('idle');
          a.flip = this.side > 0;
          a.showIcon('coffee', 4);
          w.sfx('blip', a.x, 0.35);
          this.next();
        }
        break;
      case 2:
        if (this.pt > 0.5) { a.talk('ahh', 0.9); this.next(); }
        break;
      case 3:
        if (this.pt > 0.9) {
          a.speedMul = 1.5;
          a.goTo(a.home.x, a.home.y, true);
          a.talk('turbo mode', 1.3);
          this.next();
        }
        break;
      case 4:
        if (!a.moving || this.pt > 6) { a.hop(60); a.showIcon(null); this.next(); }
        break;
      default:
        this.alpha = Math.max(0, this.alpha - dt * 4);
        if (this.pt > 0.6) this.end();
    }
  }

  override renderFloor(ctx: CanvasRenderingContext2D): void {
    if (this.alpha <= 0) return;
    const x = this.mx, y = Math.round(this.my) - MH;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * this.alpha;
    rect(ctx, x, y, MW, MH, '#2b1640');
    rect(ctx, x, y, MW, 1, PAL.neonB);
    rect(ctx, x + 1, y + 2, MW - 2, 3, '#0d0221');
    rect(ctx, x + 2, y + 3, 2, 1, (this.t * 3) % 1 < 0.5 ? PAL.neonA : '#7cff6b');
    rect(ctx, x + 2, y + 8, MW - 4, 4, '#ffe6f7');
    ctx.fillStyle = rgba('#000000', 0.5);
    ctx.fillRect(x, y + MH, MW, 1);
    ctx.globalAlpha = prev;
  }
}

export const coffee: SkitDef = {
  name: 'coffee-run', weight: 2, cooldown: 40, timeout: 18,
  cast: w => w.pick(1, true, a => a.x < 110 || a.x > 210),
  make: (w, a) => new Coffee('coffee-run', w, a),
};
