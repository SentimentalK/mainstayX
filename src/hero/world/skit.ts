// Base class for a "skit": a short scripted scene that locks a few agents.
// Skits are small phase machines: step(dt) switches on `phase`, `pt` is the
// time spent in the current phase. The scheduler force-stops a skit after its
// def's timeout, and stop() always releases every actor and cleans up.
import type { TextLayer } from '../types';
import type { Agent, Owner } from './agent';
import type { World } from './world';

export abstract class Skit implements Owner {
  /** Seconds since start. */
  t = 0;
  /** Seconds in the current phase. */
  pt = 0;
  phase = 0;
  done = false;

  constructor(readonly name: string, protected w: World, readonly actors: Agent[]) {}

  start(): void {
    for (const a of this.actors) a.lock(this);
    this.begin();
  }

  protected begin(): void {}
  abstract step(dt: number): void;

  protected next(p = this.phase + 1): void { this.phase = p; this.pt = 0; }
  protected end(): void { this.done = true; }

  /** Called exactly once when the skit finishes or times out. */
  stop(): void {
    this.cleanup();
    for (const a of this.actors) if (a.owner === this) a.release();
  }

  protected cleanup(): void {}

  /** Props lying on the floor (under sprites). */
  renderFloor(_ctx: CanvasRenderingContext2D): void {}
  /** Things above sprites (flying props). */
  renderTop(_ctx: CanvasRenderingContext2D): void {}
  renderText(_text: TextLayer): void {}
}

export interface SkitDef {
  name: string;
  weight: number;
  /** Seconds before the same skit may run again. */
  cooldown: number;
  /** Hard limit; the skit is force-stopped after this many seconds. */
  timeout: number;
  /** Runs alone: needs an empty stage and blocks other skits + dispatching. */
  exclusive?: boolean;
  /** Pick actors, or null if the skit can't run right now. */
  cast(w: World): Agent[] | null;
  make(w: World, actors: Agent[]): Skit;
}
