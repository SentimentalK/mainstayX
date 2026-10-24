// Back to work: a working agent sneaks off from its desk toward something
// shiny. Either a free colleague (Claude by preference: the lead) storms over
// and drags it back to its seat by the ear — "ow ow ow" — or Orca shouts
// BACK TO WORK and reels it in on a tether.
import type { Agent } from '../agent';
import { PAL } from '../../data/theme';
import { drawSprite } from '../../sprites/render';
import { line, rgba } from '../../engine/draw';
import { EDGE, FLOOR_BOT, FLOOR_TOP, KEEP, legalize, type Pt } from '../layout';
import { Skit, type SkitDef } from '../skit';
import type { World } from '../world';
import { W } from '../../types';

const LURES = [['coffee', 'coffee...'], ['star', 'shiny...'], ['note', 'tunes!'], ['heart', 'ooh'], ['bug', 'a bug?']] as const;

class EarDrag extends Skit {
  private seat: Pt = { x: 0, y: 0 };
  private lure: Pt = { x: 0, y: 0 };
  private lureIcon = 'coffee';
  private lureLine = 'ooh';
  private showLure = true;
  private gap = 0;
  private hopT = 0;
  private tether = false;

  private get victim(): Agent { return this.actors[0]; }
  private get dragger(): Agent | null { return this.actors[1] ?? null; }

  protected override begin(): void {
    const a = this.victim, w = this.w, r = w.srng;
    a.seatSpot(this.seat);
    const [icon, text] = r.pick(LURES);
    this.lureIcon = icon; this.lureLine = text;
    // somewhere away from Orca, toward the nearer screen edge
    const out = a.x < KEEP.x ? -1 : 1;
    this.lure.x = a.x + out * r.range(40, 60);
    this.lure.y = Math.max(FLOOR_TOP + 6, Math.min(FLOOR_BOT - 4, a.y + r.range(-14, 14)));
    if (this.lure.x < EDGE + 14 || this.lure.x > W - EDGE - 14) this.lure.x = a.x - out * r.range(40, 60);
    legalize(this.lure, 8);
    a.setPose('look', true);
    a.talk(r.pick(['brb...', '*sneaks*', 'just a sec']), 1.1);
    this.gap = a.w / 2 + (this.dragger ? this.dragger.w / 2 : 0) - 3;
  }

  step(dt: number): void {
    const a = this.victim, d = this.dragger, w = this.w, o = w.orca, r = w.srng;
    switch (this.phase) {
      case 0:
        if (this.pt > 0.9) { a.setPose('idle'); a.speedMul = 0.65; a.goTo(this.lure.x - (this.lure.x > a.x ? 6 : -6), this.lure.y); this.next(); }
        break;
      case 1: // tiptoe
        if (!a.moving || this.pt > 4) {
          a.stop(); a.speedMul = 1;
          a.face(this.lure.x);
          a.talk(this.lureLine, 1.1);
          a.hop(40);
          this.next();
        }
        break;
      case 2:
        if (this.pt < 0.8) break;
        if (d) {
          d.showIcon('bang', 0.9);
          d.talk(r.pick(['HEY!', 'oi!', 'excuse me?']), 1);
          d.goTo(a.x + (d.x < a.x ? -1 : 1) * this.gap, a.y, true);
          w.sfx('question', d.x, 0.4);
          this.next(3);
        } else {
          o.face(a.x);
          o.call(1.2);
          o.talk('BACK TO WORK!', 1.6);
          w.sfx('meeting', o.x, 0.45);
          a.setPose('shock', true);
          a.showIcon('bang', 0.8);
          this.next(5);
        }
        break;
      case 3: // the colleague storms over
        if (!d) break;
        if (d.moving && this.pt % 0.3 < dt) d.goTo(a.x + (d.x < a.x ? -1 : 1) * this.gap, a.y, true);
        if (!d.moving || this.pt > 5) {
          d.stop();
          this.showLure = false;
          a.setPose('shock', true);
          a.talk('ow ow ow', 1.8);
          w.sfx('oops', a.x, 0.45);
          d.speedMul = 0.8;
          // stop where the victim (trailing behind) ends up in its seat
          d.goTo(this.seat.x + (this.seat.x > a.x ? this.gap : -this.gap), this.seat.y);
          this.next();
        }
        break;
      case 4: { // dragged by the ear, looking back at the lure
        if (!d) break;
        a.x = d.x - d.dir * this.gap; a.y = d.y; a.z = 0;
        a.face(this.lure.x);
        a.jitter = 0.6;
        if (!d.moving || this.pt > 8) {
          d.stop();
          a.jitter = 0;
          a.setPose('idle');
          d.talk(r.pick(['stay.', 'focus!', 'ship first']), 1.3);
          d.face(a.x);
          this.next(6);
        }
        break;
      }
      case 5: { // Orca reels it in
        this.tether = true;
        this.showLure = this.pt < 0.4;
        const dx = this.seat.x - a.x, dy = this.seat.y - a.y, dist = Math.hypot(dx, dy);
        const s = Math.min(dist, 48 * dt);
        if (dist > 0.5) { a.x += (dx / dist) * s; a.y += (dy / dist) * s; }
        a.face(this.lure.x);
        if ((this.hopT -= dt) <= 0) { this.hopT = 0.35; a.hop(35); w.fx.dust(a.x, a.y, a.x < this.seat.x ? 1 : -1, 2); }
        if (dist < 1 || this.pt > 6) {
          this.tether = false;
          a.setPose('idle');
          a.talk(r.pick(['ok ok', 'fine...', 'rude']), 1.2);
          o.talk('good.', 1);
          this.next(6);
        }
        break;
      }
      case 6:
        if (this.pt > 0.9) { if (d) a.talk('fine...', 1); this.next(); }
        break;
      default:
        if (this.pt > 1) this.end();
    }
  }

  override renderFloor(ctx: CanvasRenderingContext2D): void {
    if (!this.showLure) return;
    const g = (Math.sin(this.t * 6) + 1) / 2;
    const x = Math.round(this.lure.x), y = Math.round(this.lure.y) - Math.round(g * 2);
    ctx.fillStyle = rgba('#ffe259', 0.15 + g * 0.25);
    ctx.fillRect(x - 4, y - 7, 9, 8);
    drawSprite(ctx, 'icon', this.lureIcon, 0, x, y);
  }

  override renderTop(ctx: CanvasRenderingContext2D): void {
    const a = this.victim, d = this.dragger, o = this.w.orca;
    if (this.phase === 4 && d) {
      // hand on ear
      const hx = Math.round(d.x - d.dir * (d.w / 2 - 3)), hy = Math.round(d.y - d.h * 0.55);
      line(ctx, hx, hy, Math.round(a.x + d.dir * 2), Math.round(a.top + 2), d.color);
    }
    if (this.tether) {
      ctx.globalAlpha = 0.8;
      line(ctx, o.hx, o.hy, a.hx, a.hy, PAL.neonA, 2, -this.t * 30);
      ctx.globalAlpha = 1;
    }
  }

  protected override cleanup(): void {
    this.victim.jitter = 0;
    this.tether = false;
  }
}

function cast(w: World): Agent[] | null {
  const victims = w.seatedWorkers(false, a => a.bar < 0.85);
  if (!victims.length) return null;
  const a = victims[w.srng.int(0, victims.length - 1)];
  if (w.srng.chance(0.35)) return [a]; // Orca handles it
  const helpers = w.pick(0, true, b => b !== a && b.dist(a.x, a.y) < 170);
  if (!helpers) return [a];
  const lead = helpers.find(b => b.id === 'clawd');
  return [a, lead ?? helpers[0]];
}

export const earDrag: SkitDef = {
  name: 'back-to-work', weight: 2.4, cooldown: 35, timeout: 18,
  cast,
  make: (w, a) => new EarDrag('back-to-work', w, a),
};
