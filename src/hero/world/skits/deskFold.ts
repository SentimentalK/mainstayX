// The desk folds up on someone: it creaks, wobbles, then snaps shut into a
// crate mid-keystroke. Everyone sitting there jumps; the owner gives the crate
// a kick, it bounces and springs back open. "unsaved..."
import type { Agent } from '../agent';
import type { Desk } from '../desks';
import { STATION_LOOK } from '../../sprites/art/stations';
import { Skit, type SkitDef } from '../skit';
import type { World } from '../world';

class DeskFold extends Skit {
  private desk: Desk | null = null;

  /** The main agent at the desk if any (it does the kicking), else a sub-agent. */
  private get boss(): Agent { return this.actors[0]; }

  protected override begin(): void {
    const d = (this.desk = this.boss.desk);
    if (!d) { this.end(); return; }
    d.held = this;
    d.jig = 1;
    this.w.sfx('question', d.cx, 0.35, false, -4);
    this.boss.setPose('look', true);
    this.boss.talk(this.w.srng.pick(['...?', 'hm?', 'did it creak?']), 1);
  }

  step(dt: number): void {
    const d = this.desk, w = this.w, r = w.srng, b = this.boss;
    if (!d || d.state !== 'open') { this.end(); return; }
    switch (this.phase) {
      case 0:
        if (this.pt > 0.3 && d.jig < 0.4) d.jig = 0.8;
        if (this.pt > 0.9) this.next();
        break;
      case 1: // snap!
        d.unfold = Math.max(0, d.unfold - dt / 0.18);
        if (d.unfold > 0) break;
        for (const a of this.actors) {
          a.setPose('shock', true);
          a.hop(a.sub ? 60 : 85);
          a.dizzyT = 0.9;
        }
        b.talk(r.pick(['HEY!', 'my code!', 'ctrl+z!!', 'rude']), 1.3);
        w.fx.dust(d.cx - 6, d.by, -1, 4); w.fx.dust(d.cx + 6, d.by, 1, 4);
        w.fx.impact(d.cx, d.by - 6);
        w.sfx('drop', d.cx, 0.5);
        w.shake(1.2, 0.15);
        this.next();
        break;
      case 2:
        if (this.pt > 1.1) {
          for (const a of this.actors) a.setPose('idle');
          b.face(d.cx);
          b.hop(55);
          b.talk(r.pick(['*kick*', 'open up', 'come on']), 1);
          d.vz = 85; d.z = 0.01;
          w.sfx('bump', d.cx, 0.45);
          this.next();
        }
        break;
      case 3: // bounces, then springs back open
        if (this.pt > 0.35 && d.z <= 0) d.unfold = Math.min(1, d.unfold + dt / 0.5);
        if (d.unfold >= 1) {
          w.fx.glint(d.cx, d.by - 18, STATION_LOOK[d.tool].trim, 6);
          w.sfx('blip', d.cx, 0.35);
          b.talk(r.pick(['phew', 'unsaved...', 'where was i', 'flaky hinge']), 1.3);
          this.next();
        }
        break;
      default:
        if (this.pt > 1.2) this.end();
    }
  }

  protected override cleanup(): void {
    const d = this.desk;
    if (!d) return;
    if (d.held === this) d.held = null;
    if (d.state === 'open') d.unfold = 1;
    d.jig = 0;
  }
}

function cast(w: World): Agent[] | null {
  const bosses = w.seatedWorkers(true, a => !!a.desk && !a.desk.held);
  if (!bosses.length) return null;
  // prefer desks with a big agent at them
  const main = bosses.filter(a => !a.sub);
  const pick = (main.length ? main : bosses)[w.srng.int(0, (main.length ? main : bosses).length - 1)];
  const d = pick.desk!;
  const out: Agent[] = [pick];
  for (const a of d.seats) {
    if (!a || a === pick) continue;
    if (!a.atDesk) return null; // someone's mid-walk: try another time
    out.push(a);
  }
  return out;
}

export const deskFold: SkitDef = {
  name: 'desk-fold', weight: 2, cooldown: 45, timeout: 10,
  cast,
  make: (w, a) => new DeskFold('desk-fold', w, a),
};
