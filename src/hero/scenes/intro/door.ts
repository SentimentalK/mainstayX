// The neon door on the horizon: frame + sign box + side panel (static layer),
// door leaves (static layer, shaken / slid at draw time), status light,
// inner light and the light cone on the ground once it opens.
import { H } from '../../types';
import { PAL } from '../../data/theme';
import { frame, makeLayer, mix, rect, type Layer } from '../../engine/draw';
import {
  DOOR_CX, DOOR_H, DOOR_W, DOOR_X, DOOR_Y, GROUND, SIGN_H, SIGN_W, SIGN_X, SIGN_Y,
} from './layout';

export interface DoorState {
  /** 0 closed .. 1 fully open. */
  open: number;
  /** 0..3 knocks so far (status light segments turned pink). */
  knocks: number;
  /** 0..1 neon flash after a knock. */
  flash: number;
  /** Leaf shake offset (px). */
  shakeX: number;
  /** Seconds, for blinking details. */
  t: number;
}

const w = DOOR_W, h = DOOR_H, cx = DOOR_CX, x = DOOR_X, y = DOOR_Y;
const CONE = H - GROUND;
const INSIDE: string[] = [];
for (let i = 0; i < 6; i++) INSIDE.push(mix(PAL.inside0, PAL.inside1, i / 5));
const CONE_COL = mix(PAL.inside1, PAL.neonA, 0.4);
const NEON_FLASH: string[] = [];
for (let i = 0; i <= 8; i++) NEON_FLASH.push(mix(PAL.neonA, '#ffffff', (i / 8) * 0.8));

function paintLeaf(c: CanvasRenderingContext2D): void {
  // drawn at local (0,0) .. (w,h)
  const lx = 0, ly = 0, lcx = w / 2;
  rect(c, lx, ly, w, h, PAL.door);
  rect(c, lcx, ly, 1, h, PAL.doorDark);
  for (const gy of [ly + 12, ly + 30, ly + 44]) {
    rect(c, lx + 2, gy, w - 4, 1, PAL.doorDark);
    rect(c, lx + 2, gy + 1, w - 4, 1, PAL.doorHi);
  }
  rect(c, lcx - 9, ly + 18, 18, 4, PAL.doorDark);
  rect(c, lcx - 8, ly + 19, 16, 1, PAL.neonA);
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < w - 4; i++)
      rect(c, lx + 2 + i, ly + h - 9 + j, 1, 1, (i + j) % 6 < 3 ? PAL.neonB : PAL.doorDark);
  for (const [rx, ry] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) rect(c, lx + rx, ly + ry, 1, 1, PAL.doorHi);
  // handles either side of the seam
  rect(c, lcx - 3, ly + 33, 1, 4, PAL.doorHi);
  rect(c, lcx + 3, ly + 33, 1, 4, PAL.doorHi);
}

export class Door {
  private frameLayer: Layer;
  private leaf: Layer;

  constructor() {
    this.frameLayer = makeLayer(320, 180, c => {
      // sign box
      rect(c, SIGN_X, SIGN_Y, SIGN_W, SIGN_H, PAL.frame);
      frame(c, SIGN_X, SIGN_Y, SIGN_W, SIGN_H, PAL.neonA);
      rect(c, cx - 12, SIGN_Y + SIGN_H, 1, 3, PAL.frame);
      rect(c, cx + 11, SIGN_Y + SIGN_H, 1, 3, PAL.frame);
      // frame body
      rect(c, x - 6, y - 8, w + 12, h + 8, PAL.frame);
      rect(c, x - 6, y - 8, w + 12, 1, PAL.frameHi);
      rect(c, x - 6, y - 8, 1, h + 8, PAL.frameHi);
      // doorway backing (dark, visible while the leaves slide)
      rect(c, x, y, w, h, PAL.doorDark);
      // side panel
      rect(c, x + w + 2, y + 24, 3, 9, PAL.doorDark);
    });
    this.leaf = makeLayer(w, h, paintLeaf);
  }

  render(ctx: CanvasRenderingContext2D, s: DoorState): void {
    ctx.drawImage(this.frameLayer, 0, 0);
    // status light: three segments, pink per knock
    for (let i = 0; i < 3; i++) {
      const on = i < s.knocks || s.open > 0;
      rect(ctx, cx - 8 + i * 6, y - 6, 4, 2, on ? PAL.neonA : PAL.neonB);
    }
    // side panel lights (third blinks)
    const blink = Math.floor(s.t * 1.6) % 2 === 0;
    rect(ctx, x + w + 3, y + 25, 1, 1, PAL.neonA);
    rect(ctx, x + w + 3, y + 28, 1, 1, s.knocks > 0 || s.open > 0 ? PAL.neonA : PAL.doorHi);
    rect(ctx, x + w + 3, y + 31, 1, 1, blink ? PAL.neonB : PAL.doorDark);
    // neon outline, flashes brighter on a knock
    const nc = NEON_FLASH[Math.round(Math.min(1, Math.max(0, s.flash)) * 8)];
    rect(ctx, x - 2, y - 2, w + 4, 1, nc);
    rect(ctx, x - 2, y - 2, 1, h + 2, nc);
    rect(ctx, x + w + 1, y - 2, 1, h + 2, nc);

    if (s.open <= 0) {
      ctx.drawImage(this.leaf, Math.round(x + s.shakeX), y);
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * (0.5 + 0.4 * s.flash);
      rect(ctx, x - 2, GROUND + 2, w + 4, 1, PAL.neonA);
      ctx.globalAlpha = prev;
    } else {
      const o = Math.min(1, s.open);
      for (let i = 0; i < 6; i++) rect(ctx, x, y + i * 10, w, 10, INSIDE[i]);
      // light cone on the ground through the gap
      const gap = w * o;
      const prev = ctx.globalAlpha;
      const strength = Math.min(1, o * 1.6);
      for (let k = 0; k < CONE; k++) {
        ctx.globalAlpha = prev * 0.42 * (1 - k / CONE) * strength;
        const hw = gap / 2 + k * 1.7 * o;
        rect(ctx, cx - hw, GROUND + k, hw * 2, 1, k < 2 ? PAL.inside1 : CONE_COL);
      }
      ctx.globalAlpha = prev;
      // leaves slide into the wall: left shows its right part, right its left part
      const vw = Math.round((w / 2) * (1 - o));
      if (vw > 0) {
        ctx.drawImage(this.leaf, w / 2 - vw, 0, vw, h, x, y, vw, h);
        ctx.drawImage(this.leaf, w / 2, 0, vw, h, x + w - vw, y, vw, h);
        rect(ctx, x + vw - 1, y, 1, h, PAL.doorHi);
        rect(ctx, x + w - vw, y, 1, h, PAL.doorHi);
      }
    }
    // threshold
    rect(ctx, x - 8, GROUND, w + 16, 2, PAL.frameHi);
  }
}
