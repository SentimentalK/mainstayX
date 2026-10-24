// Summon sub-agents: Claude claps, *poof*, 2–3 mini Clawds scatter to do
// jobs in different directions, then run back and merge with a poof.
import type { Agent } from '../agent';
import { randomSpot } from '../layout';
import { Skit, type SkitDef } from '../skit';

const enum M { Go, Work, Done, Back, Gone }

class Summon extends Skit {
  private minis: Agent[] = [];
  private st: M[] = [];
  private mt: number[] = [];
  private spark: number[] = [];

  protected override begin(): void {
    const a = this.actors[0];
    a.face(160);
    a.setPose('wave', true);
    a.talk('need hands!', 1.3);
  }

  step(dt: number): void {
    const a = this.actors[0], w = this.w, r = w.srng;
    switch (this.phase) {
      case 0:
        if (this.pt > 1.2) {
          const n = r.int(2, 3);
          const base = r.range(0, Math.PI * 2);
          const spot = { x: 0, y: 0 };
          for (let i = 0; i < n; i++) {
            const m = w.spawnMini(a.x + (i - (n - 1) / 2) * 6, Math.min(172, a.y + 1));
            if (!m) break;
            m.lock(this);
            const ang = base + (i / n) * Math.PI * 2;
            randomSpot(r, a.x + Math.cos(ang) * 75, a.y + Math.sin(ang) * 36, 14, m.halfW, spot);
            m.goTo(spot.x, spot.y, true);
            m.talk(['k!', 'on it', 'wip'][i], 0.9);
            this.minis.push(m); this.st.push(M.Go); this.mt.push(0); this.spark.push(0);
          }
          w.fx.poof(a.x, a.y - a.h / 2);
          w.sfx('poof', a.x, 0.5);
          a.setPose('idle');
          a.talk('go go go!', 1.2);
          this.next();
        }
        break;
      case 1: {
        let alive = 0;
        for (let i = 0; i < this.minis.length; i++) {
          const m = this.minis[i];
          if (this.st[i] === M.Gone) continue;
          alive++;
          this.mt[i] += dt;
          switch (this.st[i]) {
            case M.Go:
              if (!m.moving || this.mt[i] > 5) { m.stop(); m.setPose('work'); m.bar = 0; this.st[i] = M.Work; this.mt[i] = 0; }
              break;
            case M.Work:
              m.bar = Math.min(1, m.bar + dt / 2.2);
              if ((this.spark[i] -= dt) <= 0) { this.spark[i] = 0.2; w.fx.sparks(m.x + m.dir * 4, m.y - 4); }
              if (m.bar >= 1) { m.bar = -1; m.setPose('idle'); m.showIcon('check', 0.8); this.st[i] = M.Done; this.mt[i] = 0; }
              break;
            case M.Done:
              if (this.mt[i] > 0.6) { m.goTo(a.x + (i - 1) * 3, a.y, true); this.st[i] = M.Back; this.mt[i] = 0; }
              break;
            case M.Back:
              if (m.dist(a.x, a.y) < 8 || !m.moving || this.mt[i] > 5) {
                w.fx.poof(m.x, m.y - 4);
                w.sfx('poof', m.x, 0.35);
                w.removeMini(m);
                this.st[i] = M.Gone;
              }
              break;
          }
        }
        // Claude supervises: glances at whoever is busy
        if (this.pt % 1.2 < dt && this.minis.length) a.face(this.minis[r.int(0, this.minis.length - 1)].x);
        if (alive === 0 || this.pt > 13) {
          a.hop(80);
          a.talk('ship it!', 1.4);
          w.fx.confetti(a.x, a.top, 8);
          this.next();
        }
        break;
      }
      default:
        if (this.pt > 1.4) this.end();
    }
  }

  protected override cleanup(): void {
    for (const m of this.minis) {
      if (this.w.minis.indexOf(m) < 0) continue;
      this.w.fx.poof(m.x, m.y - 4);
      this.w.removeMini(m);
    }
    this.minis.length = 0;
  }
}

export const summon: SkitDef = {
  name: 'summon-subagents', weight: 2.5, cooldown: 40, timeout: 22,
  cast: w => (w.minis.length === 0 ? w.pick(1, true, a => a.id === 'clawd') : null),
  make: (w, a) => new Summon('summon-subagents', w, a),
};
