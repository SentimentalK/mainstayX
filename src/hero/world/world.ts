// The agent world: owns the backdrop, Orca, agents (+ summoned minis),
// links/packets, fx, the skit scheduler and Orca's default dispatch loop.
// Also does hover / click, depth sorting and rate-limited sfx.
import type { CharacterId, Gfx, PointerState, Rng, SceneContext, SfxName, TextStyle } from '../types';
import { W } from '../types';
import { PAL } from '../data/theme';
import { openAgent } from '../data/agents';
import { line } from '../engine/draw';
import { Agent } from './agent';
import { Backdrop } from './backdrop';
import { Fx } from './fx';
import { Links } from './links';
import { ORCA_Y } from './layout';
import { Orca } from './orca';
import { Scheduler } from './scheduler';
import { SKITS } from './skits';

const MAIN: readonly CharacterId[] = ['clawd', 'gemini', 'codex', 'qwen', 'kimi'];
const MAX_MINIS = 3;
const MAX_TASKS = 2;

export class World {
  /** Brain / body randomness. */
  readonly rng: Rng;
  /** Skit randomness. */
  readonly srng: Rng;
  readonly reduced: boolean;
  readonly pointer: PointerState;
  readonly fx: Fx;
  readonly links: Links;
  readonly orca: Orca;
  readonly backdrop: Backdrop;
  readonly agents: Agent[] = [];
  readonly minis: Agent[] = [];
  readonly scheduler: Scheduler;
  time = 0;
  dispatches = 0;

  private sorted: Agent[] = [];
  private labelStyle: TextStyle = { size: 4, color: PAL.neonA, glow: null, alpha: 0.6, shadow: '#0d0221' };
  private hovered: Agent | Orca | null = null;
  private dispatchIn: number;
  private drng: Rng;
  private tokens = 3;
  private lastSfx: Partial<Record<SfxName, number>> = {};

  constructor(readonly ctx: SceneContext) {
    const root = ctx.rng;
    this.rng = root.fork(1);
    this.srng = root.fork(2);
    this.drng = root.fork(3);
    this.reduced = ctx.reducedMotion;
    this.pointer = ctx.pointer;
    this.fx = new Fx(root.fork(4), this.reduced);
    this.backdrop = new Backdrop(root.fork(5), this.reduced, ctx.pointer);
    this.orca = new Orca(root.fork(6), this.fx, this.reduced, (n, x, v) => this.sfx(n, x, v));
    this.links = new Links(this.orca, this.fx, (n, x, v) => this.sfx(n, x, v ?? 0.4));
    for (const id of MAIN) {
      const a = new Agent(id, this);
      this.agents.push(a);
      this.links.addHub(a);
      this.sorted.push(a);
    }
    this.scheduler = new Scheduler(SKITS, root.fork(7));
    this.dispatchIn = 1.2;
  }

  // ------------------------------------------------------------ helpers for skits

  agent(id: CharacterId): Agent | undefined {
    for (const a of this.agents) if (a.id === id) return a;
    return undefined;
  }

  /** n random free agents (see Agent.free), or null if not enough. n <= 0 → all free ones (≥1). */
  pick(n: number, strict = true, ok?: (a: Agent) => boolean): Agent[] | null {
    const c: Agent[] = [];
    for (const a of this.agents) if (a.free(strict) && !a.hovered && (!ok || ok(a))) c.push(a);
    if (c.length < Math.max(1, n)) return null;
    if (n <= 0) n = c.length;
    for (let i = c.length - 1; i > 0; i--) {
      const j = this.srng.int(0, i);
      const t = c[i]; c[i] = c[j]; c[j] = t;
    }
    c.length = n;
    return c;
  }

  spawnMini(x: number, y: number): Agent | null {
    if (this.minis.length >= MAX_MINIS) return null;
    const m = new Agent('mini', this, x, y);
    this.minis.push(m);
    this.sorted.push(m);
    return m;
  }

  removeMini(m: Agent): void {
    const i = this.minis.indexOf(m);
    if (i < 0) return;
    this.minis.splice(i, 1);
    const j = this.sorted.indexOf(m);
    if (j >= 0) this.sorted.splice(j, 1);
    this.links.forget(m);
    if (this.hovered === m) this.setHover(null);
  }

  /** Rate-limited, panned sfx. low = may be dropped first (typing, hover). */
  sfx(name: SfxName, x: number, vol = 0.5, low = false): void {
    const gap = name === 'type' ? 0.34 : 0.12;
    const last = this.lastSfx[name];
    if (last !== undefined && this.time - last < gap) return;
    if (this.tokens < (low ? 2 : 1)) return;
    this.tokens -= 1;
    this.lastSfx[name] = this.time;
    const pan = Math.max(-0.9, Math.min(0.9, (x / W) * 2 - 1));
    this.ctx.audio.sfx(name, { volume: vol, pan });
  }

  shake(a: number, d: number): void { this.ctx.shake(a, d); }

  // ------------------------------------------------------------ Orca's task loop

  dispatch(a: Agent): void {
    a.awaitTask();
    this.orca.face(a.x);
    this.dispatches++;
    this.sfx('dispatch', this.orca.x, 0.35);
    this.links.send('task', this.orca, a, { sfx: 'deliver', onArrive: () => a.receiveTask() });
  }

  private runDispatcher(dt: number): void {
    if (this.scheduler.exclusive) return;
    if ((this.dispatchIn -= dt) > 0) return;
    this.dispatchIn = this.drng.range(2.5, 5);
    let busy = 0;
    for (const a of this.agents) if (!a.owner && a.brain !== 'idle' && a.brain !== 'wander') busy++;
    if (busy >= MAX_TASKS) return;
    let best: Agent | null = null, bestScore = -1;
    for (const a of this.agents) {
      if (!a.free(true) || a.hovered || a.idleTime < 0.8) continue;
      const score = a.idleTime * this.drng.range(0.4, 1);
      if (score > bestScore) { best = a; bestScore = score; }
    }
    if (best) this.dispatch(best);
  }

  // ------------------------------------------------------------ loop

  update(dt: number): void {
    this.time += dt;
    this.tokens = Math.min(4, this.tokens + dt * 3);
    this.backdrop.update(dt);
    this.orca.update(dt);
    this.runDispatcher(dt);
    this.scheduler.update(dt, this);
    for (let i = 0; i < this.sorted.length; i++) this.sorted[i].update(dt);
    this.links.update(dt);
    this.fx.update(dt);
    this.separate(dt);
    sortByY(this.sorted);
    this.updateHover();
  }

  /** Idle agents standing on top of each other drift apart (skit actors are left alone). */
  private separate(dt: number): void {
    const s = this.sorted;
    for (let i = 0; i < s.length; i++) {
      const a = s[i];
      for (let j = i + 1; j < s.length; j++) {
        const b = s[j];
        if ((a.owner && b.owner) || Math.abs(b.y - a.y) > 12) continue;
        const dx = b.x - a.x, min = (a.w + b.w) * 0.42;
        if (Math.abs(dx) >= min) continue;
        const dir = dx > 0 || (dx === 0 && i < j) ? 1 : -1, amt = Math.min(min - Math.abs(dx), 18 * dt);
        if (!a.owner && !a.moving) a.x -= dir * amt;
        if (!b.owner && !b.moving) b.x += dir * amt;
      }
    }
  }

  private hit(x: number, y: number): Agent | Orca | null {
    for (let i = this.sorted.length - 1; i >= 0; i--) {
      const b = this.sorted[i].box;
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return this.sorted[i];
    }
    const o = this.orca.box;
    if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return this.orca;
    return null;
  }

  private updateHover(): void {
    const p = this.pointer;
    this.setHover(p.inside ? this.hit(p.x, p.y) : null);
  }

  private setHover(h: Agent | Orca | null): void {
    if (h === this.hovered) return;
    if (this.hovered) this.hovered.hovered = false;
    this.hovered = h;
    if (h) {
      h.hovered = true;
      this.sfx('hover', h.x, 0.2, true);
    }
    this.ctx.setCursor(h ? 'pointer' : 'default');
  }

  pointerDown(x: number, y: number): void {
    const h = this.hit(x, y);
    if (!h) return;
    if (h instanceof Orca) {
      openAgent('orca');
      h.hop();
      h.talk('hi!', 1.2);
    } else {
      openAgent(h.mini ? 'mini' : h.id);
      h.hop(95);
      h.showIcon('heart', 1);
      if (!h.say) h.talk(h.mini ? '!' : 'hi!', 1);
    }
    this.sfx('blip', h.x, 0.5);
  }

  render(g: Gfx): void {
    const c = g.ctx;
    this.backdrop.render(c);
    this.orca.renderFloor(c);
    this.fx.renderRings(c);
    this.links.renderLines(c);
    const claude = this.agents[0];
    if (this.minis.length) {
      c.globalAlpha = 0.35;
      for (const m of this.minis) line(c, claude.hx, claude.hy, m.hx, m.hy, PAL.neonB, 1, -this.time * 12);
      c.globalAlpha = 1;
    }
    const active = this.scheduler.active;
    for (const s of active) s.renderFloor(c);

    let orcaDrawn = false;
    for (const a of this.sorted) {
      if (!orcaDrawn && a.y >= ORCA_Y) { this.orca.render(c); orcaDrawn = true; }
      a.render(c);
    }
    if (!orcaDrawn) this.orca.render(c);

    for (const s of active) s.renderTop(c);
    this.links.renderPackets(c);
    this.fx.render(c);
    for (const a of this.sorted) a.renderOverlay(c);

    // ---- text layer (always on top)
    const t = g.text, oh = this.orca.hovered;
    let covered = false;
    for (const a of this.sorted) {
      const b = a.box;
      if (a.y > ORCA_Y && b.x < 192 && b.x + b.w > 128 && b.y < ORCA_Y + 17 && b.y + b.h > ORCA_Y + 10) covered = true;
    }
    const st = this.labelStyle;
    st.size = oh ? 4.5 : 4; st.color = oh ? '#ffffff' : PAL.neonA; st.glow = oh ? PAL.neonA : null;
    st.alpha = oh ? 1 : covered ? 0.12 : 0.6;
    t.draw('ORCA · DISPATCH', this.orca.x, ORCA_Y + 13, st);
    for (const a of this.sorted) a.renderText(t, !a.mini);
    if (this.orca.say) t.bubble(this.orca.say, this.orca.x + (this.orca.flip ? -12 : 12), this.orca.box.y - 1);
    for (const s of active) s.renderText(t);
  }

  exit(): void {
    this.scheduler.clear();
    this.fx.p.clear();
    this.ctx.setCursor('default');
  }

  debug(): unknown {
    const agents: { id: string; state: string; x: number; y: number }[] = [];
    for (const a of this.agents) agents.push({ id: a.id, state: a.stateLabel(), x: Math.round(a.x), y: Math.round(a.y) });
    for (const m of this.minis) agents.push({ id: m.id, state: m.stateLabel(), x: Math.round(m.x), y: Math.round(m.y) });
    return {
      activeEvents: this.scheduler.active.map(s => s.name),
      eventCounts: { ...this.scheduler.counts },
      agents,
      particles: this.fx.count,
      packets: this.links.inFlight,
      minis: this.minis.length,
      rings: this.fx.ringCount,
      dispatches: this.dispatches,
      time: Math.round(this.time * 10) / 10,
      recent: this.scheduler.log.slice(-6),
    };
  }
}

/** Insertion sort by feet y (nearly sorted every frame → ~O(n), no allocation). */
function sortByY(a: Agent[]): void {
  for (let i = 1; i < a.length; i++) {
    const v = a[i];
    let j = i - 1;
    while (j >= 0 && a[j].y > v.y) { a[j + 1] = a[j]; j--; }
    a[j + 1] = v;
  }
}
