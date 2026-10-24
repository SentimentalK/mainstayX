// Merge conflict: two agents grab the same packet — "mine!" "no, mine!" —
// tug-of-war until it pops and both tumble back.
import { PAL } from '../../data/theme';
import { drawSprite } from '../../sprites/render';
import { rgba } from '../../engine/draw';
import { legalize } from '../layout';
import { Skit, type SkitDef } from '../skit';

class Tug extends Skit {
  private mx = 0;
  private my = 0;
  private show = false;
  private dustT = 0;

  protected override begin(): void {
    const [a, b] = this.actors;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    legalize(m, a.w + 4);
    this.mx = m.x; this.my = m.y;
    const gap = (a.w + b.w) / 4 + 4, s = a.x < b.x ? -1 : 1;
    a.goTo(m.x + s * gap, m.y, true);
    b.goTo(m.x - s * gap, m.y, true);
    a.showIcon('bang', 1);
  }

  step(dt: number): void {
    const [a, b] = this.actors, w = this.w, r = w.srng;
    switch (this.phase) {
      case 0:
        if ((!a.moving && !b.moving) || this.pt > 5) {
          a.stop(); b.stop(); a.face(b.x); b.face(a.x);
          this.show = true;
          a.talk('mine!', 1); w.sfx('blip', a.x, 0.3);
          this.next();
        }
        break;
      case 1:
        if (this.pt > 0.8) { b.talk('no, MINE!', 1); this.next(); }
        break;
      case 2:
        if (this.pt > 0.7) { a.setPose('work', true); b.setPose('work', true); a.jitter = 1; b.jitter = 1; w.sfx('pass', this.mx, 0.3); this.next(); }
        break;
      case 3: // tug
        if ((this.dustT -= dt) <= 0) {
          this.dustT = 0.25;
          w.fx.dust(a.x, a.y, -a.dir); w.fx.dust(b.x, b.y, -b.dir);
        }
        if (this.pt > 2.2) {
          this.show = false;
          a.jitter = 0; b.jitter = 0;
          a.setPose('idle'); b.setPose('idle');
          const s = a.x < b.x ? -1 : 1;
          a.kx = s * 85; b.kx = -s * 85;
          a.hop(60); b.hop(60);
          a.dizzyT = 1; b.dizzyT = 1;
          w.fx.poof(this.mx, this.my - a.h * 0.45);
          w.fx.confetti(this.mx, this.my - a.h * 0.45, 6);
          w.sfx('poof', this.mx, 0.5);
          this.next();
        }
        break;
      case 4:
        if (this.pt > 0.6) { b.talk('merge conflict', 1.5); this.next(); }
        break;
      case 5:
        if (this.pt > 1.3) { a.talk(r.pick(['rebase?', 'git push -f', 'squash it']), 1.3); this.next(); }
        break;
      default:
        if (this.pt > 1.3) this.end();
    }
  }

  override renderTop(ctx: CanvasRenderingContext2D): void {
    if (!this.show) return;
    const [a] = this.actors;
    const x = Math.round(this.mx + Math.sin(this.t * 9) * (this.phase === 3 ? 2 : 0));
    const y = Math.round(this.my - a.h * 0.4);
    ctx.fillStyle = rgba(PAL.neonA, 0.35);
    ctx.fillRect(x - 3, y - 4, 7, 7);
    drawSprite(ctx, 'packet', 'task', 0, x, y + 1);
  }

  protected override cleanup(): void {
    for (const a of this.actors) a.jitter = 0;
  }
}

export const tug: SkitDef = {
  name: 'merge-conflict', weight: 1.8, cooldown: 45, timeout: 15,
  cast: w => {
    const c = w.pick(0, true);
    if (!c || c.length < 2) return null;
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++)
        if (c[i].dist(c[j].x, c[j].y) < 150) return [c[i], c[j]];
    return null;
  },
  make: (w, a) => new Tug('merge-conflict', w, a),
};
