// WARP scene: the camera rushes into the open door, the doorway's light
// fills the screen, then a neon tunnel with speed lines accelerates until a
// white hit cuts into the world. Works standalone (`?scene=warp`): it builds
// its own backdrop + open door.
import type { Gfx, Scene, SceneContext } from '../types';
import { W, H } from '../types';
import { PAL } from '../data/theme';
import { line, makeLayer, mix, rect, type Layer } from '../engine/draw';
import { easeInCubic, lerp, progress } from '../engine/ease';
import { Backdrop } from './intro/backdrop';
import { Door, type DoorState } from './intro/door';
import { BACKDROP_SALT, DOOR_CX, DOOR_MID_Y, SIGN_TEXT, SIGN_TEXT_Y } from './intro/layout';

// ---- timings (s)
const ZOOM = 0.75;          // zoom into the doorway
const WHITE_IN = 0.42;      // doorway light starts to fill the screen
const WHITE_OUT = 1.05;     // tunnel fully visible
const END = 2.8;            // hit → world
const END_FADE = 0.3;       // white build-up before the hit
const ZOOM_MAX = 12;

const CX = W / 2, CY = 92;
const RINGS = 11;
const LINES = 120;
const LINES_REDUCED = 40;
const TABLE = 32;
const RING_A: string[] = [];
const RING_B: string[] = [];
for (let i = 0; i <= TABLE; i++) {
  RING_A.push(mix(PAL.neonA, PAL.warp0, i / TABLE));
  RING_B.push(mix(PAL.neonB, PAL.warp0, i / TABLE));
}
const LINE_COLS = [PAL.neonA, PAL.neonB, '#ffffff'] as const;
const GLOW: string[] = [];
for (let k = 14; k > 0; k -= 2) GLOW.push(mix(PAL.neonA, '#ffffff', 1 - k / 14));

export function createWarpScene(): Scene {
  let ctx!: SceneContext;
  let backdrop!: Backdrop;
  let door!: Door;
  let layer!: Layer;
  let lctx!: CanvasRenderingContext2D;
  let t = 0;
  let scroll = 0;
  let shakeIn = 0;
  let done = false;
  let n = LINES;
  const ds: DoorState = { open: 1, knocks: 3, flash: 0, shakeX: 0, t: 0 };
  // speed lines (struct of arrays, no per-frame allocation)
  const lc = new Float32Array(LINES), ls = new Float32Array(LINES);
  const ld = new Float32Array(LINES), ll = new Float32Array(LINES);
  const lv = new Float32Array(LINES), la = new Float32Array(LINES);
  const lk = new Uint8Array(LINES);

  function spawn(i: number, d: number): void {
    const r = ctx.rng;
    const a = r.next() * Math.PI * 2;
    lc[i] = Math.cos(a); ls[i] = Math.sin(a) * 0.62;
    ld[i] = d;
    ll[i] = r.range(6, 22);
    lv[i] = r.range(60, 140);
    la[i] = r.range(0.4, 1);
    lk[i] = r.int(0, 2);
  }

  /** 0..1 progress through the tunnel part. */
  const tunnelP = () => progress(t, ZOOM, END);

  return {
    enter(c) {
      ctx = c;
      backdrop = new Backdrop(c.rng.fork(BACKDROP_SALT), c.reducedMotion);
      door = new Door();
      layer = makeLayer(W, H, () => {});
      lctx = layer.getContext('2d')!;
      n = c.reducedMotion ? LINES_REDUCED : LINES;
      for (let i = 0; i < n; i++) spawn(i, c.rng.range(6, 220));
      c.audio.sfx('warp');
      c.shake(1, 0.3);
    },

    update(dt) {
      if (done) return;
      t += dt;
      ds.t = t;
      if (t < ZOOM) backdrop.update(dt);
      const p = tunnelP();
      const mul = 1 + 5 * p * p; // accelerate
      scroll += dt * (1.1 + 3.5 * p * p);
      for (let i = 0; i < n; i++) {
        ld[i] += lv[i] * mul * dt * (0.4 + ld[i] / 80);
        if (ld[i] > 230) spawn(i, ctx.rng.range(4, 26));
      }
      if (t >= ZOOM && (shakeIn -= dt) <= 0) {
        ctx.shake(p < 0.55 ? 1 : 2, 0.22);
        shakeIn = 0.18;
      }
      if (t >= END) {
        done = true;
        ctx.audio.sfx('warpHit');
        ctx.flash('#ffffff', 0.6);
        ctx.goto('world');
      }
    },

    render(g: Gfx) {
      const c = g.ctx;
      const prev = c.globalAlpha;
      if (t < ZOOM) {
        // the door scene, scaled around the doorway
        backdrop.render(lctx);
        door.render(lctx, ds);
        const e = easeInCubic(progress(t, 0, ZOOM));
        const s = 1 + e * (ZOOM_MAX - 1);
        const fy = lerp(DOOR_MID_Y, H / 2, e);
        c.imageSmoothingEnabled = false;
        c.drawImage(layer, Math.round(DOOR_CX - DOOR_CX * s), Math.round(fy - DOOR_MID_Y * s), Math.round(W * s), Math.round(H * s));
        // the sign text lives on the text overlay, so scale it along
        const ty = fy + (SIGN_TEXT_Y - DOOR_MID_Y) * s;
        if (ty > -6 * s) g.text.draw(SIGN_TEXT, DOOR_CX, ty, { size: 5 * s, color: PAL.neonB, glow: PAL.neonB, shadow: null });
      } else {
        const p = tunnelP();
        rect(c, 0, 0, W, H, PAL.warp0);
        // nested tunnel frames rushing outward
        const fr = scroll - Math.floor(scroll);
        const base = Math.floor(scroll);
        for (let j = 0; j < RINGS; j++) {
          const e = j + fr - 1;
          const sc = Math.pow(1.5, e);
          const w = 10 * sc, h = 6 * sc;
          if (w > W * 1.25) break;
          const id = j - base;
          const tbl = ((id % 3) + 3) % 3 === 0 ? RING_B : RING_A;
          const col = tbl[Math.min(TABLE, Math.max(0, Math.round(Math.pow(Math.max(0, e) / 10, 1.5) * TABLE)))];
          c.globalAlpha = prev * Math.min(1, (e + 1) * 0.8);
          const x = Math.round(CX - w / 2), y = Math.round(CY - h / 2), ww = Math.round(w), hh = Math.round(h);
          const th = w > 110 ? 2 : 1;
          c.fillStyle = col;
          c.fillRect(x, y, ww, th); c.fillRect(x, y + hh - th, ww, th);
          c.fillRect(x, y, th, hh); c.fillRect(x + ww - th, y, th, hh);
        }
        // speed lines
        const stretch = 1 + 2.5 * p;
        for (let i = 0; i < n; i++) {
          const d0 = ld[i], len = Math.min(80, ll[i] * (0.3 + d0 / 60) * stretch);
          c.globalAlpha = prev * la[i] * Math.min(1, d0 / 30);
          line(c, CX + lc[i] * d0, CY + ls[i] * d0, CX + lc[i] * (d0 + len), CY + ls[i] * (d0 + len), LINE_COLS[lk[i]]);
        }
        // central glow, pulsing and growing
        const grow = 1 + 0.6 * p + 0.08 * Math.sin(t * 22);
        c.globalAlpha = prev * 0.5;
        for (let gi = 0, k = 14; k > 0; k -= 2, gi++) {
          const R = k * grow;
          c.fillStyle = GLOW[gi];
          for (let y = -Math.round(R); y <= Math.round(R); y++) {
            const hw = Math.sqrt(Math.max(0, R * R - y * y));
            c.fillRect(Math.round(CX - hw), Math.round(CY + y * 0.7), Math.round(hw * 2), 1);
          }
        }
      }
      // doorway light fills the screen, then fades into the tunnel; white build-up at the end
      let white = 0;
      if (t >= WHITE_IN && t < ZOOM) white = progress(t, WHITE_IN, ZOOM);
      else if (t >= ZOOM && t < WHITE_OUT) white = 1 - progress(t, ZOOM, WHITE_OUT);
      white = Math.max(white, 0.75 * progress(t, END - END_FADE, END));
      if (white > 0) {
        c.globalAlpha = prev * white;
        rect(c, -4, -4, W + 8, H + 8, t < WHITE_OUT ? '#fffbe8' : '#ffffff');
      }
      c.globalAlpha = prev;
    },

    debug() {
      return { phase: 'WARP', t: +t.toFixed(2), stage: t < ZOOM ? 'zoom' : 'tunnel', lines: n, scroll: +scroll.toFixed(2) };
    },
  };
}
