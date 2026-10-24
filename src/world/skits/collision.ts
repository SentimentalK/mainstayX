// Collision: two agents in a hurry run straight into each other, bounce
// apart, see stars, then apologise.
import { legalize } from '../layout';
import { Skit, type SkitDef } from '../skit';
import type { World } from '../world';

class Collision extends Skit {
  private bumped = false;

  protected override begin(): void {
    const [a, b] = this.actors, r = this.w.srng;
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    legalize(m, a.halfW);
    const s = a.x < b.x ? 1 : -1;
    a.goTo(m.x + s * 10, m.y, true);
    b.goTo(m.x - s * 10, m.y, true);
    a.talk(r.pick(['late!', 'brb!', 'omw']), 1);
    b.showIcon(r.pick(['fire', 'coffee', 'note']), 1.4);
  }

  step(): void {
    const [a, b] = this.actors, w = this.w, r = w.srng;
    switch (this.phase) {
      case 0: {
        const reach = (a.w + b.w) / 2 * 0.72;
        if (Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < 7) {
          this.bumped = true;
          const s = a.x < b.x ? -1 : 1;
          a.stop(); b.stop();
          a.kx = s * 95; b.kx = -s * 95;
          a.hop(70); b.hop(70);
          a.dizzyT = 1.5; b.dizzyT = 1.5;
          a.showIcon(null); b.showIcon(null); a.talk(null); b.talk(null);
          w.fx.impact((a.x + b.x) / 2, Math.min(a.y, b.y) - a.h * 0.6);
          w.sfx('bump', a.x, 0.55);
          w.shake(1.5, 0.18);
          this.next();
        } else if (this.pt > 5 || (!a.moving && !b.moving)) {
          a.talk('oh hi', 1); this.next(3); // missed each other
        }
        break;
      }
      case 1:
        if (this.pt > 1.6) { a.face(b.x); b.face(a.x); a.talk('sorry!', 1.3); this.next(); }
        break;
      case 2:
        if (this.pt > 0.6) { b.talk(r.pick(['sorry!', 'my bad', 'np :)']), 1.3); this.next(); }
        break;
      default:
        if (this.pt > 1.4) this.end();
    }
  }

  get didBump(): boolean { return this.bumped; }
}

function cast(w: World) {
  const c = w.pick(0, true);
  if (!c || c.length < 2) return null;
  for (let i = 0; i < c.length; i++)
    for (let j = i + 1; j < c.length; j++)
      if (Math.abs(c[i].x - c[j].x) > 60 && Math.abs(c[i].x - c[j].x) < 220) return [c[i], c[j]];
  return null;
}

export const collision: SkitDef = {
  name: 'collision', weight: 3, cooldown: 35, timeout: 13,
  cast,
  make: (w, a) => new Collision('collision', w, a),
};
