// Context overflow: an agent reads the whole repo at once, its progress bar
// redlines and pops, papers fly everywhere — "where's my ctx??" — /compact.
import { Skit, type SkitDef } from '../skit';

const RED = '#ff3d5a';

class CtxOverflow extends Skit {
  private color = '';
  private sparkT = 0;
  private lookT = 0;

  protected override begin(): void {
    const a = this.actors[0];
    this.color = a.barColor;
    a.setPose('work', true);
    a.bar = 0;
    a.talk(this.w.srng.pick(['reading repo...', 'cat **/*', 'load all']), 1.3);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w;
    switch (this.phase) {
      case 0:
        a.bar = Math.min(1, a.bar + dt / 1.8);
        if (a.bar > 0.75) a.barColor = RED;
        if ((this.sparkT -= dt) <= 0) { this.sparkT = 0.1; w.fx.sparks(a.x + a.dir * 8, a.y - a.h * 0.35, a.color); }
        if (a.bar >= 1) { a.jitter = 1; this.next(); }
        break;
      case 1:
        if (this.pt > 0.5) {
          a.jitter = 0;
          a.bar = -1;
          a.barColor = this.color;
          w.fx.papers(a.x, a.top + 2);
          a.setPose('shock', true);
          a.hop(70);
          a.talk("where's my ctx??", 1.9);
          w.sfx('oops', a.x, 0.45);
          this.next();
        }
        break;
      case 2:
        if (this.pt > 0.8) { a.setPose('look', true); a.showIcon('sweat', 1.8); this.next(); }
        break;
      case 3:
        if ((this.lookT -= dt) <= 0) { this.lookT = 0.45; a.flip = !a.flip; }
        if (this.pt > 1.8) {
          a.setPose('idle');
          a.talk('/compact', 1.2);
          w.fx.poof(a.x, a.y - a.h / 2);
          w.sfx('poof', a.x, 0.4);
          this.next();
        }
        break;
      case 4:
        if (this.pt > 1.3) { a.talk('ok where was i', 1.4); a.hop(40); this.next(); }
        break;
      default:
        if (this.pt > 1.4) this.end();
    }
  }

  protected override cleanup(): void {
    const a = this.actors[0];
    a.barColor = this.color;
    a.jitter = 0;
  }
}

export const ctxOverflow: SkitDef = {
  name: 'context-overflow', weight: 2.5, cooldown: 40, timeout: 13,
  cast: w => w.pick(1, true, a => a.id !== 'kimi' || w.srng.chance(0.3)),
  make: (w, a) => new CtxOverflow('context-overflow', w, a),
};
