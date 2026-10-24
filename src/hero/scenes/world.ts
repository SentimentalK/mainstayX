// WORLD scene: the busy little agent office around Orca. All logic lives in
// src/world/** — this file only adapts World to the Scene interface.
import type { Gfx, Scene, SceneContext } from '../types';
import { World } from '../world/world';

export function createWorldScene(): Scene {
  let world: World | null = null;
  return {
    enter(ctx: SceneContext) {
      const w = (world = new World(ctx));
      ctx.audio.music(true);
      // Dev / ?debug=1 hook for tests: window.__mxWorld.trigger('nap') starts a skit now.
      if (import.meta.env.DEV || ctx.params.debug)
        (window as unknown as { __mxWorld: unknown }).__mxWorld = { trigger: (name: string) => w.scheduler.trigger(w, name) };
    },
    update(dt: number) { world?.update(dt); },
    render(g: Gfx) { world?.render(g); },
    exit() { world?.exit(); world = null; },
    pointerDown(x: number, y: number) { world?.pointerDown(x, y); },
    debug() { return world?.debug() ?? null; },
  };
}
