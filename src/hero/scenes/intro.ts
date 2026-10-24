// INTRO scene: DOOR → KNOCK → OPEN → GREET, then hands over to `warp`.
//  DOOR   synthwave backdrop, neon door + MAINSTAY_X sign, blinking hint.
//  KNOCK  each click shakes the door, pops a KNOCK!, 3rd knock opens it.
//  OPEN   leaves slide apart, light floods out, cone on the ground.
//  GREET  Clawd walks out, waves, says HI!, hops, walks back in → warp.
import type { Gfx, Scene, SceneContext } from '../types';
import { PAL } from '../data/theme';
import { Particles } from '../engine/particles';
import { disc } from '../engine/draw';
import { clamp, easeInOutCubic, easeInOutQuad, easeOutBack, easeOutQuad, progress } from '../engine/ease';
import { drawSprite, frameAt, hasAnim } from '../sprites/render';
import { Backdrop } from './intro/backdrop';
import { Door, type DoorState } from './intro/door';
import {
  BACKDROP_SALT, DOOR_CX, DOOR_HIT, DOOR_W, DOOR_Y, GROUND, SIGN_TEXT, SIGN_TEXT_Y,
} from './intro/layout';

type State = 'DOOR' | 'KNOCK' | 'OPEN' | 'GREET';

// ---- timings (s)
const KNOCKS = 3;
const POP_LIFE = 0.8;
const DOOR_SHAKE = 0.2;
const OPEN_DELAY = 0.35; // after the 3rd knock, let its KNOCK! land
const OPEN_DUR = 0.9;
const OPEN_HOLD = 0.3;
// GREET timeline
const G_OUT = 0.9;      // walk out until
const G_WAVE = 1.05;    // start waving + HI!
const G_HOP0 = 1.75, G_HOP1 = 2.05;
const G_TURN = 2.45;    // turn around
const G_BACK = 2.65;    // start walking back
const G_IN = 3.45;      // back inside
const G_END = 3.55;     // → warp
const WALK_DY = 14;

const SCALE = 2;
const LIGHT = [PAL.inside0, PAL.inside1, PAL.inside1, '#fff3b0'] as const;
const SPARK = [PAL.neonA, PAL.frameHi, '#ffffff'] as const;
const DUST = [PAL.doorHi, PAL.frameHi, PAL.far] as const;

interface Pop { on: boolean; x: number; y: number; rot: number; size: number; t: number }

export function createIntroScene(): Scene {
  let ctx!: SceneContext;
  let backdrop!: Backdrop;
  let door!: Door;
  let parts!: Particles;
  let state: State = 'DOOR';
  let t = 0;        // scene time
  let st = 0;       // time in current state
  let knocks = 0;
  let openAt = -1;  // scene time at which the door starts opening
  let lightAcc = 0;
  let side = 1;
  let cursor: 'default' | 'pointer' = 'default';
  let flickerNext = 5, flickerLeft = 0;
  let greeted = false;
  const ds: DoorState = { open: 0, knocks: 0, flash: 0, shakeX: 0, t: 0 };
  let shakeLeft = 0;
  const pops: Pop[] = [];
  for (let i = 0; i < 6; i++) pops.push({ on: false, x: 0, y: 0, rot: 0, size: 10, t: 0 });

  const go = (s: State) => {
    state = s; st = 0;
    ctx.setPhase(s);
  };

  const setCursor = (c: 'default' | 'pointer') => {
    if (c !== cursor) { cursor = c; ctx.setCursor(c); }
  };

  function knock(): void {
    const r = ctx.rng;
    knocks++;
    if (state === 'DOOR') go('KNOCK');
    ctx.audio.unlock();
    ctx.audio.sfx('knock', { detune: r.range(-1.2, 1.2), pan: r.range(-0.15, 0.15) });
    ctx.shake(1, 0.12);
    shakeLeft = DOOR_SHAKE;
    ds.flash = 1;
    // KNOCK! popup, alternating sides of the door
    side = knocks === 1 ? (r.chance(0.5) ? 1 : -1) : -side;
    let p = pops[0];
    for (const q of pops) if (!q.on) { p = q; break; }
    p.on = true; p.t = 0;
    p.x = DOOR_CX + side * r.range(32, 64);
    p.y = r.range(80, 126);
    p.rot = (r.range(-15, 15) * Math.PI) / 180;
    p.size = r.range(9, 12);
    // sparks off the door + dust at its foot
    const n = ctx.reducedMotion ? 3 : 8;
    for (let i = 0; i < n; i++) {
      parts.emit({
        x: DOOR_CX + side * r.range(6, 16), y: DOOR_Y + r.range(22, 38),
        vx: side * r.range(20, 70), vy: r.range(-60, -10),
        life: r.range(0.25, 0.5), color: r.pick(SPARK), gravity: 160, drag: 0.3,
      });
      parts.emit({
        x: DOOR_CX + r.range(-DOOR_W / 2, DOOR_W / 2), y: GROUND - 1,
        vx: r.range(-18, 18), vy: r.range(-14, -3),
        life: r.range(0.4, 0.8), color: r.pick(DUST), gravity: 20, drag: 0.4,
      });
    }
    if (knocks >= KNOCKS) { openAt = t + OPEN_DELAY; setCursor('default'); }
  }

  function emitLight(dt: number): void {
    const r = ctx.rng;
    lightAcc += dt * (ctx.reducedMotion ? 8 : 30) * Math.min(1, ds.open * 1.5);
    const gap = DOOR_W * ds.open;
    while (lightAcc >= 1) {
      lightAcc -= 1;
      const x = DOOR_CX + r.range(-gap / 2, gap / 2);
      parts.emit({
        x, y: r.range(DOOR_Y + 4, GROUND - 2),
        vx: (x - DOOR_CX) * r.range(0.8, 2) + r.range(-6, 6), vy: r.range(-16, -3),
        life: r.range(0.8, 1.6), color: r.pick(LIGHT), drag: 0.55,
      });
    }
  }

  return {
    enter(c) {
      ctx = c;
      backdrop = new Backdrop(c.rng.fork(BACKDROP_SALT), c.reducedMotion);
      door = new Door();
      parts = new Particles(c.reducedMotion ? 120 : 260);
      flickerNext = c.rng.range(4, 8);
    },

    update(dt) {
      t += dt; st += dt;
      backdrop.update(dt);
      parts.update(dt);
      ds.t = t;
      ds.knocks = knocks;
      ds.flash = Math.max(0, ds.flash - dt * 4);
      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        const k = shakeLeft / DOOR_SHAKE;
        ds.shakeX = Math.round(Math.sin(shakeLeft * 90) * 2 * k);
      } else ds.shakeX = 0;
      for (const p of pops) if (p.on && (p.t += dt) >= POP_LIFE) p.on = false;
      // neon sign flicker
      if (flickerLeft > 0) flickerLeft -= dt;
      else if ((flickerNext -= dt) <= 0) { flickerLeft = 0.3; flickerNext = ctx.rng.range(5, 10); }

      if ((state === 'DOOR' || state === 'KNOCK') && knocks < KNOCKS) {
        const pt = ctx.pointer;
        const over = pt.inside && pt.x >= DOOR_HIT.x && pt.x < DOOR_HIT.x + DOOR_HIT.w && pt.y >= DOOR_HIT.y && pt.y < DOOR_HIT.y + DOOR_HIT.h;
        setCursor(over ? 'pointer' : 'default');
      }

      if (state === 'KNOCK' && openAt >= 0 && t >= openAt) {
        go('OPEN');
        ctx.audio.sfx('doorOpen');
        ctx.shake(1, 0.3);
      } else if (state === 'OPEN') {
        ds.open = easeInOutCubic(progress(st, 0, OPEN_DUR));
        emitLight(dt);
        if (st >= OPEN_DUR + OPEN_HOLD) go('GREET');
      } else if (state === 'GREET') {
        ds.open = 1;
        emitLight(dt);
        if (!greeted && st >= G_WAVE) { greeted = true; ctx.audio.sfx('greet'); }
        if (st >= G_END) ctx.goto('warp');
      }
    },

    render(g: Gfx) {
      const c = g.ctx;
      backdrop.render(c);
      door.render(c, ds);

      // Clawd
      if (state === 'GREET') {
        const s = st;
        let anim = 'idle', fr = 0, by = GROUND, sil = 0, a = 1, flip = false, bob = 0;
        if (s < G_OUT) {
          anim = 'walk'; fr = frameAt('clawd', 'walk', s);
          by = GROUND + WALK_DY * easeOutQuad(s / G_OUT);
          sil = 1 - progress(s, 0.05, 0.6);
        } else if (s < G_WAVE) {
          by = GROUND + WALK_DY; fr = frameAt('clawd', 'idle', s);
        } else if (s < G_TURN) {
          by = GROUND + WALK_DY;
          if (s >= G_HOP0 && s < G_HOP1) {
            anim = 'jump'; fr = frameAt('clawd', 'jump', s - G_HOP0);
            bob = -Math.round(7 * Math.sin(Math.PI * progress(s, G_HOP0, G_HOP1)));
          } else { anim = 'wave'; fr = frameAt('clawd', 'wave', s - G_WAVE); }
        } else {
          const back = hasAnim('clawd', 'back');
          if (s < G_BACK) {
            anim = back ? 'back' : 'idle'; flip = !back; by = GROUND + WALK_DY; fr = 0;
          } else {
            const p = progress(s, G_BACK, G_IN);
            anim = back ? 'back' : 'walk'; flip = !back;
            fr = frameAt('clawd', anim, s - G_BACK);
            by = GROUND + WALK_DY * (1 - easeInOutQuad(p));
            if (back) bob = Math.floor((s - G_BACK) * 8) % 2 ? -1 : 0;
            sil = progress(s, G_IN - 0.45, G_IN);
            a = 1 - progress(s, G_IN - 0.15, G_END);
          }
        }
        by = Math.round(by);
        if (a > 0) {
          const prev = c.globalAlpha;
          c.globalAlpha = prev * a * 0.4 * (1 - sil);
          disc(c, DOOR_CX, by, 9, 1.5, '#000000');
          c.globalAlpha = prev;
          const box = drawSprite(c, 'clawd', anim, fr, DOOR_CX, by + bob, { scale: SCALE, flip, alpha: a });
          if (sil > 0) drawSprite(c, 'clawd', anim, fr, DOOR_CX, by + bob, { scale: SCALE, flip, solid: PAL.frame, alpha: a * sil });
          if (s >= G_WAVE && s < G_TURN) {
            const k = progress(s, G_WAVE, G_WAVE + 0.12);
            const lift = Math.round((1 - easeOutBack(k)) * 3);
            g.text.bubble('HI!', box.x + box.w - 2, box.y - 1 + lift, { size: 5, alpha: clamp(k * 2, 0, 1) });
          }
        }
      }

      parts.render(c);

      // sign
      let signA = 1;
      if (flickerLeft > 0) signA = Math.floor(flickerLeft * 30) % 3 === 0 ? 0.25 : 1;
      g.text.draw(SIGN_TEXT, DOOR_CX, SIGN_TEXT_Y, { size: 5, color: PAL.neonB, glow: PAL.neonB, shadow: null, alpha: signA });

      // KNOCK! popups
      for (const p of pops) {
        if (!p.on) continue;
        const k = progress(p.t, 0, 0.14);
        const scale = 0.4 + 0.6 * easeOutBack(k);
        const fade = 1 - progress(p.t, POP_LIFE * 0.55, POP_LIFE);
        g.text.draw('KNOCK!', p.x, p.y - p.t * 8, {
          size: p.size * scale, color: PAL.neonA, shadow: '#000000', glow: PAL.neonA, rotate: p.rot, alpha: fade,
        });
      }

      // hint
      if (knocks === 0 && t > 0.6 && Math.floor(t / 0.55) % 2 === 0)
        g.text.draw('▶ CLICK TO KNOCK', DOOR_CX, 166, { size: 6, color: PAL.neonB, shadow: '#000000' });
    },

    exit() {
      if (cursor !== 'default') ctx.setCursor('default');
      parts.clear();
    },

    pointerDown() {
      if ((state === 'DOOR' || state === 'KNOCK') && knocks < KNOCKS) knock();
    },

    debug() {
      let active = 0;
      for (const p of pops) if (p.on) active++;
      return { phase: state, knocks, t: +t.toFixed(2), stateT: +st.toFixed(2), open: +ds.open.toFixed(2), pops: active, particles: parts.count };
    },
  };
}
