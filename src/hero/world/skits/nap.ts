// Nap: an agent idle for too long nods off (zzz, snores) until Orca pings
// and it jolts awake.
import { Skit, type SkitDef } from '../skit';

class Nap extends Skit {
  private dur = 4;
  private snoreT = 0.6;

  protected override begin(): void {
    const a = this.actors[0];
    a.sleeping = true;
    this.dur = this.w.srng.range(3.5, 5.5);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w, o = w.orca;
    switch (this.phase) {
      case 0:
        if ((this.snoreT -= dt) <= 0) { this.snoreT = 1.7; w.sfx('snore', a.x, 0.3, true); }
        if (this.pt > this.dur) { o.face(a.x); o.ping(0.45); this.next(); }
        break;
      case 1:
        if (this.pt > 0.5) {
          a.sleeping = false;
          a.setPose('shock', true);
          a.hop(115);
          a.showIcon('bang', 1);
          w.fx.glint(a.x, a.top, '#ffffff', 6);
          w.sfx('startle', a.x, 0.5);
          this.next();
        }
        break;
      case 2:
        if (this.pt > 0.9) {
          a.setPose('idle');
          a.talk(w.srng.pick(["i'm up!", 'not asleep', 'was thinking', 'brb coffee']), 1.4);
          this.next();
        }
        break;
      default:
        if (this.pt > 1.4) this.end();
    }
  }
}

export const nap: SkitDef = {
  name: 'nap', weight: 2.5, cooldown: 35, timeout: 13,
  cast: w => w.pick(1, true, a => a.idleTime > 3.5),
  make: (w, a) => new Nap('nap', w, a),
};
