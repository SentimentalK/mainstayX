// Portable workstations. An agent pulls a crate out of its pocket, tosses it
// on the floor, it unfolds into a desk of the agent's tool and up to four
// agents of that same tool work at it. Empty for a while → it folds back up
// and hops into a pocket (or poofs).
//
// Seats (feet positions, relative to the desk's bottom-centre `by`):
//   0 / 1  left / right end, on the floor at cx ∓ (w/2 + 10)   (2× agents first)
//   2 / 3  behind the desk at cx ∓ 17: a 2× agent stands at by-6 and is drawn
//          before the desk (it hides their legs); a 1× sub-agent hops onto the
//          desktop at by-14 and is drawn after it (see Agent.depth)
// A seat holds one agent; reserving it is the only way to get one, and only
// for an agent whose profile tool equals the desk's tool.
import type { CharacterId, TextLayer, TextStyle, ToolId } from '../types';
import { W } from '../types';
import { AGENTS } from '../data/agents';
import { PLATE_READY, STATION, STATION_LOOK, drawPocketCube, drawStation, platePos } from '../sprites/art/stations';
import { rgba } from '../engine/draw';
import { EDGE, FLOOR_BOT, FLOOR_TOP, ORCA_VIS, insideKeep, rectsOverlap, type Pt } from './layout';
import type { Agent, Owner } from './agent';
import type { World } from './world';

export const DESK_SEATS = 4;
/** End seats stand this far beyond the desk's end. */
const SIDE_GAP = 6;
/** Back seats: x from the centre; y above `by` for a 2× agent / a 1× one on the desktop. */
const BACK_DX = 17;
const BACK_DY = 6;
const TOP_DY = 14;
/** Room an end seat's agent gets beyond its feet (the widest 2× agent overlaps a neighbour by a few px at most). */
const BIG_HALF = 10;
/** Lowest desk baseline: names below the end seats stay clear of the stage's bottom edge. */
const MAX_BY = FLOOR_BOT - 8;
/** A loitering agent whose feet are this far behind a desk would vanish behind it: keep clear. */
const BEHIND = 22;
/** Half-width (+1) of the widest 2× agent: an end seat this close to the screen edge would get clamped. */
const EDGE_HALF = 15;
const RED = '#ff3d5a';

export type DeskState = 'pending' | 'toss' | 'unfold' | 'open' | 'fold' | 'pocket';

/** Half-width / extent of the floor area a desk claims (desk + its seated agents). */
export function plotHalf(): number { return STATION.w / 2 + SIDE_GAP + BIG_HALF; }
/** Feet x of the end seats, relative to the desk centre. */
export function sideOffset(): number { return STATION.w / 2 + SIDE_GAP; }
/** Top of the monitor (a tall agent standing behind may poke a few px above it). */
export function plotTop(by: number): number { return by - STATION.h - 1; }
export function plotBot(by: number): number { return by + 3; }

export class Desk {
  readonly seats: (Agent | null)[] = [null, null, null, null];
  state: DeskState = 'pending';
  /** 0 = crate, 1 = fully open (drawStation's unfold). */
  unfold = 0;
  t = 0;
  /** Seconds in the current state. */
  st = 0;
  emptyT = 0;
  /** Crate in flight: start, target, progress, duration, arc; fumble 1 = bonking off the thrower's head first. */
  sx = 0; sy = 0; tx = 0; ty = 0; fk = 0; fdur = 0.55; farc = 18; fumble = 0;
  /** Crate position while flying (render). */
  px = 0; py = 0;
  /** Bounce height and shake (skits, landing). */
  z = 0; vz = 0; jig = 0;
  /** A skit drives `unfold` by hand while set. */
  held: Owner | null = null;
  /** "wrong IDE" red flash, seconds left. */
  denyT = 0;
  pocketTo: Agent | null = null;

  constructor(
    readonly id: number, readonly tool: ToolId, readonly cx: number, readonly by: number,
    /** Who tosses the crate (null: it just appears). */
    public thrower: Agent | null,
    /** Whose pocket it goes back into (null: poofs, or the nearest agent of that tool). */
    public owner: Agent | null,
    public launchIn: number,
    readonly foldAfter: number,
  ) {}

  get occupants(): number { let n = 0; for (const s of this.seats) if (s) n++; return n; }
  /** Still takes reservations (not folding away). */
  get live(): boolean { return this.state !== 'fold' && this.state !== 'pocket'; }
  /** On the floor (unfolding or open). */
  get landed(): boolean { return this.state === 'unfold' || this.state === 'open'; }
  get label(): string { return STATION_LOOK[this.tool].label; }
}

export interface SeatRef { desk: Desk; i: number }

export class Desks {
  readonly list: Desk[] = [];
  private seq = 0;
  private tmp: Pt = { x: 0, y: 0 };
  private ref: SeatRef = { desk: null as unknown as Desk, i: 0 };
  private textStyle: TextStyle = { size: 4, color: '#fff', alpha: 0.9, shadow: '#0d0221', glow: null };
  private labelSize = new Map<ToolId, number>();

  constructor(private w: World) {}

  // ------------------------------------------------------------ geometry

  /** Feet position of seat i for an occupant that is small (1×, on the desktop) or not. */
  seatPos(d: Desk, i: number, out: Pt, small: boolean): Pt {
    const half = sideOffset();
    out.x = i === 0 ? d.cx - half : i === 1 ? d.cx + half : i === 2 ? d.cx - BACK_DX : d.cx + BACK_DX;
    out.y = i < 2 ? d.by : d.by - (small ? TOP_DY : BACK_DY);
    return out;
  }

  /** Is seat i a perch on the desktop for this occupant (drawn after the desk)? */
  onDesktop(i: number, small: boolean): boolean { return i >= 2 && small; }

  /** Seated agents face the desk (seats 0 and 2 face right). */
  seatFlip(i: number): boolean { return i === 1 || i === 3; }

  /** Could a desk go here? (inside the floor, off Orca, clear of every other desk's plot) */
  spotOk(cx: number, by: number, except: Desk | null = null): boolean {
    const hp = plotHalf(), top = plotTop(by), bot = plotBot(by);
    // an end-seat agent must fit on screen without being clamped off its seat
    const reach = Math.max(hp, sideOffset() + EDGE_HALF);
    if (cx - reach < EDGE || cx + reach > W - EDGE) return false;
    if (by - TOP_DY < FLOOR_TOP || by > MAX_BY) return false;
    if (rectsOverlap(cx - hp, top, hp * 2, bot - top, ORCA_VIS.x, ORCA_VIS.y, ORCA_VIS.w, ORCA_VIS.h)) return false;
    const hw = STATION.w / 2;
    for (let i = 0; i < 5; i++) {
      const x = i === 0 ? cx - hp : i === 1 ? cx - hw : i === 2 ? cx : i === 3 ? cx + hw : cx + hp;
      if (insideKeep(x, by - TOP_DY, 1.02) || insideKeep(x, by - BACK_DY, 1.02) || insideKeep(x, bot, 1.02)) return false;
    }
    for (const d of this.list) {
      if (d === except) continue;
      if (rectsOverlap(cx - hp, top, hp * 2, bot - top, d.cx - hp - 1, plotTop(d.by) - 1, hp * 2 + 2, plotBot(d.by) - plotTop(d.by) + 2)) return false;
    }
    return true;
  }

  /**
   * Nearest legal desk spot to (x, y), trying `prefer` first (e.g. so the
   * thrower's own seat is right where it stands). Writes into out; null if none within maxDist.
   */
  findSpot(x: number, y: number, out: Pt, prefer: readonly Pt[] = [], maxDist = Infinity): Pt | null {
    for (const p of prefer) {
      const cx = Math.round(p.x), by = Math.round(p.y);
      if (this.spotOk(cx, by)) { out.x = cx; out.y = by; return out; }
    }
    let best = Infinity;
    const hp = Math.ceil(Math.max(plotHalf(), sideOffset() + EDGE_HALF));
    for (let cx = EDGE + hp; cx <= W - EDGE - hp; cx += 4) {
      for (let by = FLOOR_TOP + TOP_DY; by <= MAX_BY; by += 3) {
        const d = Math.hypot(cx - x, (by - y) * 1.4);
        if (d >= best || d > maxDist || !this.spotOk(cx, by)) continue;
        best = d; out.x = cx; out.y = by;
      }
    }
    return best < Infinity ? out : null;
  }

  /** Feet inside some desk's plot (idle agents shouldn't stand on desks). */
  blocked(x: number, y: number, margin = 0): boolean {
    const hp = plotHalf() + margin;
    for (const d of this.list) {
      if (d.state === 'pending' || d.state === 'toss') continue;
      if (x > d.cx - hp && x < d.cx + hp && y > d.by - BEHIND - margin && y < plotBot(d.by) + margin) return true;
    }
    return false;
  }

  /** Nudge a loitering agent off any desk it's standing on (not its own). */
  nudge(a: Agent, dt: number): void {
    const hp = plotHalf() - 4;
    for (const d of this.list) {
      if (!d.landed || a.desk === d) continue;
      if (a.x <= d.cx - hp || a.x >= d.cx + hp || a.y <= d.by - BEHIND || a.y >= plotBot(d.by)) continue;
      a.x += (a.x < d.cx ? -1 : 1) * 20 * dt;
      a.y += (a.y < d.by - 6 ? -1 : 1) * 8 * dt;
    }
  }

  // ------------------------------------------------------------ seats

  /**
   * Best free seat for an agent of `tool` near (x, y). 2× agents prefer the
   * ends, 1× sub-agents the desktop. Considers desks still being thrown / unfolding too.
   */
  findSeat(tool: ToolId, x: number, y: number, radius: number, small: boolean): SeatRef | null {
    let best = Infinity, desk: Desk | null = null, seat = -1;
    for (const d of this.list) {
      if (d.tool !== tool || !d.live) continue;
      for (let i = 0; i < DESK_SEATS; i++) {
        if (d.seats[i]) continue;
        const p = this.seatPos(d, i, this.tmp, small);
        const dist = Math.hypot(p.x - x, p.y - y) + ((i < 2) === small ? 30 : 0);
        if (dist < best && dist < radius) { best = dist; desk = d; seat = i; }
      }
    }
    if (!desk) return null;
    this.ref.desk = desk; this.ref.i = seat;
    return this.ref;
  }

  /** The side seat of d nearest to (x, y), if free. */
  sideSeat(d: Desk, x: number): number {
    const pref = x < d.cx ? 0 : 1;
    if (!d.seats[pref]) return pref;
    return d.seats[1 - pref] ? -1 : 1 - pref;
  }

  reserve(d: Desk, i: number, a: Agent): boolean {
    if (d.seats[i] || AGENTS[a.id].tool !== d.tool) return false;
    this.leave(a);
    d.seats[i] = a;
    a.desk = d; a.seatI = i;
    d.emptyT = 0;
    return true;
  }

  leave(a: Agent): void {
    const d = a.desk;
    if (d && d.seats[a.seatI] === a) d.seats[a.seatI] = null;
    a.desk = null; a.seatI = -1;
  }

  // ------------------------------------------------------------ lifecycle

  create(tool: ToolId, cx: number, by: number, thrower: Agent | null, owner: Agent | null, launchIn: number): Desk {
    const d = new Desk(++this.seq, tool, cx, by, thrower, owner, launchIn, this.w.rng.range(3.5, 6.5));
    this.list.push(d);
    return d;
  }

  private launch(d: Desk): void {
    const a = d.thrower, w = this.w;
    d.state = 'toss'; d.st = 0; d.fk = 0;
    d.tx = d.cx; d.ty = d.by;
    if (a && w.has(a)) {
      d.sx = a.x + a.dir * (a.w / 2); d.sy = a.y - a.z - a.h * 0.5;
      a.throwT = 0.45;
      a.face(d.cx);
      // one toss in eight bonks the thrower on the head first
      d.fumble = !a.sub && w.rng.chance(0.12) ? 1 : 0;
      if (d.fumble) { d.tx = a.x; d.ty = a.top; d.fdur = 0.5; d.farc = 26; }
      else { d.fdur = Math.max(0.35, Math.min(0.7, Math.hypot(d.cx - d.sx, d.by - d.sy) / 120)); d.farc = 16; }
      w.sfx('pass', a.x, 0.3);
    } else {
      // no thrower around: the crate just drops in from above
      d.sx = d.cx; d.sy = d.by - 40; d.fdur = 0.45; d.farc = 0;
      w.fx.poof(d.cx, d.by - 30);
    }
    d.px = d.sx; d.py = d.sy;
  }

  private pocketTarget(d: Desk): Agent | null {
    const w = this.w;
    const ok = (a: Agent | null): a is Agent => !!a && w.has(a) && a.hidden <= 0 && !a.offline && AGENTS[a.id].tool === d.tool && a.dist(d.cx, d.by) < 200;
    if (ok(d.owner)) return d.owner;
    let best: Agent | null = null, bd = 150;
    for (const a of w.agents) if (ok(a) && a.dist(d.cx, d.by) < bd) { best = a; bd = a.dist(d.cx, d.by); }
    return best;
  }

  update(dt: number): void {
    const w = this.w;
    for (let k = this.list.length - 1; k >= 0; k--) {
      const d = this.list[k];
      d.t += dt; d.st += dt;
      if (d.denyT > 0) d.denyT -= dt;
      if (d.jig > 0) d.jig = Math.max(0, d.jig - dt * 3);
      if (d.z > 0 || d.vz > 0) {
        d.vz -= 320 * dt; d.z += d.vz * dt;
        if (d.z <= 0) { d.z = 0; d.vz = 0; }
      }
      switch (d.state) {
        case 'pending':
          if ((d.launchIn -= dt) <= 0 && !(d.thrower && w.has(d.thrower) && d.thrower.hidden > 0)) this.launch(d);
          break;
        case 'toss': {
          d.fk = Math.min(1, d.fk + dt / d.fdur);
          const k2 = d.fk;
          d.px = d.sx + (d.tx - d.sx) * k2;
          d.py = d.sy + (d.ty - d.sy) * k2 - Math.sin(Math.PI * k2) * d.farc;
          if (k2 < 1) break;
          if (d.fumble === 1) {
            const a = d.thrower;
            if (a && w.has(a)) { a.dizzyT = 1; a.talk('ow', 0.9); a.hop(30); }
            w.sfx('bump', d.px, 0.4);
            w.fx.impact(d.px, d.py);
            d.fumble = 2; d.fk = 0; d.sx = d.px; d.sy = d.py; d.tx = d.cx; d.ty = d.by; d.farc = 14;
            d.fdur = Math.max(0.35, Math.hypot(d.cx - d.sx, d.by - d.sy) / 110);
            break;
          }
          d.state = 'unfold'; d.st = 0; d.unfold = 0;
          d.vz = 40; d.z = 0.01;
          w.fx.dust(d.cx - 4, d.by, -1, 3); w.fx.dust(d.cx + 4, d.by, 1, 3);
          w.sfx('drop', d.cx, 0.35);
          break;
        }
        case 'unfold':
          if (!d.held && d.st > 0.25) d.unfold = Math.min(1, d.unfold + dt / 0.55);
          if (d.unfold >= 1) {
            d.state = 'open'; d.st = 0;
            w.fx.glint(d.cx, d.by - STATION.h + 6, STATION_LOOK[d.tool].trim, 5);
            w.sfx('blip', d.cx, 0.3);
          }
          break;
        case 'open':
          if (d.held) break;
          if (d.occupants === 0) {
            if ((d.emptyT += dt) > d.foldAfter) { d.state = 'fold'; d.st = 0; w.sfx('pass', d.cx, 0.2); }
          } else d.emptyT = 0;
          break;
        case 'fold':
          d.unfold = Math.max(0, d.unfold - dt / 0.4);
          if (d.unfold <= 0) { d.state = 'pocket'; d.st = 0; d.fk = 0; d.pocketTo = null; }
          break;
        case 'pocket': {
          if (d.st < 0.3) break;
          if (!d.pocketTo) {
            d.pocketTo = this.pocketTarget(d);
            if (!d.pocketTo) { w.fx.poof(d.cx, d.by - 3); w.sfx('poof', d.cx, 0.3); this.list.splice(k, 1); break; }
            d.sx = d.cx; d.sy = d.by - 3; d.fk = 0; d.farc = 16;
            d.fdur = Math.max(0.35, Math.min(0.8, d.pocketTo.dist(d.cx, d.by) / 130));
          }
          const a = d.pocketTo;
          if (!w.has(a)) { w.fx.poof(d.px, d.py); this.list.splice(k, 1); break; }
          d.fk = Math.min(1, d.fk + dt / d.fdur);
          const hx = a.x + a.dir * (a.w / 2 - 2), hy = a.y - a.z - a.h * 0.45;
          d.px = d.sx + (hx - d.sx) * d.fk;
          d.py = d.sy + (hy - d.sy) * d.fk - Math.sin(Math.PI * d.fk) * d.farc;
          if (d.fk >= 1) {
            w.fx.glint(hx, hy, STATION_LOOK[d.tool].trim, 3);
            w.sfx('blip', hx, 0.25, true, 5);
            if (!a.locked && a.brain === 'idle' && w.rng.chance(0.3)) a.talk(w.rng.pick(POCKET_LINES), 0.9);
            this.list.splice(k, 1);
          }
          break;
        }
      }
    }
    // depth order for rendering (insertion sort, nearly sorted)
    const l = this.list;
    for (let i = 1; i < l.length; i++) {
      const v = l[i];
      let j = i - 1;
      while (j >= 0 && l[j].by > v.by) { l[j + 1] = l[j]; j--; }
      l[j + 1] = v;
    }
  }

  /** Force a desk away right now (scene exit, tests). */
  clear(): void {
    for (const d of this.list) for (const a of d.seats) if (a) this.leave(a);
    this.list.length = 0;
  }

  // ------------------------------------------------------------ render

  /** Shadows of crates in flight (under sprites). */
  renderFloor(c: CanvasRenderingContext2D): void {
    for (const d of this.list) {
      if (d.state !== 'toss' && !(d.state === 'pocket' && d.pocketTo)) continue;
      const k = d.fk, fy = d.state === 'toss' && d.fumble !== 1 ? d.sy + (d.by - d.sy) * k : d.by;
      c.fillStyle = rgba('#000000', 0.4);
      c.fillRect(Math.round(d.px) - 3, Math.round(Math.max(fy, d.py + 4)), 6, 1);
    }
  }

  /** One desk, in depth order with the agents. */
  render(c: CanvasRenderingContext2D, d: Desk): void {
    if (d.state === 'pending' || d.state === 'toss' || (d.state === 'pocket' && d.pocketTo)) return;
    const cx = Math.round(d.cx + (d.jig > 0 ? Math.sin(d.t * 50) * d.jig * 1.5 : 0)), by = Math.round(d.by - d.z);
    if (d.state === 'pocket') { drawPocketCube(c, d.tool, cx, by, d.t); return; }
    let busy = false;
    for (const a of d.seats) if (a && a.atDesk) busy = true;
    // floor shadow
    c.fillStyle = rgba('#000000', 0.35);
    c.fillRect(Math.round(d.cx - STATION.w / 2) + 1, Math.round(d.by), STATION.w - 2, 1);
    drawStation(c, d.tool, cx, by, { unfold: d.unfold, t: d.t, busy });
    if (d.denyT > 0) {
      const a = Math.min(1, d.denyT / 0.3) * (0.35 + 0.25 * Math.sin(d.t * 30));
      c.fillStyle = rgba(RED, Math.max(0, a));
      c.fillRect(Math.round(d.cx - STATION.w / 2), by - STATION.h, STATION.w, STATION.h);
    }
  }

  /** Crates in the air (above sprites). */
  renderTop(c: CanvasRenderingContext2D): void {
    for (const d of this.list) {
      if (d.state !== 'toss' && !(d.state === 'pocket' && d.pocketTo)) continue;
      drawPocketCube(c, d.tool, Math.round(d.px), Math.round(d.py) + 3, d.t);
    }
  }

  /** Nameplates on the text layer. */
  renderText(t: TextLayer): void {
    const st = this.textStyle;
    for (const d of this.list) {
      if (!d.landed || d.unfold < PLATE_READY) continue;
      const look = STATION_LOOK[d.tool];
      const p = platePos(d.tool, d.cx, d.by - d.z);
      st.size = this.fit(t, d.tool);
      st.color = look.trim;
      st.alpha = Math.min(0.95, 0.4 + (d.unfold - PLATE_READY) * 2);
      t.draw(look.label, p.x, p.y, st);
    }
  }

  /** Label size that fits the nameplate (≤ 4). */
  private fit(t: TextLayer, tool: ToolId): number {
    let s = this.labelSize.get(tool);
    if (s === undefined) {
      const room = STATION.w - 6, m = t.measure(STATION_LOOK[tool].label, 4);
      s = m > room ? Math.max(3, (4 * room) / m) : 4;
      this.labelSize.set(tool, s);
    }
    return s;
  }

  debug(): unknown[] {
    return this.list.map(d => ({
      id: d.id, tool: d.tool, x: d.cx, y: d.by, state: d.state,
      seats: d.seats.map(a => (a ? a.id as CharacterId : null)),
    }));
  }
}

const POCKET_LINES = ['*pocket*', 'tidy!', 'mine'] as const;
