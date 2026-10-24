// Code review: one agent walks a PR over to another, who reads it and either
// stamps "lgtm" right away or leaves a nit that has to be fixed first.
import { legalize } from '../layout';
import { Skit, type SkitDef } from '../skit';

class Review extends Skit {
  private got = false;

  protected override begin(): void {
    const [a, b] = this.actors;
    const spot = { x: b.x + (a.x < b.x ? -1 : 1) * ((a.w + b.w) / 2 + 6), y: b.y };
    legalize(spot, a.halfW);
    a.carry = 'task';
    a.goTo(spot.x, spot.y, false);
    a.talk('PR ready', 1.2);
  }

  step(dt: number): void {
    const [a, b] = this.actors, w = this.w, r = w.srng;
    switch (this.phase) {
      case 0:
        if (!a.moving || this.pt > 6) { a.stop(); a.face(b.x); b.face(a.x); a.talk('review?', 1.1); this.next(); }
        break;
      case 1:
        if (this.pt > 0.8) {
          a.carry = null;
          w.links.send('task', a, b, { speed: 50, arc: 5, sfx: 'deliver', onArrive: () => { this.got = true; b.carry = 'open'; } });
          this.next();
        }
        break;
      case 2:
        if (this.got || this.pt > 2) { b.carry = 'open'; b.setPose('look', true); b.talk('hmm...', 1.6); this.next(); }
        break;
      case 3:
        if (this.pt > 1.7) {
          b.setPose('idle');
          if (r.chance(0.65)) this.approve();
          else { b.talk(r.pick(['nit: typo', 'tests?', 'naming...']), 1.4); a.showIcon('sweat', 1.4); w.sfx('question', b.x, 0.35); this.next(6); }
        }
        break;
      case 4:
        if (this.pt > 0.9) {
          a.hop(80);
          a.talk('ship it!', 1.2);
          b.carry = null;
          const o = w.orca;
          w.links.send('result', b, o, { sfx: 'result', onArrive: () => o.flash() });
          this.next();
        }
        break;
      case 5:
        if (this.pt > 1.3) this.end();
        break;
      case 6: // fixing the nit
        if (this.pt > 1.2) { a.setPose('work'); a.bar = 0; a.talk('fixing...', 1.1); this.next(); }
        break;
      case 7:
        a.bar = Math.min(1, a.bar + dt / 1.6);
        if (this.pt % 0.2 < dt) w.fx.sparks(a.x + a.dir * 8, a.y - a.h * 0.35, a.color);
        if (a.bar >= 1) { a.bar = -1; a.setPose('idle'); this.approve(); }
        break;
    }
  }

  private approve(): void {
    const [, b] = this.actors, w = this.w;
    b.setPose('work', true);
    b.hop(45);
    b.talk('lgtm', 1.4);
    b.showIcon('check', 1.4);
    w.fx.glint(b.x + b.dir * 8, b.y - b.h * 0.5, '#7cff6b', 8);
    w.sfx('found', b.x, 0.35);
    this.next(4);
  }
}

export const review: SkitDef = {
  name: 'code-review', weight: 2.5, cooldown: 35, timeout: 16,
  cast: w => {
    const c = w.pick(0, true);
    if (!c || c.length < 2) return null;
    const ci = c.findIndex(a => a.id === 'clawd');
    if (ci > 0) { const t = c[0]; c[0] = c[ci]; c[ci] = t; }
    // reviewer not too far away
    for (let j = 1; j < c.length; j++) if (Math.abs(c[j].x - c[0].x) < 170) return [c[0], c[j]];
    return null;
  },
  make: (w, a) => new Review('code-review', w, a),
};
