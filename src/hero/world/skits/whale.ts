// Whale song: DeepSeek, Orca's little cousin, waddles up beside Orca. They
// trade sonar calls (big ring / small ring, faster each round, then in
// harmony), then try a synchronised spout. The little one only manages a
// dribble ("pff..."), tries again, and this time both jets meet in a rainbow.
import { PAL } from '../../data/theme';
import { AGENTS } from '../../data/agents';
import { KEEP, type Pt } from '../layout';
import { Skit, type SkitDef } from '../skit';

const DS = AGENTS.deepseek.color;
const BANDS = [PAL.neonA, PAL.sunTop, '#7cff6b', PAL.neonB] as const;
/** Gap between Orca's call and the cousin's answer, per round (they speed up). */
const GAPS = [0.8, 0.6, 0.45] as const;
const ORCA_SONG = ['ooOOoo', 'oOOo', 'oOo'] as const;
const CUZ_SONG = ['eeEEee', 'eEEe', 'eEe'] as const;
/** Where the cousin swims up to, per flank (feet; outside KEEP, clear of Orca's label). */
const SPOT_DX = 58, SPOT_Y = 124;

class WhaleSong extends Skit {
  private side = 1;
  private spot: Pt = { x: 0, y: 0 };
  private round = 0;
  private answered = false;
  private cheered = false;
  /** Small-spout timer (s left) and its power. */
  private jet = 0;
  private power = 0.4;
  /** Rainbow: 0 = off, else seconds since it started. */
  private bow = 0;

  protected override begin(): void {
    const a = this.actors[0], w = this.w;
    // the flank with fewer neighbours (ties: whichever side we're already on)
    let crowd = 0;
    for (const b of w.agents) {
      if (b === a) continue;
      if (b.dist(KEEP.x - SPOT_DX, SPOT_Y) < 36) crowd--;
      if (b.dist(KEEP.x + SPOT_DX, SPOT_Y) < 36) crowd++;
    }
    this.side = crowd < 0 ? 1 : crowd > 0 ? -1 : a.x < KEEP.x || (a.x === KEEP.x && w.srng.chance(0.5)) ? -1 : 1;
    this.spot.x = KEEP.x + this.side * SPOT_DX; this.spot.y = SPOT_Y;
    a.face(w.orca.x);
    a.hop(85);
    a.talk(w.srng.pick(['cousin!', 'cuz!!', 'hi big cuz']), 1.3);
    a.showIcon('heart', 1.3);
    w.sfx('greet', a.x, 0.4);
  }

  /** The cousin's blowhole (front of the head, a couple of px down from the top). */
  private holeX(): number { const a = this.actors[0]; return a.x + a.dir * 5; }
  private holeY(): number { return this.actors[0].top + 6; }
  private orcaHoleX(): number { const o = this.w.orca; return o.x + (o.flip ? -4 : 4); }
  private orcaHoleY(): number { const o = this.w.orca; return o.y - o.box.h + 2; }

  private orcaSings(i: number): void {
    const o = this.w.orca, a = this.actors[0];
    o.face(a.x);
    o.ping(0.3);
    o.talk(ORCA_SONG[i] ?? 'ooo', 0.9);
  }

  private cuzSings(i: number, big = false): void {
    const a = this.actors[0], w = this.w;
    a.face(w.orca.x);
    w.fx.ring(a.x, a.y, 3, big ? 60 : 38, big ? 1.4 : 1.1, DS, 0.32);
    w.fx.ring(a.hx, a.hy, 2, big ? 22 : 16, 0.6, DS, 1);
    a.talk(CUZ_SONG[i] ?? 'eee', 0.9);
    a.showIcon('note', 0.8);
    a.hop(35);
    w.sfx('ping', a.x, 0.3, false, 7);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w, o = w.orca;
    if (this.jet > 0) {
      this.jet -= dt;
      w.fx.spout(this.holeX(), this.holeY(), this.power);
    }
    if (this.bow > 0) this.bow += dt;
    // once they're together, Orca only has eyes for its cousin (the dispatcher turns it otherwise)
    if (this.phase >= 2) o.face(a.x);

    switch (this.phase) {
      case 0: // excited, then waddle over to Orca's flank
        if (this.pt > 0.7) { a.goTo(this.spot.x, this.spot.y, true); this.next(); }
        break;
      case 1:
        if (!a.moving || this.pt > 6) {
          a.stop(); a.face(o.x); o.face(a.x);
          o.talk('lil cuz!', 1.2);
          o.hop();
          w.sfx('blip', o.x, 0.35);
          this.next();
        }
        break;
      case 2: // call and response, faster every round
        if (this.pt > 0.9) { this.orcaSings(0); this.answered = false; this.round = 0; this.next(); }
        break;
      case 3: {
        const gap = GAPS[this.round];
        if (!this.answered && this.pt > gap) { this.cuzSings(this.round); this.answered = true; }
        if (this.pt > gap * 2 + 0.1) {
          this.round++;
          this.answered = false;
          this.pt = 0;
          if (this.round < GAPS.length) this.orcaSings(this.round);
          else { o.face(a.x); o.ping(0.35); o.talk('ooOOOooo', 1.2); this.next(); }
        }
        break;
      }
      case 4: // harmony: both at once, bigger rings
        if (!this.answered && this.pt > 0.15) { this.cuzSings(0, true); a.talk('eeEEEeee', 1.2); this.answered = true; }
        if (this.pt > 1.5) { o.talk('spout!', 0.9); this.next(); }
        break;
      case 5: // attempt #1: Orca blows a proper jet, the cousin a sad dribble
        if (this.pt > 0.6) {
          o.face(a.x);
          o.blow(true);
          a.face(o.x);
          a.setPose('jump', true);
          this.jet = 0.7; this.power = 0.38;
          w.sfx('spout', a.x, 0.25, false, 5);
          this.next();
        }
        break;
      case 6:
        if (this.pt > 0.8 && a.pose === 'jump') {
          a.setPose('idle');
          a.talk('pff...', 1.2);
          a.showIcon('sweat', 1.3);
          w.sfx('oops', a.x, 0.3);
        }
        if (this.pt > 2.1) {
          a.talk(w.srng.pick(['again!', 'one more!', 'watch this']), 1.1);
          a.hop(70);
          this.next();
        }
        break;
      case 7: // attempt #2: both together → a rainbow joins the jets
        if (this.pt > 0.9) {
          o.face(a.x);
          o.blow(true);
          a.face(o.x);
          a.setPose('wave', true);
          this.jet = 1.2; this.power = 0.8;
          this.bow = 1e-3;
          w.sfx('spout', a.x, 0.35, false, 5);
          this.next();
        }
        break;
      case 8:
        if (this.pt > 0.75 && !this.cheered) {
          this.cheered = true;
          w.sfx('cheer', (a.x + o.x) / 2, 0.45);
          for (let i = 1; i < 4; i++) w.fx.glint(this.arcX(i / 4), this.arcY(i / 4) - 2, '#ffffff', 3);
          o.talk(w.srng.pick(['nice!', 'family!', 'rainbow!']), 1.4);
          a.showIcon('heart', 1.6);
        }
        if (this.pt > 2.6) { a.setPose('idle'); a.talk(':)', 1); this.next(); }
        break;
      default:
        if (this.pt > 1.1) this.end();
    }
  }

  // Rainbow arc from the cousin's blowhole to Orca's, peaking above both.
  private arcX(k: number): number { return this.holeX() + (this.orcaHoleX() - this.holeX()) * k; }
  private arcY(k: number): number {
    // ends near the top of each jet (the cousin's is shorter)
    const y0 = this.holeY() - 11, y1 = this.orcaHoleY() - 18;
    return y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 14;
  }

  override renderTop(ctx: CanvasRenderingContext2D): void {
    const t = this.bow;
    if (t <= 0) return;
    const reveal = Math.min(1, t / 0.7);
    const alpha = t < 2.4 ? 0.85 : Math.max(0, 0.85 * (1 - (t - 2.4) / 0.8));
    if (alpha <= 0) return;
    const n = Math.max(8, Math.round(Math.abs(this.orcaHoleX() - this.holeX()) * 1.4));
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    for (let b = 0; b < BANDS.length; b++) {
      ctx.fillStyle = BANDS[b];
      for (let i = 0, m = Math.round(n * reveal); i <= m; i++) {
        const k = i / n;
        ctx.fillRect(Math.round(this.arcX(k)), Math.round(this.arcY(k)) + b, 1, 1);
      }
    }
    ctx.globalAlpha = prev;
  }

  protected override cleanup(): void {
    this.jet = 0;
    this.bow = 0;
  }
}

export const whaleSong: SkitDef = {
  name: 'whale-song', weight: 2.2, cooldown: 60, timeout: 24,
  cast: w => w.pick(1, true, a => a.id === 'deepseek'),
  make: (w, a) => new WhaleSong('whale-song', w, a),
};
