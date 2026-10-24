// WORLD scene: the busy little agent office around Orca. All logic lives in
// src/hero/world/** — this file only adapts World to the Scene interface.
import type { CharacterId, Gfx, Scene, SceneContext } from '../types';
import { STEP } from '../types';
import type { JobSize } from '../world/jobs';
import { World } from '../world/world';

/** Dev / ?debug=1 hooks for tests, on window.__mxWorld. */
export interface WorldHooks {
  /** Start a skit now (by name); returns its name or null if it can't cast. */
  trigger(name: string): string | null;
  /** Invariant violations right now ([] = fine). */
  audit(): string[];
  /** Hand a job of this size to `id` (or anyone who can take it); returns who got it. */
  job(size: JobSize, id?: CharacterId): CharacterId | null;
  /** Send an idle agent offline now. */
  offline(id: CharacterId): boolean;
  /** Skit names the scheduler knows. */
  skits(): string[];
}

export function createWorldScene(): Scene {
  let world: World | null = null;
  return {
    enter(ctx: SceneContext) {
      const w = (world = new World(ctx));
      // Don't open on the same tableau every visit: start somewhere in the middle of things.
      w.preroll(ctx.rng.range(6, 20), STEP);
      ctx.audio.music(true);
      if (import.meta.env.DEV || ctx.params.debug) {
        const hooks: WorldHooks = {
          trigger: name => w.scheduler.trigger(w, name),
          audit: () => w.audit(),
          job: (size, id) => w.forceJob(size, id),
          offline: id => w.agent(id)?.forceOffline() ?? false,
          skits: () => w.scheduler.names,
        };
        (window as unknown as { __mxWorld: WorldHooks }).__mxWorld = hooks;
      }
    },
    update(dt: number) { world?.update(dt); },
    render(g: Gfx) { world?.render(g); },
    exit() { world?.exit(); world = null; },
    pointerDown(x: number, y: number) { world?.pointerDown(x, y); },
    debug() { return world?.debug() ?? null; },
  };
}
