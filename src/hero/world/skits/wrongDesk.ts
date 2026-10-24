// Wrong desk: an idle agent eyes a free seat at another tool's workstation
// ("ooh, free desk"), tries to sit, and the desk flashes red — WRONG IDE —
// and bounces it off. Nobody ever actually sits at another tool's desk.
import type { Agent } from '../agent';
import type { Desk } from '../desks';
import type { TextLayer } from '../../types';
import { AGENTS } from '../../data/agents';
import { STATION } from '../../sprites/art/stations';
import { Skit, type SkitDef } from '../skit';
import type { World } from '../world';

const RED = '#ff3d5a';

class WrongDesk extends Skit {
  private desk: Desk;
  private seat = 0;
  private bubbleT = 0;
  private sx = 0;

  constructor(name: string, w: World, actors: Agent[], desk: Desk, seat: number) {
    super(name, w, actors);
    this.desk = desk;
    this.seat = seat;
  }

  protected override begin(): void {
    const a = this.actors[0], d = this.desk, w = this.w;
    const p = w.desks.seatPos(d, this.seat, { x: 0, y: 0 }, a.small);
    this.sx = p.x;
    a.visiting = d;
    const out = this.seat === 0 ? -1 : 1;
    a.goTo(p.x + out * (a.w / 2 + 6), p.y);
    a.talk(w.srng.pick(['ooh, free desk', 'mind if i...', 'comfy!', 'nice setup']), 1.3);
  }

  protected override cleanup(): void { this.actors[0].visiting = null; }

  step(dt: number): void {
    const a = this.actors[0], d = this.desk, w = this.w, r = w.srng;
    if (d.state !== 'open') { this.end(); return; }
    d.emptyT = 0;
    if (this.bubbleT > 0) this.bubbleT -= dt;
    switch (this.phase) {
      case 0:
        if (!a.moving || this.pt > 5) { a.stop(); a.face(d.cx); this.next(); }
        break;
      case 1:
        if (this.pt > 0.5) {
          // hop toward the seat...
          a.hop(70);
          a.kx = (this.sx - a.x) * 3;
          this.next();
        }
        break;
      case 2: // ...and get bounced
        if (this.pt > 0.22) {
          d.denyT = 1.1;
          d.jig = 0.7;
          this.bubbleT = 1.5;
          a.kx = (a.x < d.cx ? -1 : 1) * 120;
          a.vz = 90; a.z = Math.max(a.z, 0.01);
          a.dizzyT = 1.3;
          a.setPose('shock');
          w.fx.impact(a.x + (a.x < d.cx ? 4 : -4), a.y - a.h * 0.6);
          w.sfx('oops', d.cx, 0.45);
          w.sfx('bump', a.x, 0.4);
          w.shake(0.8, 0.12);
          for (const o of d.seats) if (o && o.atDesk && !o.sub && r.chance(0.7)) { o.talk(r.pick(['taken!', 'ahem', 'own IDE pls']), 1.2); break; }
          this.next();
        }
        break;
      case 3:
        if (this.pt > 1.4) {
          a.setPose('idle');
          a.face(d.cx);
          a.talk(r.pick(['my bad', 'ok ok', 'loyal to my IDE', 'wrong keybinds']), 1.3);
          this.next();
        }
        break;
      case 4:
        if (this.pt > 1) { a.goTo(a.x + (a.x < d.cx ? -16 : 16), a.y + 4); this.next(); }
        break;
      default:
        if (!a.moving || this.pt > 2) this.end();
    }
  }

  override renderText(t: TextLayer): void {
    if (this.bubbleT <= 0) return;
    const d = this.desk;
    t.bubble('WRONG IDE!', d.cx, d.by - d.z - STATION.h - 1, { size: 4.5, color: '#ffffff', bg: RED, border: '#ffffff', alpha: Math.min(1, this.bubbleT / 0.25) });
  }
}

/** Remembered between cast() and make() (cast runs right before make). */
let castDesk: Desk | null = null;
let castSeat = 0;

function cast(w: World): Agent[] | null {
  const free = w.pick(0, true);
  if (!free) return null;
  let best: Agent | null = null, bd = 160;
  for (const a of free) {
    const tool = AGENTS[a.id].tool;
    for (const d of w.desks.list) {
      if (d.state !== 'open' || d.tool === tool || d.held || d.occupants === 0) continue;
      const i = w.desks.sideSeat(d, a.x);
      if (i < 0) continue;
      const dist = a.dist(d.cx, d.by);
      if (dist < bd) { bd = dist; best = a; castDesk = d; castSeat = i; }
    }
  }
  return best ? [best] : null;
}

export const wrongDesk: SkitDef = {
  name: 'wrong-desk', weight: 2, cooldown: 40, timeout: 11,
  cast,
  make: (w, a) => new WrongDesk('wrong-desk', w, a, castDesk!, castSeat),
};
