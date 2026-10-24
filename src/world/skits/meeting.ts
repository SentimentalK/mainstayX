// Meeting: Orca calls a standup; everyone drops what they're doing, runs over
// and stands in a ring around Orca trading tiny bubbles, then "break!".
import type { Agent } from '../agent';
import { SEATS, type Pt } from '../layout';
import { Skit, type SkitDef } from '../skit';

const TALK: readonly (readonly [kind: 'icon' | 'text', v: string])[] = [
  ['icon', 'chart'], ['text', 'sync?'], ['icon', 'bulb'], ['text', 'lgtm'], ['icon', 'bug'], ['text', 'wip'],
  ['text', 'ship it'], ['icon', 'coffee'], ['text', '+1'], ['icon', 'fire'], ['text', 'blocked'], ['icon', 'heart'],
  ['text', 'eta?'], ['text', 'brb'], ['icon', 'star'], ['text', 'p0?'],
];

class Meeting extends Skit {
  private seats: Pt[] = [];
  private lines = 0;
  private lineT = 0;
  private last: Agent | null = null;

  protected override begin(): void {
    const w = this.w, o = w.orca;
    o.call(2);
    o.talk('standup!', 1.8);
    w.sfx('meeting', o.x, 0.5);
    // greedy nearest free seat
    const used = new Set<number>();
    for (const a of this.actors) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < SEATS.length; i++) {
        if (used.has(i)) continue;
        const d = a.dist(SEATS[i].x, SEATS[i].y);
        if (d < bd) { bd = d; best = i; }
      }
      used.add(best);
      this.seats.push(SEATS[best]);
      a.showIcon('bang', 0.8);
      a.face(o.x);
    }
  }

  step(dt: number): void {
    const w = this.w, o = w.orca, r = w.srng, A = this.actors;
    switch (this.phase) {
      case 0:
        if (this.pt > 0.7) { A.forEach((a, i) => a.goTo(this.seats[i].x, this.seats[i].y, true)); this.next(); }
        break;
      case 1: {
        let moving = false;
        for (const a of A) if (a.moving) moving = true;
        if (!moving || this.pt > 6) { for (const a of A) { a.stop(); a.face(o.x); } this.lines = r.int(5, 7); this.next(); }
        break;
      }
      case 2:
        if ((this.lineT -= dt) <= 0) {
          if (this.lines-- <= 0) { o.talk('break!', 1.2); o.hop(); w.sfx('blip', o.x, 0.4); this.next(); break; }
          this.lineT = 0.8;
          let s = A[r.int(0, A.length - 1)];
          if (s === this.last && A.length > 1) s = A[(A.indexOf(s) + 1) % A.length];
          this.last = s;
          const [kind, v] = r.pick(TALK);
          if (kind === 'icon') s.showIcon(v, 1.1); else s.talk(v, 1.1);
          s.hop(35);
          if (r.chance(0.3)) o.flip = !o.flip; // Orca looks around the room
          w.sfx('blip', s.x, 0.25, true);
        }
        break;
      default:
        if (this.pt > 0.9) this.end();
    }
  }
}

export const meeting: SkitDef = {
  name: 'meeting', weight: 1.6, cooldown: 55, timeout: 24, exclusive: true,
  cast: w => {
    const c = w.pick(0, false);
    return c && c.length >= 3 ? c.slice(0, Math.min(5, c.length)) : null;
  },
  make: (w, a) => new Meeting('meeting', w, a),
};
