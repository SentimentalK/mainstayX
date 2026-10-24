// Random event director: weighted pick among skits that are off cooldown,
// with a global gap between starts, at most 2 running at once (the second
// only sometimes), and a staleness boost so every skit gets its turn.
import type { Rng } from '../types';
import type { Skit, SkitDef } from './skit';
import type { World } from './world';

const MAX_ACTIVE = 2;
const LOG_CAP = 24;

export class Scheduler {
  readonly active: Skit[] = [];
  private defOf = new Map<Skit, SkitDef>();
  readonly counts: Record<string, number> = {};
  private last: Record<string, number> = {};
  private nextAt = 2.5;
  private time = 0;
  /** Recent starts, newest last (bounded). */
  readonly log: string[] = [];
  get names(): string[] { return this.defs.map(d => d.name); }
  private pool: SkitDef[] = [];

  constructor(private defs: readonly SkitDef[], private rng: Rng) {
    for (const d of defs) { this.counts[d.name] = 0; this.last[d.name] = -1e9; }
  }

  get exclusive(): boolean {
    for (const s of this.active) if (this.defOf.get(s)?.exclusive) return true;
    return false;
  }

  update(dt: number, w: World): void {
    this.time += dt;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      const def = this.defOf.get(s)!;
      s.t += dt; s.pt += dt;
      if (!s.done) s.step(dt);
      if (s.done || s.t > def.timeout) {
        s.stop();
        this.active.splice(i, 1);
        this.defOf.delete(s);
      }
    }
    if (this.time < this.nextAt || this.active.length >= MAX_ACTIVE || this.exclusive) return;
    if (this.active.length > 0 && !this.rng.chance(0.4)) { this.nextAt = this.time + this.rng.range(2, 4); return; }
    this.trigger(w);
  }

  /** Try to start a skit now (optionally a specific one). Returns its name or null. */
  trigger(w: World, only?: string): string | null {
    const pool = this.pool;
    pool.length = 0;
    for (const d of this.defs) {
      if (only ? d.name !== only : this.time - this.last[d.name] < d.cooldown) continue;
      if (d.exclusive && this.active.length > 0) continue;
      pool.push(d);
    }
    while (pool.length) {
      let sum = 0;
      for (const d of pool) sum += this.weight(d);
      let r = this.rng.range(0, sum), k = 0;
      for (; k < pool.length - 1; k++) { r -= this.weight(pool[k]); if (r <= 0) break; }
      const def = pool[k];
      const actors = def.cast(w);
      if (actors) {
        const s = def.make(w, actors);
        this.active.push(s);
        this.defOf.set(s, def);
        s.start();
        this.counts[def.name]++;
        this.last[def.name] = this.time;
        this.log.push(def.name);
        if (this.log.length > LOG_CAP) this.log.shift();
        this.nextAt = this.time + this.rng.range(4.5, 8);
        return def.name;
      }
      pool.splice(k, 1);
    }
    this.nextAt = this.time + 1;
    return null;
  }

  private weight(d: SkitDef): number {
    const since = this.time - this.last[d.name];
    return d.weight * (1 + Math.min(2.5, Math.max(0, since - d.cooldown) / 60));
  }

  /** Force-stop everything (scene exit). */
  clear(): void {
    for (const s of this.active) s.stop();
    this.active.length = 0;
    this.defOf.clear();
  }
}
