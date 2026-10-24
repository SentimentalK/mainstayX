// Swarm chaos: during a big job one sub-agent spots something ("a bug!"),
// and the whole swarm abandons its desks, zooming around in circles and
// bonking into each other, until the summoner (or Orca) yells SIT DOWN and
// they scurry back to their seats.
import type { Agent } from '../agent';
import { PAL } from '../../data/theme';
import { randomSpot, type Pt } from '../layout';
import { Skit, type SkitDef } from '../skit';
import type { World } from '../world';

const ICONS = ['q', 'fire', 'bug', 'bang', 'star', 'sweat'] as const;

class Swarm extends Skit {
  private lead: Agent | null = null;
  private subs: Agent[] = [];
  private center: Pt = { x: 0, y: 0 };
  private retarget: number[] = [];
  private bonkT = 0;
  private spot: Pt = { x: 0, y: 0 };

  protected override begin(): void {
    const w = this.w;
    for (const a of this.actors) if (a.sub) this.subs.push(a); else this.lead = a;
    let x = 0, y = 0;
    for (const s of this.subs) { x += s.x; y += s.y; this.retarget.push(0); }
    this.center.x = x / this.subs.length; this.center.y = y / this.subs.length;
    const first = this.subs[0];
    first.hop(80);
    first.showIcon('bang', 0.8);
    first.talk(w.srng.pick(['a bug!', 'pizza?!', 'race!', 'merge!!', 'squirrel']), 1);
    w.sfx('question', first.x, 0.4);
  }

  private alive(s: Agent): boolean { return this.w.has(s); }

  step(dt: number): void {
    const w = this.w, r = w.srng, l = this.lead, o = w.orca;
    switch (this.phase) {
      case 0:
        if (this.pt > 0.6) {
          if (l) { l.setPose('shock', true); l.talk('uh...', 1); }
          this.next();
        }
        break;
      case 1: { // chaos
        for (let i = 0; i < this.subs.length; i++) {
          const s = this.subs[i];
          if (!this.alive(s)) continue;
          if ((this.retarget[i] -= dt) <= 0) {
            this.retarget[i] = r.range(0.3, 0.7);
            randomSpot(r, this.center.x, this.center.y, 46, s.halfW, this.spot);
            s.goTo(this.spot.x, this.spot.y, true);
            if (r.chance(0.15)) s.showIcon(r.pick(ICONS), 0.6);
          }
        }
        // bonks
        if ((this.bonkT -= dt) <= 0) {
          for (let i = 0; i < this.subs.length && this.bonkT <= 0; i++) {
            const a = this.subs[i];
            if (!this.alive(a) || a.dizzyT > 0) continue;
            for (let j = i + 1; j < this.subs.length; j++) {
              const b = this.subs[j];
              if (!this.alive(b) || b.dizzyT > 0 || Math.abs(a.x - b.x) > 5 || Math.abs(a.y - b.y) > 3) continue;
              a.hop(60); b.hop(60);
              a.dizzyT = 0.7; b.dizzyT = 0.7;
              a.kx = (a.x < b.x ? -1 : 1) * 50; b.kx = -a.kx;
              w.fx.impact((a.x + b.x) / 2, a.y - 5);
              w.sfx('bump', a.x, 0.35, true);
              this.bonkT = 0.35;
              break;
            }
          }
        }
        if (l && this.pt > 1.4) l.setPose('look', true);
        if (this.pt > 3.2) {
          if (l) {
            l.setPose('idle');
            l.hop(95);
            l.talk('SIT DOWN!', 1.5);
            w.fx.ring(l.x, l.y, 3, 40, 0.7, PAL.neonA, 0.4);
            w.shake(1, 0.15);
          } else {
            o.call(1.2);
            o.talk('SIT. DOWN.', 1.5);
          }
          w.sfx('meeting', l ? l.x : o.x, 0.45);
          for (const s of this.subs) {
            if (!this.alive(s)) continue;
            s.showIcon(null);
            s.seatSpot(this.spot);
            s.goTo(this.spot.x, this.spot.y, true);
            if (r.chance(0.3)) s.talk(r.pick(['eek', 'sorry!', 'k!']), 0.8);
          }
          this.next();
        }
        break;
      }
      case 2: {
        let moving = false;
        for (const s of this.subs) if (this.alive(s) && s.moving) moving = true;
        if (!moving || this.pt > 4) {
          if (l) { l.talk(r.pick(['better.', 'thank you.', '...']), 1.1); l.setPose('work'); }
          this.next();
        }
        break;
      }
      default:
        if (this.pt > 0.9) this.end();
    }
  }
}

function cast(w: World): Agent[] | null {
  for (const j of w.jobs.list) {
    if (j.done) continue;
    const subs = j.subs.filter(s => w.has(s) && s.atDesk && !s.hovered);
    if (subs.length < 4) continue;
    const out: Agent[] = [];
    if (j.lead.atDesk && !j.lead.hovered) out.push(j.lead);
    return out.concat(subs.slice(0, 10));
  }
  return null;
}

export const swarm: SkitDef = {
  name: 'swarm-chaos', weight: 3, cooldown: 30, timeout: 14,
  cast,
  make: (w, a) => new Swarm('swarm-chaos', w, a),
};
