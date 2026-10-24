// Jobs Orca hands out. Small: the agent works alone. Medium / large: once it's
// at its desk it summons sub-agents from its profile's `summons` — Claude its
// own minis (Claude Code desks: its own first, then new ones it throws),
// everyone else OpenCode ones (who throw OpenCode desks next to the caller).
// Each sub-agent poofs in, works, sends its result to its summoner and poofs
// out; the summoner then delivers to Orca.
import { AGENTS } from '../data/agents';
import { randomSpot, type Pt } from './layout';
import { plotHalf, type SeatRef } from './desks';
import type { Agent } from './agent';
import type { World } from './world';

export type JobSize = 'S' | 'M' | 'L';

/** Sub-agents alive at once, across all jobs. */
export const MAX_SUBS = 12;
const SUBS: Record<JobSize, readonly [number, number]> = { S: [0, 0], M: [2, 4], L: [6, 10] };
/** The summoner's own share of the work (s). */
export const LEAD_DUR: Record<JobSize, readonly [number, number]> = { S: [3.5, 6], M: [4.5, 7], L: [6, 9] };
export const SUB_DUR: Record<JobSize, readonly [number, number]> = { S: [3, 4], M: [3, 5.5], L: [3.5, 7.5] };
/** Hard limit on a job; after it any sub-agents still around are sent home. */
const DEADLINE = 55;
/** Sub-agents of a finished job are poofed after this long (the audit allows a little more). */
export const SUB_GRACE = 2;

export class Job {
  readonly subs: Agent[] = [];
  total = 0;
  reported = 0;
  t = 0;
  done = false;
  endT = 0;
  summoned = false;
  /** Packet size on screen (0 / 1 / 2). */
  readonly big: number;
  constructor(readonly id: number, readonly size: JobSize, readonly lead: Agent) {
    this.big = size === 'S' ? 0 : size === 'M' ? 1 : 2;
  }
  get pending(): number { return this.total - this.reported; }
}

export class Jobs {
  readonly list: Job[] = [];
  private seq = 0;
  private spot: Pt = { x: 0, y: 0 };
  private prefer: Pt[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  private ref: SeatRef | null = null;

  constructor(private w: World) {}

  /** Jobs still running (optionally of one size). */
  active(size?: JobSize): number {
    let n = 0;
    for (const j of this.list) if (!j.done && (!size || j.size === size)) n++;
    return n;
  }

  create(lead: Agent, size: JobSize): Job {
    const j = new Job(++this.seq, size, lead);
    this.list.push(j);
    return j;
  }

  /** The lead is at its desk: call in the sub-agents. Returns how many came. */
  summon(job: Job): number {
    if (job.summoned || job.done) return 0;
    job.summoned = true;
    const w = this.w, r = w.rng, lead = job.lead, prof = AGENTS[lead.id];
    const [lo, hi] = SUBS[job.size];
    if (!prof.summons.length || hi === 0) return 0;
    const want = Math.min(r.int(lo, hi), MAX_SUBS - w.subs.length);
    if (want <= 0) return 0;
    const ax = lead.desk ? lead.desk.cx : lead.x, ay = lead.desk ? lead.desk.by : lead.y;
    let newDesks = 0;
    for (let k = 0; k < want; k++) {
      const id = r.pick(prof.summons), tool = AGENTS[id].tool;
      if (!tool) break;
      const delay = 0.35 + k * 0.17;
      randomSpot(r, lead.x, lead.y + 4, 18, 6, this.spot);
      const sub = w.spawnSub(id, this.spot.x, this.spot.y, lead, job, delay);
      if (!sub) break;
      this.ref = w.desks.findSeat(tool, ax, ay, 120, sub.small);
      if (!this.ref) {
        // a new desk of the sub-agent's tool next to the caller: Claude throws
        // its own; OpenCode sub-agents throw theirs themselves
        const own = tool === prof.tool;
        const gap = plotHalf() * 2 + 2;
        this.prefer[0].x = ax + (lead.x < 160 ? gap : -gap); this.prefer[0].y = ay;
        this.prefer[1].x = ax - (lead.x < 160 ? gap : -gap); this.prefer[1].y = ay;
        const p = w.desks.findSpot(ax, ay, this.spot, this.prefer, 230);
        if (!p) { w.removeSub(sub, false); break; }
        const d = own
          ? w.desks.create(tool, p.x, p.y, lead, lead, 0.25 + newDesks * 0.55)
          : w.desks.create(tool, p.x, p.y, sub, null, delay + 0.35);
        newDesks++;
        this.ref = { desk: d, i: sub.small ? 2 : 0 };
      }
      w.desks.reserve(this.ref.desk, this.ref.i, sub);
      job.subs.push(sub);
      job.total++;
    }
    return job.total;
  }

  subReported(job: Job): void {
    job.reported = Math.min(job.total, job.reported + 1);
    const l = job.lead;
    if (job.total >= 2 && !l.locked && (job.pending === 0 || job.total <= 4 || job.reported % 2 === 0))
      l.talk(`${job.reported}/${job.total}`, 0.8);
  }

  /** End a job. force: sub-agents still working are sent home now. */
  finish(job: Job, force = false): void {
    if (job.done) return;
    job.done = true;
    job.endT = this.w.time;
    if (force) for (const s of job.subs) if (this.w.has(s)) this.w.removeSub(s, true);
  }

  update(dt: number): void {
    const w = this.w;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const j = this.list[k];
      j.t += dt;
      if (!j.done && j.t > DEADLINE) this.finish(j, true);
      if (!j.done) continue;
      const late = w.time - j.endT > SUB_GRACE;
      let alive = 0;
      for (const s of j.subs) {
        if (!w.has(s)) continue;
        if (late) w.removeSub(s, true); else alive++;
      }
      if (late && alive === 0) this.list.splice(k, 1);
    }
  }

  clear(): void {
    for (const j of this.list) this.finish(j, true);
    this.list.length = 0;
  }

  debug(): unknown[] {
    return this.list.map(j => ({ id: j.id, size: j.size, lead: j.lead.id, subs: j.total, reported: j.reported, done: j.done, t: Math.round(j.t) }));
  }
}
