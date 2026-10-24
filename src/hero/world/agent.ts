// An agent in the world: body (motion, hops, knockback, anims), overlays
// (bubbles, icons, progress bar, zzz, nightcap, dizzy stars) and a default
// "brain":
//   idle ⇄ wander, now and then offline (asleep, dimmed, nightcap) → wake (stretch)
//   job:  await → receive → seek (free seat at a desk of its own tool nearby,
//         else toss its own crate) → toWork → work (big jobs: summon sub-agents,
//         wait for them) → deliver → leave
//   sub-agent: subIn (poof in, wait for the desk) → toWork → work → report → out
// A skit can lock an agent; while locked the brain is paused (a seat stays
// reserved) and the skit drives the body through the same small API.
import type { AgentAnim, BubbleStyle, CharacterId, TextLayer, TextStyle } from '../types';
import { W } from '../types';
import { PAL } from '../data/theme';
import { AGENTS } from '../data/agents';
import { drawSprite, frameAt, hasAnim, spriteSize } from '../sprites/render';
import { SPRITES } from '../sprites/defs';
import { mix, rect, rgba } from '../engine/draw';
import { EDGE, FLOOR_BOT, FLOOR_TOP, HOMES, KEEP, insideKeep, legalize, randomSpot, type Pt } from './layout';
import { sideOffset, type Desk } from './desks';
import { LEAD_DUR, SUB_DUR, type Job } from './jobs';
import { drawPacket, type Anchor } from './links';
import type { World } from './world';

export type Brain =
  | 'idle' | 'wander' | 'offline' | 'wake'
  | 'await' | 'receive' | 'seek' | 'toss' | 'toWork' | 'work' | 'deliver' | 'leave'
  | 'subIn' | 'report';

/** Anything that can lock an agent (a running skit). */
export interface Owner { readonly name: string }

const WALK = 26;
const RUN = 62;
const GRAV = 430;
/** How far an agent looks for a free seat at its own tool's desk. */
const SEEK_R = 100;
const RIM = mix(PAL.neonA, '#000000', 0.45);
const CAP = '#7c5cff', CAP_HI = '#b39dff', BRIM = '#f4e8ff';
const tmp: Pt = { x: 0, y: 0 };
const LABEL: TextStyle = { size: 4, baseline: 'top', color: '#fff', glow: null, alpha: 1, shadow: '#0d0221' };
const BUBBLE: BubbleStyle = { alpha: 1, size: 4.5 };

export class Agent implements Anchor {
  readonly name: string;
  readonly color: string;
  readonly scale: number;
  readonly w: number;
  readonly h: number;
  /** A summoned sub-agent (small, temporary, no label). */
  readonly sub: boolean;
  readonly home: Pt;
  x: number;
  y: number;
  hx = 0;
  hy = 0;
  flip = false;
  /** Height above the floor (hops). */
  z = 0;
  vz = 0;
  /** Horizontal knockback velocity. */
  kx = 0;

  // motion
  tx = 0;
  ty = 0;
  moving = false;
  running = false;
  speedMul = 1;

  // look
  pose: AgentAnim = 'idle';
  /** Keep `pose` even while moving / airborne. */
  forcePose = false;
  private anim = 'idle';
  private animT = 0;
  private blinkIn = 2;
  private blinkT = 0;
  private dustT = 0;
  private t = 0;
  private hasWalk: boolean;
  /** Small x jitter (tug-of-war, shivers). */
  jitter = 0;
  /** Throwing a crate (shows the wave pose). */
  throwT = 0;
  /** 0..1 sleepy dimming + nightcap while offline. */
  private dim = 0;

  // overlays
  say: string | null = null;
  sayT = 0;
  icon: string | null = null;
  iconT = 0;
  /** Progress bar 0..1 (-1 = hidden), shown when set by brain or skit. */
  bar = -1;
  barColor: string;
  carry: 'task' | 'result' | 'open' | null = null;
  /** Size of the carried packet (0 small, 1 medium, 2 large). */
  carryBig = 0;
  dizzyT = 0;
  sleeping = false;
  hovered = false;
  box = { x: 0, y: 0, w: 0, h: 0 };

  // control
  owner: Owner | null = null;
  brain: Brain = 'idle';
  private brainT = 0;
  private brainDur = 1;
  /** Seconds spent idle/wandering since the last task or skit. */
  idleTime = 0;
  private taskDur = 4;
  private work: Pt = { x: 0, y: 0 };
  private typeT = 0;
  private sparkT = 0;
  private fidgetT = 3;
  private delivered = false;
  private reported = false;
  private savedBar = -1;
  private tries = 0;
  private seekT = 0;
  private offDur = 0;
  private wakeJob: Job | null = null;
  private wakeStage = 0;
  private wasOffline = false;
  /** Seconds at the desk for the current job. */
  workT = 0;

  // jobs & desks
  job: Job | null = null;
  summoner: Agent | null = null;
  desk: Desk | null = null;
  /** A foreign desk this agent hangs around on purpose (the wrong-desk skit); otherwise it's nudged off. */
  visiting: Desk | null = null;
  seatI = -1;
  /** A summoned sub-agent is invisible until this reaches 0 (then it poofs in). */
  hidden = 0;

  constructor(readonly id: CharacterId, private wd: World, x?: number, y?: number, sub = false) {
    const p = AGENTS[id];
    this.name = p.name;
    this.color = p.color;
    this.scale = p.scale;
    this.sub = sub;
    const s = spriteSize(id, 'idle', this.scale);
    this.w = s.w; this.h = s.h;
    this.hasWalk = hasAnim(id, 'walk');
    const home = (!sub && HOMES[id]) || { x: x ?? 160, y: y ?? 140 };
    this.home = { x: home.x, y: home.y };
    this.x = x ?? home.x;
    this.y = y ?? home.y;
    this.barColor = sub ? PAL.neonB : p.color;
    this.blinkIn = wd.rng.range(1, 4);
    this.brainDur = wd.rng.range(0.5, 2.5);
    this.flip = this.x > 160;
    this.sync();
  }

  get halfW(): number { return this.w / 2 + 1; }
  /** Top of the head (px). */
  get top(): number { return this.y - this.z - this.h; }
  get locked(): boolean { return this.owner !== null; }
  get dir(): number { return this.flip ? -1 : 1; }
  get offline(): boolean { return this.brain === 'offline'; }
  /** 1× (sub-agent sized): perches on the desktop instead of standing behind the desk. */
  get small(): boolean { return this.scale === 1; }
  /** Sitting at its (open) desk, typing away. */
  get atDesk(): boolean {
    const d = this.desk;
    if (!d || d.state !== 'open' || this.owner || this.brain !== 'work') return false;
    return this.inSeat();
  }
  /** Standing on its seat spot (whatever it's doing). */
  inSeat(): boolean {
    const d = this.desk;
    if (!d) return false;
    const p = this.wd.desks.seatPos(d, this.seatI, tmp, this.small);
    return Math.abs(p.x - this.x) < 2 && Math.abs(p.y - this.y) < 2 && this.z < 6;
  }
  /** Depth-sort key: feet y, except a 1× agent perched on its desktop is drawn just after the desk. */
  get depth(): number {
    const d = this.desk;
    if (d && d.landed && this.wd.desks.onDesktop(this.seatI, this.small) && this.inSeat()) return d.by + 0.5;
    return this.y;
  }

  /** Progress saved when a skit locked us mid-job (skits may show it frozen). */
  get pausedBar(): number { return this.savedBar; }

  /** Free for a skit. strict: only idle/wandering; loose: also task work that can be resumed. */
  free(strict: boolean): boolean {
    if (this.owner || this.sub || this.hidden > 0) return false;
    if (this.brain === 'idle' || this.brain === 'wander') return true;
    return !strict && (this.brain === 'receive' || this.brain === 'toWork' || this.brain === 'work');
  }

  stateLabel(): string {
    if (this.owner) return 'skit:' + this.owner.name;
    return this.sub ? 'sub:' + this.brain : this.brain;
  }

  // ------------------------------------------------------------ body API

  goTo(x: number, y: number, run = false): void {
    tmp.x = x; tmp.y = y;
    legalize(tmp, this.halfW);
    this.wd.desks.clearOf(tmp, this);
    legalize(tmp, this.halfW);
    this.tx = tmp.x; this.ty = tmp.y;
    this.running = run;
    this.moving = Math.hypot(this.tx - this.x, this.ty - this.y) > 0.5;
  }

  stop(): void { this.moving = false; this.running = false; }

  face(x: number): void { if (Math.abs(x - this.x) > 1) this.flip = x < this.x; }

  hop(v = 85): void { if (this.z <= 0.01) { this.vz = v; this.z = 0.01; } }

  talk(text: string | null, dur = 1.5): void { this.say = text; this.sayT = dur; }

  showIcon(name: string | null, dur = 1.5): void { this.icon = name; this.iconT = dur; }

  setPose(p: AgentAnim, force = false): void { this.pose = p; this.forcePose = force; }

  /** Distance from feet to a point. */
  dist(x: number, y: number): number { return Math.hypot(x - this.x, y - this.y); }

  /** Where this agent's seat is (or its standing work spot). */
  seatSpot(out: Pt): Pt {
    if (this.desk) return this.wd.desks.seatPos(this.desk, this.seatI, out, this.small);
    out.x = this.work.x; out.y = this.work.y;
    return out;
  }

  lock(o: Owner): void {
    this.owner = o;
    this.stop();
    this.sleeping = false;
    this.pose = 'idle';
    this.forcePose = false;
    this.savedBar = this.bar;
    this.bar = -1;
    this.speedMul = 1;
    this.throwT = 0;
  }

  /** Called by a skit when it ends (normally or by timeout). Always leaves the agent sane. */
  release(): void {
    this.owner = null;
    this.forcePose = false;
    this.pose = 'idle';
    this.sleeping = false;
    this.dizzyT = 0;
    this.jitter = 0;
    this.kx = 0;
    this.carry = null;
    this.icon = null;
    this.speedMul = 1;
    this.stop();
    const b = this.brain;
    if (b === 'receive' || b === 'seek') {
      this.brain = 'seek'; this.brainT = 0; this.seekT = 0;
      this.carry = 'task';
    } else if (b === 'toWork' || b === 'work' || b === 'toss' || b === 'subIn') {
      // resume the interrupted job: back to the seat
      this.bar = this.savedBar;
      this.backToSeat(this.sub);
      if (!this.sub && this.workT === 0) this.carry = 'task';
    } else if (this.sub) {
      this.bar = -1;
    } else {
      this.toIdle(this.wd.rng.range(0.8, 2.5));
      this.bar = -1;
    }
    this.idleTime = 0;
  }

  // ------------------------------------------------------------ brain: idle / offline

  private toIdle(dur: number): void {
    this.brain = 'idle'; this.brainT = 0; this.brainDur = dur;
    this.pose = 'idle';
  }

  private goOffline(): void {
    const r = this.wd.rng;
    this.brain = 'offline'; this.brainT = 0;
    this.offDur = r.range(14, 30);
    this.sleeping = true;
    this.stop();
    this.talk(r.pick(OFFLINE_LINES), 1.3);
  }

  /** Wake up (and stretch). job: woken by a packet → jolt, then take the job. */
  private wake(job: Job | null): void {
    this.brain = 'wake'; this.brainT = 0;
    this.sleeping = false;
    this.wakeJob = job;
    this.wakeStage = 0;
    if (job) {
      this.setPose('shock', true);
      this.hop(95);
      this.showIcon('bang', 0.8);
      this.wd.sfx('startle', this.x, 0.45);
    } else this.setPose('idle');
  }

  /** Click on an offline agent: wakes it (no job). */
  poke(): void { if (this.brain === 'offline' && !this.owner) this.wake(null); }

  /** Test hook: fall asleep now. */
  forceOffline(): boolean {
    if (this.owner || this.sub || (this.brain !== 'idle' && this.brain !== 'wander')) return false;
    this.goOffline();
    return true;
  }

  // ------------------------------------------------------------ brain: jobs

  /** Orca has dispatched a packet toward us. */
  awaitTask(job: Job): void {
    this.wasOffline = this.brain === 'offline';
    this.brain = 'await'; this.brainT = 0;
    this.job = job;
    this.stop();
    this.idleTime = 0;
  }

  receiveTask(): void {
    if (this.owner || this.brain !== 'await' || !this.job) return;
    if (this.wasOffline) { this.wasOffline = false; this.wake(this.job); return; }
    this.beginJob();
  }

  private beginJob(): void {
    const j = this.job!, r = this.wd.rng;
    this.brain = 'receive'; this.brainT = 0;
    this.carry = 'task';
    this.carryBig = j.big;
    const [lo, hi] = LEAD_DUR[j.size];
    this.taskDur = r.range(lo, hi);
    this.bar = -1;
    this.workT = 0;
    this.tries = 0;
    this.seekT = 0;
    this.talk(r.pick(j.size === 'L' ? BIG_LINES : j.size === 'M' ? MED_LINES : RECEIVE_LINES), 1.3);
    if (j.size === 'L') { this.setPose('shock'); this.showIcon('bang', 0.9); this.hop(90); } else this.hop(60);
    this.face(this.wd.orca.x);
  }

  /** Become a sub-agent of `summoner` for `job`, poofing in after `delay`. */
  initSub(summoner: Agent, job: Job, delay: number): void {
    const [lo, hi] = SUB_DUR[job.size];
    this.summoner = summoner;
    this.job = job;
    this.hidden = delay;
    this.brain = 'subIn'; this.brainT = 0;
    this.taskDur = this.wd.rng.range(lo, hi);
    this.face(summoner.x);
  }

  /** Walk (back) to the reserved seat, or the standing work spot. */
  private backToSeat(run = false): void {
    this.brain = 'toWork'; this.brainT = 0;
    this.seatSpot(tmp);
    this.goTo(tmp.x, tmp.y, run);
  }

  /** Find a free seat at a desk of our tool, or toss our own crate. */
  private seek(): void {
    const wd = this.wd, tool = AGENTS[this.id].tool, r = wd.rng;
    if (!tool) { this.work.x = this.x; this.work.y = this.y; this.backToSeat(); return; }
    const ref = wd.desks.findSeat(tool, this.x, this.y, SEEK_R, this.small);
    if (ref && wd.desks.reserve(ref.desk, ref.i, this)) { this.backToSeat(); return; }
    // pull the crate out of the pocket: our own seat right where we stand
    const off = sideOffset(), fwd = this.dir;
    PREFER[0].x = this.x + fwd * off; PREFER[0].y = this.y - 1;
    PREFER[1].x = this.x - fwd * off; PREFER[1].y = this.y - 1;
    const p = wd.desks.findSpot(this.x, this.y, tmp, PREFER, 150);
    if (p) {
      const d = wd.desks.create(tool, p.x, p.y, this, this, 0.3);
      const i = wd.desks.sideSeat(d, this.x);
      wd.desks.reserve(d, i, this);
      this.brain = 'toss'; this.brainT = 0;
      this.pose = 'idle';
      if (r.chance(0.45)) this.talk(r.pick(TOSS_LINES), 1);
      return;
    }
    if (++this.tries >= 3) {
      // no room anywhere: work standing up
      this.talk('no room!', 1.2);
      this.work.x = this.x; this.work.y = this.y;
      this.backToSeat();
    }
  }

  private sitDown(): void {
    this.brain = 'work'; this.brainT = 0;
    this.stop();
    this.pose = 'work';
    this.carry = null;
    if (this.desk) {
      const d = this.desk;
      this.wd.desks.seatPos(d, this.seatI, tmp, this.small);
      this.x = tmp.x; this.y = tmp.y;
      this.flip = this.wd.desks.seatFlip(this.seatI);
      if (this.wd.desks.onDesktop(this.seatI, this.small)) this.hop(55); // up onto the desktop
    }
    if (this.bar < 0) this.bar = 0;
  }

  private working(dt: number): void {
    const wd = this.wd, rng = wd.rng, job = this.job;
    this.workT += dt;
    const waiting = !this.sub && !!job && !job.done && this.bar >= 1 && job.pending > 0;
    this.pose = waiting ? 'look' : 'work';
    if (this.desk && !waiting) this.flip = wd.desks.seatFlip(this.seatI);
    this.bar = Math.min(1, this.bar + dt / this.taskDur);
    if (!waiting && (this.sparkT -= dt) <= 0) {
      this.sparkT = rng.range(0.12, 0.3) * (this.sub ? 1.8 : 1);
      wd.fx.sparks(this.x + this.dir * (this.w * 0.35), this.y - this.h * 0.35, this.sub ? undefined : this.color);
    }
    if (!waiting && (this.typeT -= dt) <= 0) {
      this.typeT = rng.range(0.5, 1.4) * (this.sub ? 2.5 : 1);
      wd.sfx('type', this.x, this.sub ? 0.1 : 0.18, true);
    }
    // bigger jobs: call in the sub-agents once seated
    if (!this.sub && job && !job.summoned && this.workT > 0.6) {
      const n = wd.jobs.summon(job);
      if (n > 0) {
        this.talk(n >= 6 ? 'ALL HANDS!' : rng.pick(['need hands!', 'sub-agents!', 'help pls']), 1.3);
        this.hop(55);
        this.throwT = 0.4;
        wd.fx.ring(this.x, this.y, 2, 22, 0.6, PAL.neonB, 0.4);
        wd.sfx('poof', this.x, 0.45);
      }
    }
    this.fidget(dt, waiting);
    if (this.bar < 1 || waiting) return;
    if (this.sub) this.report();
    else this.deliver();
  }

  /** Working is for show: little bits of business at the desk. */
  private fidget(dt: number, waiting: boolean): void {
    if ((this.fidgetT -= dt) > 0) return;
    const rng = this.wd.rng;
    this.fidgetT = rng.range(2.8, 6);
    if (this.sub) { if (rng.chance(0.2)) this.hop(28); return; }
    if (this.say || this.icon) return;
    if (waiting) { this.talk(rng.pick(WAIT_LINES), 1); return; }
    const r = rng.next();
    if (this.workT > 7 && r < 0.2) {
      this.dizzyT = 1.4;
      this.talk(rng.pick(DIZZY_LINES), 1.2);
    } else if (r < 0.48) this.showIcon(rng.pick(WORK_ICONS), 1.1);
    else if (r < 0.66) this.talk(rng.pick(WORK_LINES), 1.1);
    else if (r < 0.78) {
      this.hop(45);
      for (let i = 0; i < 3; i++) this.wd.fx.sparks(this.x + this.dir * 6, this.y - this.h * 0.4, this.color);
    }
  }

  private report(): void {
    const wd = this.wd, s = this.summoner, job = this.job;
    this.brain = 'report'; this.brainT = 0;
    this.bar = -1;
    this.pose = 'idle';
    this.reported = false;
    wd.desks.leave(this);
    this.hop(35);
    if (wd.rng.chance(0.25)) this.talk(wd.rng.pick(['done', 'k', '✓']), 0.7);
    if (!s || !job || !wd.has(s)) { this.reported = true; return; }
    this.face(s.x);
    wd.links.send('result', this, s, {
      arc: 8, speed: 130, sfx: null,
      onArrive: () => { this.reported = true; wd.jobs.subReported(job); },
    });
  }

  private deliver(): void {
    const wd = this.wd;
    this.brain = 'deliver'; this.brainT = 0;
    this.bar = -1;
    this.pose = 'idle';
    this.delivered = false;
    this.face(wd.orca.x);
    this.talk(wd.rng.pick(DONE_LINES), 1.3);
    wd.links.send('result', this, wd.orca, {
      sfx: 'result', size: this.job?.big ?? 0,
      onArrive: () => { this.delivered = true; wd.orca.flash(); },
    });
  }

  /** Job delivered: free the seat and step away from the desk. */
  private finishJob(): void {
    const wd = this.wd, r = wd.rng;
    if (this.job) wd.jobs.finish(this.job);
    this.job = null;
    this.carryBig = 0;
    const d = this.desk;
    const away = d ? (this.seatI === 0 || this.seatI === 2 ? -1 : 1) : 0;
    wd.desks.leave(this);
    this.brain = 'leave'; this.brainT = 0;
    if (r.chance(0.25)) this.pose = 'wave';
    if (d) this.goTo(this.x + away * 12, this.y + 6);
    else this.toIdle(r.range(1, 3));
    if (this.pose === 'idle' && r.chance(0.3)) this.talk(r.pick(IDLE_LINES), 1.2);
  }

  private think(dt: number): void {
    const wd = this.wd, rng = wd.rng;
    this.brainT += dt;
    switch (this.brain) {
      case 'idle':
        this.idleTime += dt;
        if (this.brainT > this.brainDur && !this.hovered) {
          if (wd.mayGoOffline(this)) { this.goOffline(); break; }
          if (rng.chance(0.6)) {
            this.brain = 'wander'; this.brainT = 0;
            for (let i = 0; i < 4; i++) {
              randomSpot(rng, this.home.x, this.home.y, 32, this.halfW, tmp);
              if (!wd.desks.blocked(tmp.x, tmp.y, 4)) break;
            }
            this.goTo(tmp.x, tmp.y, false);
          } else {
            this.toIdle(rng.range(1.5, 4));
            if (rng.chance(0.4)) this.face(rng.chance(0.5) ? wd.orca.x : this.x + rng.range(-20, 20));
          }
        }
        break;
      case 'wander':
        this.idleTime += dt;
        if (!this.moving || this.brainT > 6) this.toIdle(rng.range(1.5, 4.5));
        break;
      case 'offline':
        this.sleeping = true;
        if (this.brainT > this.offDur && !this.hovered) this.wake(null);
        break;
      case 'wake':
        if (this.wakeStage === 0 && this.brainT > (this.wakeJob ? 0.65 : 0.3)) {
          this.wakeStage = 1;
          this.setPose('jump', true); // arms up: a big stretch
          this.talk(rng.pick(STRETCH_LINES), 1.1);
        } else if (this.wakeStage === 1 && this.brainT > 1.55) {
          this.setPose('idle');
          const j = this.wakeJob;
          this.wakeJob = null;
          if (j && !j.done && this.job === j) this.beginJob();
          else this.toIdle(rng.range(0.5, 1.5));
        }
        break;
      case 'await':
        if (!this.wasOffline) this.face(wd.orca.x);
        if (this.brainT > 6) { // packet lost (safety)
          if (this.job) wd.jobs.finish(this.job, true);
          this.job = null;
          if (this.wasOffline) { this.wasOffline = false; this.brain = 'offline'; this.brainT = 0; }
          else this.toIdle(1);
        }
        break;
      case 'receive':
        if (this.brainT > 0.9) { this.pose = 'idle'; this.brain = 'seek'; this.brainT = 0; this.seekT = 0; }
        break;
      case 'seek':
        if ((this.seekT -= dt) <= 0) { this.seekT = 0.5; this.seek(); }
        break;
      case 'toss': {
        const d = this.desk;
        if (d) this.face(d.cx);
        if (!d || (d.landed && d.unfold > 0.3) || this.brainT > 5) this.backToSeat();
        break;
      }
      case 'toWork': {
        if (this.moving) {
          if (this.brainT > 10) { this.seatSpot(tmp); this.x = tmp.x; this.y = tmp.y; this.stop(); }
          break;
        }
        const d = this.desk;
        if (d && d.state !== 'open') {
          this.face(d.cx);
          if (this.sub && this.brainT > 0.3 && rng.chance(dt * 0.6)) this.hop(30);
          break;
        }
        this.sitDown();
        break;
      }
      case 'work':
        this.working(dt);
        break;
      case 'deliver':
        if (this.delivered || this.brainT > 3.5) this.finishJob();
        break;
      case 'leave':
        if (!this.moving || this.brainT > 3) this.toIdle(rng.range(1, 3));
        break;
      case 'subIn': {
        const d = this.desk;
        if (!d) { wd.removeSub(this, true); break; }
        if (this.summoner && this.brainT < 0.4) this.face(this.summoner.x);
        if (d.landed || this.brainT > 4) this.backToSeat(true);
        break;
      }
      case 'report':
        if ((this.reported && this.brainT > 0.3) || this.brainT > 2.5) wd.removeSub(this, true);
        break;
    }
  }

  // ------------------------------------------------------------ update

  update(dt: number): void {
    if (this.hidden > 0) {
      if ((this.hidden -= dt) > 0) return;
      this.hidden = 0;
      this.wd.fx.poof(this.x, this.y - this.h / 2);
      this.wd.sfx('poof', this.x, 0.3, true, 4);
      if (this.wd.rng.chance(0.3)) this.talk(this.wd.rng.pick(['k!', 'hi!', 'wip']), 0.8);
    }
    this.t += dt;
    if (!this.owner) this.think(dt);

    // knockback
    if (this.kx !== 0) {
      this.x += this.kx * dt;
      this.kx *= Math.pow(0.004, dt);
      if (Math.abs(this.kx) < 3) this.kx = 0;
    }
    // hop
    if (this.z > 0) {
      this.vz -= GRAV * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = 0; }
    }
    // walk / run
    if (this.moving && !this.hovered) {
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      const step = (this.running ? RUN : WALK) * this.speedMul * (this.sub ? 1.15 : 1) * dt;
      if (d <= step) { this.x = this.tx; this.y = this.ty; this.moving = false; this.running = false; }
      else {
        this.x += (dx / d) * step; this.y += (dy / d) * step;
        if (Math.abs(dx) > 0.5) this.flip = dx < 0;
        this.steer(step);
      }
      if (this.running && (this.dustT -= dt) <= 0) {
        this.dustT = 0.09;
        this.wd.fx.dust(this.x - this.dir * (this.w / 2 - 2), this.y, this.dir);
      }
    }
    if (this.hovered && this.wd.pointer.inside) this.face(this.wd.pointer.x);

    // timers
    if (this.sayT > 0 && (this.sayT -= dt) <= 0) this.say = null;
    if (this.iconT > 0 && (this.iconT -= dt) <= 0) this.icon = null;
    if (this.dizzyT > 0) this.dizzyT -= dt;
    if (this.throwT > 0) this.throwT -= dt;
    if (this.blinkT > 0) this.blinkT -= dt;
    else if ((this.blinkIn -= dt) <= 0) { this.blinkT = 0.13; this.blinkIn = this.wd.rng.range(2, 5.5); }
    const off = this.brain === 'offline' || (this.brain === 'await' && this.wasOffline);
    this.dim = off ? Math.min(1, this.dim + dt * 1.5) : Math.max(0, this.dim - dt * 2);

    this.clamp();
    this.sync();

    const a = this.currentAnim();
    if (a !== this.anim) { this.anim = a; this.animT = 0; }
    this.animT += dt * (this.anim === 'walk' && this.running ? 1.9 : 1);
  }

  /** Slide around Orca's keep-out ellipse instead of walking through it. */
  private steer(step: number): void {
    let nx = (this.x - KEEP.x) / KEEP.rx, ny = (this.y - KEEP.y) / KEEP.ry;
    let d = Math.sqrt(nx * nx + ny * ny);
    if (d >= 1) return;
    if (d < 1e-3) { nx = 0; ny = 1; d = 1; }
    nx /= d; ny /= d;
    this.x = KEEP.x + nx * KEEP.rx; this.y = KEEP.y + ny * KEEP.ry;
    // tangent toward the target
    let tx = -ny * KEEP.rx, ty = nx * KEEP.ry;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const dot = tx * (this.tx - this.x) + ty * (this.ty - this.y);
    let s = dot >= 0 ? 1 : -1;
    // target roughly across Orca: go around the front so we stay visible
    if (Math.abs(dot) < 0.5 * Math.hypot(this.tx - this.x, this.ty - this.y) && Math.abs(ty) > 0.05) s = ty > 0 ? 1 : -1;
    this.x += tx * s * step; this.y += ty * s * step;
    // the floor's top edge cuts through the ellipse behind Orca: slide outward along it
    if (this.y < FLOOR_TOP + 1) this.x += (this.x >= KEEP.x ? 1 : -1) * step;
  }

  private clamp(): void {
    const lo = EDGE + this.halfW, hi = W - EDGE - this.halfW;
    if (this.x < lo) { this.x = lo; if (this.kx < 0) this.kx = -this.kx * 0.4; }
    if (this.x > hi) { this.x = hi; if (this.kx > 0) this.kx = -this.kx * 0.4; }
    if (this.y < FLOOR_TOP) this.y = FLOOR_TOP;
    if (this.y > FLOOR_BOT) this.y = FLOOR_BOT;
    // knockback / spawns can land inside Orca's zone: nudge out gently
    if (!this.moving && insideKeep(this.x, this.y, 0.98)) {
      tmp.x = this.x; tmp.y = this.y;
      legalize(tmp, this.halfW);
      this.x += (tmp.x - this.x) * 0.25;
      this.y += (tmp.y - this.y) * 0.25;
    }
  }

  private sync(): void {
    this.hx = this.x;
    this.hy = this.y - this.z - this.h * 0.5;
    this.box.x = this.x - this.w / 2 - 2;
    this.box.y = this.y - this.z - this.h - 2;
    this.box.w = this.w + 4;
    this.box.h = this.h + 4;
  }

  private currentAnim(): AgentAnim {
    if (this.forcePose) return this.pose;
    if (this.sleeping) return 'sleep';
    if (this.dizzyT > 0) return 'dizzy';
    if (this.throwT > 0) return 'wave';
    if (this.z > 1) return 'jump';
    if (this.moving && !this.hovered) return 'walk';
    if (this.pose === 'idle' && this.blinkT > 0) return 'blink';
    return this.pose;
  }

  // ------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D): void {
    if (this.hidden > 0) return;
    const s = this.scale;
    // floor shadow
    const sw = Math.max(2, this.w - 4 - Math.round(this.z * 0.3));
    ctx.fillStyle = rgba('#000000', 0.5);
    ctx.fillRect(Math.round(this.x - sw / 2), Math.round(this.y), sw, 1);

    let bob = 0;
    if (this.anim === 'walk' && !this.hasWalk) bob = (Math.floor(this.animT * (this.running ? 12 : 7)) & 1) * (this.sub ? 1 : s);
    const jx = this.jitter ? Math.round(Math.sin(this.t * 40) * this.jitter) : 0;
    const f = frameAt(this.id, this.anim, this.animT);
    drawSprite(ctx, this.id, this.anim, f, Math.round(this.x) + jx, Math.round(this.y - this.z) - bob, {
      flip: this.flip, scale: s, outline: this.hovered ? PAL.neonB : RIM, alpha: 1 - this.dim * 0.45,
    });

    if (this.carry) {
      const big = this.carry === 'task' ? this.carryBig : 0;
      const px = Math.round(this.x + this.dir * (this.w / 2 + 1 + big));
      const py = Math.round(this.y - this.z - this.h * 0.4) - bob;
      drawPacket(ctx, this.carry, px, py + 1, big, this.t);
    }
  }

  /** Low-res overlays: dizzy stars, zzz, nightcap, progress bar, icon bubble. Drawn after all sprites. */
  renderOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.hidden > 0) return;
    const top = Math.round(this.top);
    if (this.dizzyT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 7 + (i * Math.PI * 2) / 3;
        const sx = Math.round(this.x + Math.cos(a) * (this.w * 0.45));
        const sy = Math.round(top - 2 + Math.sin(a) * 2);
        drawSprite(ctx, 'fx', 'star', 0, sx, sy + 2);
      }
    }
    if (this.dim > 0.05) this.renderCap(ctx, Math.round(this.y - this.z) - headRows(this.id, this.anim, frameAt(this.id, this.anim, this.animT)) * this.scale);
    if (this.sleeping) {
      for (let i = 0; i < 2; i++) {
        const k = (this.t * 0.5 + i * 0.5) % 1;
        drawSprite(ctx, 'icon', 'zzz', 0, Math.round(this.x + this.dir * 4 + k * 6), Math.round(top - 1 - k * 12), { alpha: 1 - k });
      }
    }
    const bar = this.bar;
    if (bar >= 0) {
      const bw = this.sub ? 8 : 14, bx = Math.round(this.x - bw / 2), by = top - 4;
      ctx.fillStyle = '#0d0221';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = rgba(this.barColor, 0.35);
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = this.barColor;
      ctx.fillRect(bx, by, Math.round(bw * bar), 2);
    }
    if (this.icon) {
      const ib = this.iconBox();
      ctx.fillStyle = this.color;
      ctx.fillRect(ib.x, ib.y - 1, ib.w, ib.h + 2);
      ctx.fillRect(ib.x - 1, ib.y, ib.w + 2, ib.h);
      ctx.fillStyle = '#0d0221';
      ctx.fillRect(ib.x, ib.y, ib.w, ib.h);
      // tail
      const tx = Math.round(this.x);
      ctx.fillStyle = this.color;
      ctx.fillRect(tx - 1, ib.y + ib.h, 3, 1);
      ctx.fillRect(tx, ib.y + ib.h + 1, 1, 1);
      drawSprite(ctx, 'icon', this.icon, 0, ib.x + ib.w / 2, ib.y + ib.h - 2);
    }
  }

  /** A tiny striped nightcap flopping toward the back, with a pompom. */
  private renderCap(ctx: CanvasRenderingContext2D, top: number): void {
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * this.dim;
    const b = -this.dir; // the tip flops backward
    const cx = Math.round(this.x - this.dir * 2), y = top + 1;
    rect(ctx, cx - 4, y, 9, 2, BRIM);
    rect(ctx, cx - 3, y - 2, 7, 2, CAP);
    rect(ctx, cx - 1 + b, y - 4, 4, 2, CAP_HI);
    rect(ctx, cx + b * 3 - (b < 0 ? 1 : 0), y - 5, 2, 2, CAP);
    rect(ctx, cx + b * 6 - (b < 0 ? 1 : 0), y - 4, 2, 2, '#ffffff');
    ctx.globalAlpha = prev;
  }

  private ibox = { x: 0, y: 0, w: 0, h: 0 };
  private iconBox(): { x: number; y: number; w: number; h: number } {
    const s = spriteSize('icon', this.icon ?? 'q');
    const w = s.w + 4, h = s.h + 4;
    const b = this.ibox;
    b.w = w; b.h = h;
    b.x = Math.max(2, Math.min(W - w - 2, Math.round(this.x - w / 2)));
    b.y = Math.max(2, Math.round(this.top - (this.bar >= 0 ? 6 : 2) - 3 - h));
    return b;
  }

  renderText(text: TextLayer, showLabel: boolean): void {
    if (this.hidden > 0) return;
    // standing behind the desk, the name would sit on the nameplate
    const behind = this.desk && this.seatI >= 2 && this.inSeat();
    if ((showLabel && !behind) || this.hovered) {
      const lit = this.hovered, st = LABEL;
      st.size = lit ? 4.5 : 4; st.color = lit ? '#ffffff' : this.color;
      st.glow = lit ? this.color : null; st.alpha = lit ? 1 : 0.5 - this.dim * 0.2;
      text.draw(this.name, this.x, this.y + 2, st);
    }
    if (this.say) {
      let ty = this.top - 2;
      if (this.bar >= 0) ty -= 5;
      if (this.dim > 0.05) ty -= 5;
      if (this.icon) ty = this.iconBox().y - 2;
      const a = this.sayT < 0.2 ? this.sayT / 0.2 : 1;
      BUBBLE.alpha = a; BUBBLE.size = this.sub ? 4 : 4.5;
      text.bubble(this.say, this.x + this.dir * 3, ty, BUBBLE);
    }
  }
}

/** Opaque rows from the top of the head to the feet in a frame (sleep poses slump lower than idle). */
const HEAD = new Map<string, number>();
function headRows(id: CharacterId, anim: string, f: number): number {
  const key = id + '|' + anim + '|' + f;
  let n = HEAD.get(key);
  if (n === undefined) {
    const anims = SPRITES[id].anims, a = anims[anim] ?? anims.idle ?? Object.values(anims)[0];
    const fr = a.frames[Math.min(f, a.frames.length - 1)];
    let top = 0;
    while (top < fr.length - 1 && !/[^. ]/.test(fr[top])) top++;
    n = fr.length - top;
    HEAD.set(key, n);
  }
  return n;
}

const PREFER: Pt[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
const RECEIVE_LINES = ['on it!', 'on it!', 'roger', 'got it', 'k!', 'wip'] as const;
const MED_LINES = ['ooh, chunky', 'on it!', 'big-ish', 'roger'] as const;
const BIG_LINES = ['WHOA', 'huge!', "that's big", 'oh no'] as const;
const TOSS_LINES = ['desk!', '*unpacks*', 'workstation!', 'ta-da'] as const;
const DONE_LINES = ['>_ done', '>_ done', 'shipped', 'PR up', 'done!', 'lgtm'] as const;
const IDLE_LINES = ['next?', 'ez', 'brb', ':)', 'hmm'] as const;
const OFFLINE_LINES = ['brb', 'afk', '*yawn*', 'nap time', 'zz..'] as const;
const STRETCH_LINES = ['*yawn*', '*stretch*', 'mmh..', 'five more min'] as const;
const WORK_LINES = ['hmm', 'compiling', 'tests...', 'refactor!', 'why', 'aha!', 'typo', 'ship?'] as const;
const WAIT_LINES = ['hurry!', 'any sec', 'waiting...', 'subs?'] as const;
const DIZZY_LINES = ['@_@', 'so many tabs', 'brain.exe', '404 focus'] as const;
const WORK_ICONS = ['bulb', 'coffee', 'note', 'fire', 'chart', 'bug'] as const;
