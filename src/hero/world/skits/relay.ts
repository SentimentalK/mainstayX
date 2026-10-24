// Relay: a packet is passed A → B → C like a ball (arcing over a lit peer
// line), and the last one delivers it to Orca.
import { Skit, type SkitDef } from '../skit';

class Relay extends Skit {
  private caught = 0;

  protected override begin(): void {
    const [a, b, c] = this.actors;
    a.carry = 'task';
    a.face(b.x); b.face(a.x); c.face(b.x);
    a.talk(this.w.srng.pick(['catch!', 'yours!', 'heads up']), 1);
    b.setPose('wave');
  }

  private pass(from: number, to: number): void {
    const w = this.w, f = this.actors[from], t = this.actors[to];
    f.carry = null;
    f.hop(40);
    w.sfx('pass', f.x, 0.45);
    w.links.send('task', f, t, {
      arc: 18 + Math.abs(f.x - t.x) * 0.08, speed: 125, sfx: 'deliver',
      onArrive: () => { t.carry = 'task'; t.hop(55); t.setPose('idle'); this.caught++; },
    });
  }

  step(): void {
    const [a, b, c] = this.actors, w = this.w;
    switch (this.phase) {
      case 0:
        if (this.pt > 0.8) { this.pass(0, 1); c.setPose('wave'); this.next(); }
        break;
      case 1:
        if (this.caught >= 1 || this.pt > 3) { b.carry = 'task'; b.face(c.x); this.next(); }
        break;
      case 2:
        if (this.pt > 0.45) { this.pass(1, 2); this.next(); }
        break;
      case 3:
        if (this.caught >= 2 || this.pt > 3) { c.carry = 'task'; c.talk('got it!', 1); a.talk('nice', 0.9); this.next(); }
        break;
      case 4:
        if (this.pt > 0.8) {
          c.carry = null;
          c.face(w.orca.x);
          c.talk('>_ done', 1.2);
          const o = w.orca;
          w.links.send('result', c, o, { sfx: 'result', onArrive: () => o.flash() });
          this.next();
        }
        break;
      default:
        if (this.pt > 1.2) this.end();
    }
  }
}

export const relay: SkitDef = {
  name: 'relay', weight: 2.5, cooldown: 35, timeout: 14,
  cast: w => {
    const c = w.pick(3, true) ?? w.pick(3, false);
    if (!c) return null;
    c.sort((p, q) => p.x - q.x);
    if (w.srng.chance(0.5)) c.reverse();
    return c;
  },
  make: (w, a) => new Relay('relay', w, a),
};
