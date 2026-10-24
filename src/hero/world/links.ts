// Connection lines and packets in flight. Hub links (Orca ↔ agent) are always
// drawn dimly; peer links (agent ↔ agent) appear while a message travels.
// A link lights up and its dashes crawl in the direction of travel while a
// packet rides it. Packets are pooled.
import type { SfxName } from '../types';
import { PAL } from '../data/theme';
import { drawSprite } from '../sprites/render';
import { line, rgba } from '../engine/draw';
import type { Fx } from './fx';

/** Anything a line or packet can attach to (its hub point). */
export interface Anchor { hx: number; hy: number }

export type PacketKind = 'task' | 'result' | 'open';

interface Link { on: boolean; a: Anchor; b: Anchor; heat: number; phase: number; dir: number; hub: boolean; busy: number }

interface Packet {
  on: boolean; kind: PacketKind; from: Anchor; to: Anchor;
  sx: number; sy: number; t: number; dur: number; arc: number;
  x: number; y: number; link: Link | null; sfx: SfxName | null;
  onArrive: (() => void) | null;
  /** 0 small, 1 medium, 2 large job. */
  big: number; trail: number;
}

export interface SendOpts {
  /** Arc height in px (0 = straight along the line). */
  arc?: number;
  /** px/s (default 110). */
  speed?: number;
  /** Arrival sfx (default 'deliver'; null = silent). */
  sfx?: SfxName | null;
  /** Job size: 0 small (default), 1 medium (glow), 2 large (double size, glowing, sparkle trail). */
  size?: number;
  onArrive?: () => void;
}

const PACKET_CAP = 28;
const PEER_CAP = 14;

export class Links {
  private hubs: Link[] = [];
  private peers: Link[] = [];
  private packets: Packet[] = [];
  private time = 0;

  constructor(
    private hub: Anchor,
    private fx: Fx,
    private sfx: (name: SfxName, x: number, vol?: number) => void,
  ) {
    for (let i = 0; i < PEER_CAP; i++) this.peers.push(blankLink());
    for (let i = 0; i < PACKET_CAP; i++)
      this.packets.push({ on: false, kind: 'task', from: hub, to: hub, sx: 0, sy: 0, t: 0, dur: 1, arc: 0, x: 0, y: 0, link: null, sfx: null, onArrive: null, big: 0, trail: 0 });
  }

  addHub(a: Anchor): void {
    this.hubs.push({ on: true, a: this.hub, b: a, heat: 0, phase: 0, dir: 1, hub: true, busy: 0 });
  }

  get inFlight(): number { let n = 0; for (const p of this.packets) if (p.on) n++; return n; }

  /** Is a packet currently travelling to or from this anchor? */
  busyWith(a: Anchor): boolean {
    for (const p of this.packets) if (p.on && (p.to === a || p.from === a)) return true;
    return false;
  }

  send(kind: PacketKind, from: Anchor, to: Anchor, o: SendOpts = {}): boolean {
    let p: Packet | undefined;
    for (const q of this.packets) if (!q.on) { p = q; break; }
    if (!p) { o.onArrive?.(); return false; } // pool exhausted: resolve immediately, never strand callers
    const dist = Math.hypot(to.hx - from.hx, to.hy - from.hy);
    p.on = true; p.kind = kind; p.from = from; p.to = to;
    p.sx = from.hx; p.sy = from.hy; p.t = 0;
    p.big = o.size ?? 0; p.trail = 0;
    // heavier packets travel a bit slower
    p.dur = Math.min(2.4, Math.max(0.35, dist / ((o.speed ?? 110) * (p.big === 2 ? 0.75 : p.big === 1 ? 0.88 : 1))));
    p.arc = o.arc ?? 0;
    p.sfx = o.sfx === undefined ? 'deliver' : o.sfx;
    p.onArrive = o.onArrive ?? null;
    p.x = p.sx; p.y = p.sy;
    p.link = this.linkFor(from, to);
    if (p.link) { p.link.busy++; p.link.dir = p.link.a === from ? 1 : -1; }
    return true;
  }

  private linkFor(from: Anchor, to: Anchor): Link | null {
    for (const l of this.hubs) if ((l.a === from && l.b === to) || (l.a === to && l.b === from)) return l;
    if (from === this.hub || to === this.hub) return null;
    for (const l of this.peers) if (l.on && ((l.a === from && l.b === to) || (l.a === to && l.b === from))) return l;
    let slot: Link | undefined;
    for (const l of this.peers) if (!l.on) { slot = l; break; }
    if (!slot) {
      for (const l of this.peers) if (!l.busy && (!slot || l.heat < slot.heat)) slot = l;
      if (!slot) return null;
    }
    slot.on = true; slot.a = from; slot.b = to; slot.heat = 0; slot.phase = 0; slot.busy = 0; slot.hub = false;
    return slot;
  }

  /** Drop everything attached to an anchor (e.g. a mini that disappears). */
  forget(a: Anchor): void {
    for (const p of this.packets) if (p.on && (p.to === a || p.from === a)) this.arrive(p, false);
    for (const l of this.peers) if (l.on && (l.a === a || l.b === a)) { l.on = false; l.busy = 0; }
  }

  update(dt: number): void {
    for (const p of this.packets) {
      if (!p.on) continue;
      p.t += dt / p.dur;
      if (p.t >= 1) { this.arrive(p, true); continue; }
      const k = p.t, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      p.x = p.sx + (p.to.hx - p.sx) * e;
      p.y = p.sy + (p.to.hy - p.sy) * e - Math.sin(Math.PI * k) * p.arc;
      if (p.big && (p.trail -= dt) <= 0) {
        p.trail = p.big === 2 ? 0.03 : 0.08;
        this.fx.emit(p.x, p.y, 0, 0, p.big === 2 ? 0.45 : 0.3, p.big === 2 && (p.t * 20) % 2 < 1 ? '#ffffff' : p.kind === 'result' ? PAL.neonB : PAL.neonA, 0, 1, p.big);
      }
    }
    this.time += dt;
    for (const l of this.hubs) this.cool(l, dt);
    for (const l of this.peers) {
      if (!l.on) continue;
      this.cool(l, dt);
      if (!l.busy && l.heat <= 0) l.on = false;
    }
  }

  private cool(l: Link, dt: number): void {
    if (l.busy > 0) { l.heat = Math.min(1, l.heat + dt * 6); l.phase -= l.dir * dt * 18; }
    else if (l.heat > 0) { l.heat = Math.max(0, l.heat - dt * 1.4); l.phase -= l.dir * dt * 18 * l.heat; }
  }

  private arrive(p: Packet, live: boolean): void {
    p.on = false;
    if (p.link) p.link.busy = Math.max(0, p.link.busy - 1);
    p.link = null;
    if (live) {
      const c = p.kind === 'result' ? PAL.neonB : PAL.neonA;
      this.fx.ring(p.to.hx, p.to.hy, 1, 7 + p.big * 6, 0.3 + p.big * 0.15, c, 1);
      this.fx.glint(p.to.hx, p.to.hy, c, 3 + p.big * 4);
      if (p.big === 2) this.fx.confetti(p.to.hx, p.to.hy, 6);
      if (p.sfx) this.sfx(p.sfx, p.to.hx);
    }
    const cb = p.onArrive;
    p.onArrive = null;
    cb?.();
  }

  renderLines(ctx: CanvasRenderingContext2D): void {
    for (const l of this.hubs) drawLink(ctx, l, PAL.neonA, 0.3);
    for (const l of this.peers) if (l.on) drawLink(ctx, l, PAL.neonB, 0);
  }

  renderPackets(ctx: CanvasRenderingContext2D): void {
    for (const p of this.packets) if (p.on) drawPacket(ctx, p.kind, Math.round(p.x), Math.round(p.y) + 2, p.big, this.time);
  }
}

function blankLink(): Link {
  const z = { hx: 0, hy: 0 };
  return { on: false, a: z, b: z, heat: 0, phase: 0, dir: 1, hub: false, busy: 0 };
}

function drawLink(ctx: CanvasRenderingContext2D, l: Link, c: string, base: number): void {
  const a = base + (1 - base) * l.heat;
  if (a <= 0.02) return;
  ctx.globalAlpha = a;
  line(ctx, l.a.hx, l.a.hy, l.b.hx, l.b.hy, c, l.hub ? 2 : 1, l.phase);
  if (l.heat > 0.3) {
    // bright core while active
    ctx.globalAlpha = l.heat * 0.35;
    line(ctx, l.a.hx, l.a.hy + 1, l.b.hx, l.b.hy + 1, c, l.hub ? 2 : 1, l.phase);
  }
  ctx.globalAlpha = 1;
}

/** A packet (task / result) whose feet are at (x, y); bigger and glowier for bigger jobs. */
export function drawPacket(ctx: CanvasRenderingContext2D, kind: PacketKind, x: number, y: number, big: number, t: number): void {
  const c = kind === 'result' ? PAL.neonB : PAL.neonA;
  if (big >= 2) {
    const k = 0.35 + 0.2 * Math.sin(t * 9);
    ctx.fillStyle = rgba(c, k * 0.7);
    ctx.fillRect(x - 8, y - 13, 17, 17);
    ctx.fillStyle = rgba('#ffffff', k * 0.45);
    ctx.fillRect(x - 6, y - 11, 13, 13);
    drawSprite(ctx, 'packet', kind, 0, x, y + 1, { scale: 2, outline: '#ffffff' });
  } else if (big === 1) {
    ctx.fillStyle = rgba(c, 0.32 + 0.15 * Math.sin(t * 7));
    ctx.fillRect(x - 5, y - 8, 11, 11);
    drawSprite(ctx, 'packet', kind, 0, x, y, { outline: '#ffffff' });
  } else {
    ctx.fillStyle = rgba(c, 0.3);
    ctx.fillRect(x - 3, y - 5, 7, 7);
    drawSprite(ctx, 'packet', kind, 0, x, y);
  }
}
