// Asleep at the desk: an agent that has been working a while nods off over
// its keyboard (the monitor drifts into a screensaver), snores, until Orca
// pings — or one of its own sub-agents pokes it — and it jolts awake.
import type { Agent } from '../agent';
import type { TextLayer, TextStyle } from '../../types';
import { STATION } from '../../sprites/art/stations';
import { Skit, type SkitDef } from '../skit';

const SAVER: TextStyle = { size: 4, color: '#8fdcff', alpha: 0.8, shadow: null, glow: null };

class DeskNap extends Skit {
  private dur = 4;
  private snoreT = 0.6;
  private poker: Agent | null = null;

  protected override begin(): void {
    const a = this.actors[0];
    a.sleeping = true;
    a.bar = a.pausedBar;
    this.dur = this.w.srng.range(3.5, 5);
    a.talk(this.w.srng.pick(['*nods*', 'just... one...', 'zz']), 1);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w, o = w.orca;
    switch (this.phase) {
      case 0:
        if ((this.snoreT -= dt) <= 0) { this.snoreT = 1.7; w.sfx('snore', a.x, 0.3, true); }
        if (this.pt > this.dur) {
          // one of its own sub-agents, if any is around, hops over to poke it; otherwise Orca pings
          const subs = a.job?.subs ?? [];
          this.poker = subs.find(s => w.has(s) && s.atDesk && s.desk === a.desk) ?? null;
          if (this.poker) { this.poker.hop(70); this.poker.showIcon('bang', 0.7); this.poker.talk('psst!', 0.8); w.sfx('blip', this.poker.x, 0.35); }
          else { o.face(a.x); o.ping(0.45); }
          this.next();
        }
        break;
      case 1:
        if (this.pt > 0.5) {
          a.sleeping = false;
          a.setPose('shock', true);
          a.hop(110);
          a.showIcon('bang', 1);
          w.fx.glint(a.x, a.top, '#ffffff', 6);
          w.sfx('startle', a.x, 0.5);
          this.next();
        }
        break;
      case 2:
        if (this.pt > 0.9) {
          a.setPose('work', true);
          a.talk(w.srng.pick(["wasn't asleep", 'compiling!', 'resting my eyes', 'i was thinking']), 1.4);
          this.next();
        }
        break;
      default:
        if (this.pt > 1.2) this.end();
    }
  }

  override renderText(t: TextLayer): void {
    const d = this.actors[0].desk;
    if (!d || this.phase > 0 || this.pt < 0.8) return;
    // the monitor drifts into a screensaver
    const k = (this.t * 0.6) % 1;
    SAVER.alpha = 0.85 * (1 - k);
    t.draw('z', d.cx - 2 + k * 5, d.by - STATION.h + 8 - k * 7, SAVER);
  }
}

export const deskNap: SkitDef = {
  name: 'desk-nap', weight: 2.4, cooldown: 35, timeout: 12,
  cast: w => {
    const c = w.seatedWorkers(false, a => a.workT > 3 && a.bar < 0.9);
    return c.length ? [c[w.srng.int(0, c.length - 1)]] : null;
  },
  make: (w, a) => new DeskNap('desk-nap', w, a),
};
