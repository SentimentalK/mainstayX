// An agent in the world: body (motion, hops, knockback, anims), overlays
// (bubbles, icons, progress bar, zzz, dizzy stars) and a default "brain"
// (idle → wander, or Orca's task loop: await → receive → toWork → work →
// deliver). A skit can lock an agent; while locked the brain is paused and
// the skit drives the body through the same small API.
import type { AgentAnim, BubbleStyle, CharacterId, TextLayer, TextStyle } from '../types';
import { W } from '../types';
import { PAL } from '../data/theme';
import { AGENTS } from '../data/agents';
import { drawSprite, frameAt, hasAnim, spriteSize } from '../sprites/render';
import { mix, rgba } from '../engine/draw';
import { EDGE, FLOOR_BOT, FLOOR_TOP, HOMES, KEEP, insideKeep, legalize, randomSpot, type Pt } from './layout';
import type { Anchor } from './links';
import type { World } from './world';

export type Brain = 'idle' | 'wander' | 'await' | 'receive' | 'toWork' | 'work' | 'deliver';

/** Anything that can lock an agent (a running skit). */
export interface Owner { readonly name: string }

const WALK = 26;
const RUN = 62;
const GRAV = 430;
const RIM = mix(PAL.neonA, '#000000', 0.45);
const tmp: Pt = { x: 0, y: 0 };
const LABEL: TextStyle = { size: 4, baseline: 'top', color: '#fff', glow: null, alpha: 1, shadow: '#0d0221' };
const BUBBLE: BubbleStyle = { alpha: 1, size: 4.5 };

export class Agent implements Anchor {
  readonly name: string;
  readonly color: string;
  readonly scale: number;
  readonly w: number;
  readonly h: number;
  readonly mini: boolean;
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

  // overlays
  say: string | null = null;
  sayT = 0;
  icon: string | null = null;
  iconT = 0;
  /** Progress bar 0..1 (-1 = hidden), shown when set by brain or skit. */
  bar = -1;
  barColor: string;
  carry: 'task' | 'result' | 'open' | null = null;
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
  private delivered = false;

  constructor(readonly id: CharacterId, private wd: World, x?: number, y?: number) {
    const p = AGENTS[id];
    this.name = p.name;
    this.color = p.color;
    this.scale = p.scale;
    this.mini = id === 'mini';
    const s = spriteSize(id, 'idle', this.scale);
    this.w = s.w; this.h = s.h;
    this.hasWalk = hasAnim(id, 'walk');
    const home = HOMES[id] ?? { x: x ?? 160, y: y ?? 140 };
    this.home = { x: home.x, y: home.y };
    this.x = x ?? home.x;
    this.y = y ?? home.y;
    this.barColor = this.mini ? PAL.neonB : p.color;
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

  /** Free for a skit. strict: only idle/wandering; loose: also task work that can be resumed. */
  free(strict: boolean): boolean {
    if (this.owner || this.mini) return false;
    if (this.brain === 'idle' || this.brain === 'wander') return true;
    return !strict && (this.brain === 'receive' || this.brain === 'toWork' || this.brain === 'work');
  }

  stateLabel(): string {
    if (this.owner) return 'skit:' + this.owner.name;
    if (this.sleeping) return 'sleep';
    return this.brain;
  }

  // ------------------------------------------------------------ body API

  goTo(x: number, y: number, run = false): void {
    tmp.x = x; tmp.y = y;
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

  lock(o: Owner): void {
    this.owner = o;
    this.stop();
    this.sleeping = false;
    this.pose = 'idle';
    this.forcePose = false;
    this.bar = -1;
    this.speedMul = 1;
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
    if (this.brain === 'receive' || this.brain === 'toWork' || this.brain === 'work') {
      // resume the interrupted task
      this.brain = 'toWork';
      this.goTo(this.work.x, this.work.y, false);
      this.carry = 'task';
    } else {
      this.toIdle(this.wd.rng.range(0.8, 2.5));
      this.bar = -1;
    }
    this.idleTime = 0;
  }

  // ------------------------------------------------------------ brain

  private toIdle(dur: number): void {
    this.brain = 'idle'; this.brainT = 0; this.brainDur = dur;
    this.pose = 'idle';
  }

  /** Orca has dispatched a packet toward us. */
  awaitTask(): void {
    this.brain = 'await'; this.brainT = 0;
    this.stop();
    this.idleTime = 0;
  }

  receiveTask(): void {
    if (this.owner || this.brain !== 'await') return;
    this.brain = 'receive'; this.brainT = 0;
    this.carry = 'task';
    this.taskDur = this.wd.rng.range(3.5, 6.5);
    this.bar = 0;
    this.talk(this.wd.rng.pick(RECEIVE_LINES), 1.3);
    this.hop(60);
    this.face(this.wd.orca.x);
    randomSpot(this.wd.rng, this.home.x, this.home.y, 30, this.halfW, this.work);
  }

  private think(dt: number): void {
    const wd = this.wd, rng = wd.rng;
    this.brainT += dt;
    switch (this.brain) {
      case 'idle':
        this.idleTime += dt;
        if (this.brainT > this.brainDur && !this.hovered) {
          if (rng.chance(0.6)) {
            this.brain = 'wander'; this.brainT = 0;
            randomSpot(rng, this.home.x, this.home.y, 32, this.halfW, tmp);
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
      case 'await':
        this.face(wd.orca.x);
        if (this.brainT > 5) this.toIdle(1); // packet lost (safety)
        break;
      case 'receive':
        if (this.brainT > 0.9) {
          this.brain = 'toWork'; this.brainT = 0;
          this.goTo(this.work.x, this.work.y, rng.chance(0.35));
        }
        break;
      case 'toWork':
        if (!this.moving || this.brainT > 8) {
          this.brain = 'work'; this.brainT = 0;
          this.stop();
          this.pose = 'work';
          this.carry = null;
          if (this.bar < 0) this.bar = 0;
        }
        break;
      case 'work':
        this.pose = 'work';
        this.bar = Math.min(1, this.bar + dt / this.taskDur);
        if ((this.sparkT -= dt) <= 0) {
          this.sparkT = rng.range(0.12, 0.3);
          wd.fx.sparks(this.x + this.dir * (this.w * 0.35), this.y - this.h * 0.35, this.color);
        }
        if ((this.typeT -= dt) <= 0) {
          this.typeT = rng.range(0.5, 1.4);
          wd.sfx('type', this.x, 0.18, true);
        }
        if (this.bar >= 1) this.deliver();
        break;
      case 'deliver':
        if (this.delivered || this.brainT > 3.5) {
          if (rng.chance(0.25)) this.pose = 'wave';
          this.toIdle(rng.range(1, 3));
          if (this.pose === 'idle' && rng.chance(0.3)) this.talk(rng.pick(IDLE_LINES), 1.2);
        }
        break;
    }
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
      sfx: 'result',
      onArrive: () => { this.delivered = true; wd.orca.flash(); },
    });
  }

  // ------------------------------------------------------------ update

  update(dt: number): void {
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
      const step = (this.running ? RUN : WALK) * this.speedMul * (this.mini ? 1.15 : 1) * dt;
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
    if (this.blinkT > 0) this.blinkT -= dt;
    else if ((this.blinkIn -= dt) <= 0) { this.blinkT = 0.13; this.blinkIn = this.wd.rng.range(2, 5.5); }

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
    if (this.z > 1) return 'jump';
    if (this.moving && !this.hovered) return 'walk';
    if (this.pose === 'idle' && this.blinkT > 0) return 'blink';
    return this.pose;
  }

  // ------------------------------------------------------------ render

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.scale;
    // floor shadow
    const sw = Math.max(2, this.w - 4 - Math.round(this.z * 0.3));
    ctx.fillStyle = rgba('#000000', 0.5);
    ctx.fillRect(Math.round(this.x - sw / 2), Math.round(this.y), sw, 1);

    let bob = 0;
    if (this.anim === 'walk' && !this.hasWalk) bob = (Math.floor(this.animT * (this.running ? 12 : 7)) & 1) * (this.mini ? 1 : s);
    const jx = this.jitter ? Math.round(Math.sin(this.t * 40) * this.jitter) : 0;
    const f = frameAt(this.id, this.anim, this.animT);
    drawSprite(ctx, this.id, this.anim, f, Math.round(this.x) + jx, Math.round(this.y - this.z) - bob, {
      flip: this.flip, scale: s, outline: this.hovered ? PAL.neonB : RIM,
    });

    if (this.carry) {
      const px = Math.round(this.x + this.dir * (this.w / 2 + 1));
      const py = Math.round(this.y - this.z - this.h * 0.4) - bob;
      ctx.fillStyle = rgba(this.carry === 'result' ? PAL.neonB : PAL.neonA, 0.3);
      ctx.fillRect(px - 3, py - 4, 7, 7);
      drawSprite(ctx, 'packet', this.carry, 0, px, py + 1);
    }
  }

  /** Low-res overlays: dizzy stars, zzz, progress bar, icon bubble. Drawn after all sprites. */
  renderOverlay(ctx: CanvasRenderingContext2D): void {
    const top = Math.round(this.top);
    if (this.dizzyT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 7 + (i * Math.PI * 2) / 3;
        const sx = Math.round(this.x + Math.cos(a) * (this.w * 0.45));
        const sy = Math.round(top - 2 + Math.sin(a) * 2);
        drawSprite(ctx, 'fx', 'star', 0, sx, sy + 2);
      }
    }
    if (this.sleeping) {
      for (let i = 0; i < 2; i++) {
        const k = (this.t * 0.5 + i * 0.5) % 1;
        drawSprite(ctx, 'icon', 'zzz', 0, Math.round(this.x + this.dir * 4 + k * 6), Math.round(top - 1 - k * 12), { alpha: 1 - k });
      }
    }
    const bar = this.bar;
    if (bar >= 0) {
      const bw = this.mini ? 8 : 14, bx = Math.round(this.x - bw / 2), by = top - 4;
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
    if (showLabel || this.hovered) {
      const lit = this.hovered, st = LABEL;
      st.size = lit ? 4.5 : 4; st.color = lit ? '#ffffff' : this.color;
      st.glow = lit ? this.color : null; st.alpha = lit ? 1 : 0.5;
      text.draw(this.name, this.x, this.y + 2, st);
    }
    if (this.say) {
      let ty = this.top - 2;
      if (this.bar >= 0) ty -= 5;
      if (this.icon) ty = this.iconBox().y - 2;
      const a = this.sayT < 0.2 ? this.sayT / 0.2 : 1;
      BUBBLE.alpha = a; BUBBLE.size = this.mini ? 4 : 4.5;
      text.bubble(this.say, this.x + this.dir * 3, ty, BUBBLE);
    }
  }
}

const RECEIVE_LINES = ['on it!', 'on it!', 'roger', 'got it', 'k!', 'wip'] as const;
const DONE_LINES = ['>_ done', '>_ done', 'shipped', 'PR up', 'done!', 'lgtm'] as const;
const IDLE_LINES = ['next?', 'ez', 'brb', ':)', 'hmm'] as const;
