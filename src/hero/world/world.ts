// The agent world: owns the backdrop, Orca, agents (+ summoned sub-agents),
// portable desks, jobs, links/packets, fx, the skit scheduler and Orca's
// dispatch loop. Also does hover / click, depth sorting, rate-limited sfx and
// (with ?debug=1) a once-a-second invariant audit.
import type { CharacterId, Gfx, PointerState, Rng, SceneContext, SfxName, TextStyle } from '../types';
import { W } from '../types';
import { PAL } from '../data/theme';
import { AGENTS, openAgent } from '../data/agents';
import { line } from '../engine/draw';
import { Agent } from './agent';
import { audit } from './audit';
import { Backdrop } from './backdrop';
import { Desks } from './desks';
import { Fx } from './fx';
import { Jobs, MAX_SUBS, type Job, type JobSize } from './jobs';
import { Links } from './links';
import { ORCA_Y } from './layout';
import { Orca } from './orca';
import { ROSTER } from './roster';
import { Scheduler } from './scheduler';
import { SKITS } from './skits';

/** Jobs running at once, and how many of them may be large. */
const MAX_JOBS = 3;
const MAX_LARGE = 1;
/** Agents offline at once. */
const MAX_OFFLINE = 2;

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
  /** Summoned sub-agents (some may still be hidden, about to poof in). */
  readonly subs: Agent[] = [];
  readonly desks: Desks;
  readonly jobs: Jobs;
  readonly scheduler: Scheduler;
  time = 0;
  dispatches = 0;
  /** Jobs handed out per size. */
  readonly sizes: Record<JobSize, number> = { S: 0, M: 0, L: 0 };
  /** Audit violations seen so far (debug). */
  violations = 0;

  private sorted: Agent[] = [];
  private labelStyle: TextStyle = { size: 4, color: PAL.neonA, glow: null, alpha: 0.6, shadow: '#0d0221' };
  private hovered: Agent | Orca | null = null;
  private dispatchIn: number;
  private drng: Rng;
  private tokens = 3;
  private lastSfx: Partial<Record<SfxName, number>> = {};
  private auditT = 0;

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
    this.desks = new Desks(this);
    this.jobs = new Jobs(this);
    for (const id of ROSTER) {
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

  /** Agents (optionally sub-agents too) sitting at their desk working, free to be pulled into a skit. */
  seatedWorkers(subs: boolean, ok?: (a: Agent) => boolean): Agent[] {
    const out: Agent[] = [];
    for (const a of this.agents) if (a.atDesk && !a.hovered && (!ok || ok(a))) out.push(a);
    if (subs) for (const a of this.subs) if (a.atDesk && a.hidden <= 0 && !a.hovered && (!ok || ok(a))) out.push(a);
    return out;
  }

  /** Is this agent still in the world (main agents always are; sub-agents until they poof out)? */
  has(a: Agent): boolean { return !a.sub || this.subs.indexOf(a) >= 0; }

  /** A sub-agent for `summoner`'s job; hidden for `delay` s, then it poofs in. */
  spawnSub(id: CharacterId, x: number, y: number, summoner: Agent, job: Job, delay: number): Agent | null {
    if (this.subs.length >= MAX_SUBS) return null;
    const m = new Agent(id, this, x, y, true);
    m.initSub(summoner, job, delay);
    this.subs.push(m);
    this.sorted.push(m);
    return m;
  }

  /** Remove a sub-agent (poof: with a puff of smoke). Frees its seat. */
  removeSub(m: Agent, poof: boolean): void {
    const i = this.subs.indexOf(m);
    if (i < 0) return;
    if (poof && m.hidden <= 0) {
      this.fx.poof(m.x, m.y - 4);
      this.sfx('poof', m.x, 0.3, true, 3);
    }
    this.desks.leave(m);
    this.subs.splice(i, 1);
    const j = this.sorted.indexOf(m);
    if (j >= 0) this.sorted.splice(j, 1);
    this.links.forget(m);
    if (this.hovered === m) this.setHover(null);
  }

  /** May this idle agent drift offline now? (rare, never too many at once) */
  mayGoOffline(a: Agent): boolean {
    if (a.sub || a.idleTime < 7 || this.scheduler.exclusive) return false;
    let n = 0;
    for (const b of this.agents) if (b.offline) n++;
    return n < MAX_OFFLINE && this.rng.chance(n === 0 ? 0.1 : 0.04);
  }

  /** Rate-limited, panned sfx. low = may be dropped first (typing, hover). detune in semitones. */
  sfx(name: SfxName, x: number, vol = 0.5, low = false, detune = 0): void {
    if (this.silent) return;
    const gap = name === 'type' ? 0.34 : 0.12;
    const last = this.lastSfx[name];
    if (last !== undefined && this.time - last < gap) return;
    if (this.tokens < (low ? 2 : 1)) return;
    this.tokens -= 1;
    this.lastSfx[name] = this.time;
    const pan = Math.max(-0.9, Math.min(0.9, (x / W) * 2 - 1));
    this.ctx.audio.sfx(name, detune ? { volume: vol, pan, detune } : { volume: vol, pan });
  }

  shake(a: number, d: number): void { if (!this.silent) this.ctx.shake(a, d); }

  /** True while pre-rolling: no sound, no screen shake. */
  private silent = false;

  /** Fast-forward `seconds` of simulation off-screen, so every visit opens mid-action. */
  preroll(seconds: number, step: number): void {
    this.silent = true;
    for (let t = 0; t < seconds; t += step) this.update(step);
    this.silent = false;
  }

  // ------------------------------------------------------------ Orca's task loop

  dispatch(a: Agent, size: JobSize): void {
    const job = this.jobs.create(a, size);
    a.awaitTask(job);
    this.orca.face(a.x);
    this.dispatches++;
    this.sizes[size]++;
    this.sfx('dispatch', this.orca.x, 0.35, false, size === 'L' ? -5 : size === 'M' ? -2 : 0);
    if (size === 'L') { this.orca.call(1); this.orca.talk(this.drng.pick(['fan out!', 'all pods!', '*click* big one']), 1.2); }
    this.links.send('task', this.orca, a, { sfx: 'deliver', size: job.big, onArrive: () => a.receiveTask() });
  }

  /** Can `a` take a job now? offline ones only when asked (`sleepers`). */
  private dispatchable(a: Agent, sleepers: boolean): boolean {
    if (a.hovered || a.owner || a.job) return false;
    if (a.offline) return sleepers;
    return a.free(true) && a.idleTime >= 0.8;
  }

  /** Job size for `a`: mostly small; large ones only for agents who can summon help, one at a time. */
  private pickSize(a: Agent): JobSize {
    const r = this.drng.next(), helpers = AGENTS[a.id].summons.length > 0;
    const roomL = helpers && this.jobs.active('L') < MAX_LARGE && this.subs.length <= MAX_SUBS - 6;
    if (r < 0.18 && roomL) return 'L';
    if (r < 0.48 && (!helpers || this.subs.length <= MAX_SUBS - 2)) return 'M';
    return 'S';
  }

  private runDispatcher(dt: number): void {
    if (this.scheduler.exclusive) return;
    if ((this.dispatchIn -= dt) > 0) return;
    this.dispatchIn = this.drng.range(2.5, 5);
    if (this.jobs.active() >= MAX_JOBS) return;
    let best: Agent | null = null, bestScore = -1;
    // Orca only wakes a sleeper when nobody else is around
    for (let pass = 0; pass < 2 && !best; pass++) {
      for (const a of this.agents) {
        if (!this.dispatchable(a, pass === 1)) continue;
        const score = (a.offline ? 1 : a.idleTime) * this.drng.range(0.4, 1);
        if (score > bestScore) { best = a; bestScore = score; }
      }
    }
    if (best) this.dispatch(best, this.pickSize(best));
  }

  /** Test hook: hand a job of `size` to `id` (or to a random agent who can take one, awake first). Returns the agent id. */
  forceJob(size: JobSize, id?: CharacterId): CharacterId | null {
    const ok = this.agents.filter(b => (!id || b.id === id) && this.dispatchable(b, true));
    const awake = ok.filter(b => !b.offline);
    const pool = awake.length ? awake : ok;
    if (!pool.length) return null;
    const a = this.drng.pick(pool);
    this.dispatch(a, size);
    return a.id;
  }

  // ------------------------------------------------------------ loop

  update(dt: number): void {
    this.time += dt;
    this.tokens = Math.min(4, this.tokens + dt * 3);
    this.backdrop.update(dt);
    this.orca.update(dt);
    this.runDispatcher(dt);
    this.scheduler.update(dt, this);
    // backwards: a sub-agent may poof out (leave the list) during its update
    for (let i = this.sorted.length - 1; i >= 0; i--) this.sorted[i]?.update(dt);
    this.desks.update(dt);
    this.jobs.update(dt);
    this.links.update(dt);
    this.fx.update(dt);
    this.separate(dt);
    sortByY(this.sorted);
    this.updateHover();
    if (this.ctx.params.debug && (this.auditT += dt) >= 1) {
      this.auditT = 0;
      for (const v of this.audit()) { this.violations++; console.error('[mx audit]', v); }
    }
  }

  /** Invariant check (seats, desks, cast, sub-agent lifetimes). Returns the violations. */
  audit(): string[] { return audit(this); }

  /** Pinned in place: seated (or walking to a seat), or not on screen yet. */
  private pinned(a: Agent): boolean { return a.hidden > 0 || a.desk !== null; }

  /** Idle agents standing on top of each other (or on a desk) drift apart (skit actors and seated agents are left alone). */
  private separate(dt: number): void {
    const s = this.sorted;
    for (let i = 0; i < s.length; i++) {
      const a = s[i];
      // skit actors too: anyone standing still at someone else's desk looks like they took the seat
      if (!a.moving && !this.pinned(a)) this.desks.nudge(a, dt);
      for (let j = i + 1; j < s.length; j++) {
        const b = s[j];
        if ((a.owner && b.owner) || Math.abs(b.y - a.y) > 12 || a.hidden > 0 || b.hidden > 0) continue;
        const dx = b.x - a.x, min = (a.w + b.w) * 0.42;
        if (Math.abs(dx) >= min) continue;
        const dir = dx > 0 || (dx === 0 && i < j) ? 1 : -1, amt = Math.min(min - Math.abs(dx), 18 * dt);
        if (!a.owner && !a.moving && !this.pinned(a)) a.x -= dir * amt;
        if (!b.owner && !b.moving && !this.pinned(b)) b.x += dir * amt;
      }
    }
  }

  private hit(x: number, y: number): Agent | Orca | null {
    for (let i = this.sorted.length - 1; i >= 0; i--) {
      if (this.sorted[i].hidden > 0) continue;
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
    } else if (h.offline) {
      openAgent(h.id);
      h.poke();
      h.talk('huh?', 1);
    } else {
      openAgent(h.id);
      h.hop(95);
      h.showIcon('heart', 1);
      if (!h.say) h.talk(h.sub ? '!' : 'hi!', 1);
    }
    this.sfx('blip', h.x, 0.5);
  }

  render(g: Gfx): void {
    const c = g.ctx;
    this.backdrop.render(c);
    this.orca.renderFloor(c);
    this.fx.renderRings(c);
    this.links.renderLines(c);
    // sub-agent tethers to their summoner
    if (this.subs.length) {
      c.globalAlpha = 0.28;
      for (const m of this.subs) {
        const s = m.summoner;
        if (m.hidden > 0 || !s) continue;
        line(c, s.hx, s.hy, m.hx, m.hy, PAL.neonB, 1, -this.time * 12);
      }
      c.globalAlpha = 1;
    }
    const active = this.scheduler.active;
    for (const s of active) s.renderFloor(c);
    this.desks.renderFloor(c);

    // depth order: agents, desks and Orca by their feet
    const desks = this.desks.list;
    let orcaDrawn = false, di = 0;
    for (const a of this.sorted) {
      while (di < desks.length && desks[di].by <= a.depth) {
        if (!orcaDrawn && desks[di].by >= ORCA_Y) { this.orca.render(c); orcaDrawn = true; }
        this.desks.render(c, desks[di++]);
      }
      if (!orcaDrawn && a.depth >= ORCA_Y) { this.orca.render(c); orcaDrawn = true; }
      a.render(c);
    }
    for (; di < desks.length; di++) {
      if (!orcaDrawn && desks[di].by >= ORCA_Y) { this.orca.render(c); orcaDrawn = true; }
      this.desks.render(c, desks[di]);
    }
    if (!orcaDrawn) this.orca.render(c);

    for (const s of active) s.renderTop(c);
    this.desks.renderTop(c);
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
    this.desks.renderText(t);
    for (const a of this.sorted) a.renderText(t, !a.sub);
    if (this.orca.say) t.bubble(this.orca.say, this.orca.x + (this.orca.flip ? -12 : 12), this.orca.box.y - 1);
    for (const s of active) s.renderText(t);
  }

  exit(): void {
    this.scheduler.clear();
    this.jobs.clear();
    this.desks.clear();
    this.fx.p.clear();
    this.ctx.setCursor('default');
  }

  debug(): unknown {
    const agents: { id: string; state: string; x: number; y: number; desk: number | null; moving: boolean }[] = [];
    for (const a of [...this.agents, ...this.subs]) {
      agents.push({ id: a.id, state: a.stateLabel(), x: Math.round(a.x), y: Math.round(a.y), desk: a.desk?.id ?? null, moving: a.moving });
    }
    return {
      activeEvents: this.scheduler.active.map(s => s.name),
      eventCounts: { ...this.scheduler.counts },
      agents,
      particles: this.fx.count,
      packets: this.links.inFlight,
      minis: this.subs.length,
      subs: this.subs.length,
      desks: this.desks.debug(),
      jobs: this.jobs.debug(),
      jobSizes: { ...this.sizes },
      violations: this.violations,
      rings: this.fx.ringCount,
      dispatches: this.dispatches,
      time: Math.round(this.time * 10) / 10,
      recent: this.scheduler.log.slice(-6),
    };
  }
}

/** Insertion sort by depth (feet y; nearly sorted every frame → ~O(n), no allocation). */
function sortByY(a: Agent[]): void {
  for (let i = 1; i < a.length; i++) {
    const v = a[i], k = v.depth;
    let j = i - 1;
    while (j >= 0 && a[j].depth > k) { a[j + 1] = a[j]; j--; }
    a[j + 1] = v;
  }
}
