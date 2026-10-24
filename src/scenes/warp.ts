// PLACEHOLDER scene — replaced by its module owner (see docs/PLAN.md).
import type { Gfx, Scene, SceneContext } from '../types';
import { W, H } from '../types';

export function createWarpScene(): Scene {
  let t = 0;
  let ctx!: SceneContext;
  return {
    enter(c) { ctx = c; void ctx; },
    update(dt) { t += dt; },
    render(g: Gfx) {
      g.ctx.fillStyle = '#120428';
      g.ctx.fillRect(0, 0, W, H);
      g.text.draw('warp (placeholder) ' + t.toFixed(1), W / 2, H / 2, { size: 6, color: '#ff4fd8' });
    },
  };
}
