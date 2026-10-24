// Celebration: task done! The agent jumps up and down under pixel confetti.
import { Skit, type SkitDef } from '../skit';

class Celebrate extends Skit {
  private jumps = 0;
  private jt = 0.3;

  protected override begin(): void {
    const a = this.actors[0], r = this.w.srng;
    a.face(this.w.orca.x);
    a.talk(r.pick(['ship it!', 'tests pass!', 'it works!', '>_ done', 'green CI!']), 1.8);
    this.w.sfx('cheer', a.x, 0.5);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w;
    if (this.phase === 0) {
      if ((this.jt -= dt) <= 0 && a.z <= 0.01) {
        if (this.jumps++ >= 4) { a.setPose('wave', true); this.next(); return; }
        this.jt = 0.08;
        a.hop(100);
        a.flip = this.jumps % 2 === 0 ? !a.flip : a.flip;
        w.fx.confetti(a.x, a.top - 2, 9);
      }
    } else if (this.pt > 1) this.end();
  }
}

export const celebrate: SkitDef = {
  name: 'celebration', weight: 3, cooldown: 25, timeout: 9,
  cast: w => w.pick(1, true),
  make: (w, a) => new Celebrate('celebration', w, a),
};
