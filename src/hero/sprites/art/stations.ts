// Portable IDE workstations: a desk + monitor + nameplate an agent pulls out of
// its pocket, throws on the floor and works at. One look per tool; the screen
// mark is a homage to each tool's own mark, not its artwork.
//
// Contract (used by world/): drawStation / drawPocketCube / platePos and the
// STATION / STATION_LOOK constants. Seats and who sits where live in world/.
//
// Layout (px above the floor line `by`, desk centred on `cx`):
//   30..17  monitor (20 wide: 1px bezel, 18×11 screen, 2px chin)
//   16..14  stand, keyboard on the right of it
//   13..11  desk slab (52 wide: lit top, body, trim-coloured front edge)
//   10..4   nameplate (46×7, 44 px inside: fits "ANTIGRAVITY" at text size ≤ 5.3)
//    3..0   legs + feet at both ends, soft shadow
// Antigravity has no legs: a 15-high hovering slab that bobs 1 px, its plate a
// steady hover-sign below it (so the caller's label never drifts off the plate).
//
// unfold 0 → 1 (all pure functions of unfold, so 1 → 0 plays as packing up):
//   0    .12  the case lands (squash + dust)
//   .12  .30  lid pops open, the case flattens and widens into the desk slab
//   .30  .52  legs telescope out and lift the slab, overshooting a little
//   .52  .70  nameplate unrolls (PLATE_READY: from here the label may be drawn)
//   .70  .86  monitor flips up from the slab with a bounce
//   .86  1    CRT power-on: a bright line, the screen opens, the mark appears
import type { ToolId } from '../../types';
import { alpha, disc, frame, line, mix, rect } from '../../engine/draw';

type Ctx = CanvasRenderingContext2D;

/** Desk footprint in low-res px (bottom-centre anchored at the floor). h includes the monitor. */
export const STATION = { w: 52, h: 30 } as const;

/** unfold value from which the nameplate is in place (draw the label from here on). */
export const PLATE_READY = 0.7;

export interface StationLook {
  /** Nameplate text (drawn by the caller on the crisp text layer). */
  label: string;
  /** Nameplate border / text colour. */
  trim: string;
}

export const STATION_LOOK: Record<ToolId, StationLook> = {
  claudecode: { label: 'CLAUDE CODE', trim: '#d97757' },
  codex: { label: 'CODEX', trim: '#10a37f' },
  cursor: { label: 'CURSOR', trim: '#9aa0aa' },
  antigravity: { label: 'ANTIGRAVITY', trim: '#8ab4ff' },
  opencode: { label: 'OPENCODE', trim: '#e8e8e8' },
};

interface Kit {
  /** Case + monitor bezel. */
  body: string; hi: string; lo: string;
  screen: string;
  /** Busy-screen sidebar (where the mark sits while code scrolls beside it). */
  side: string;
  /** Code-line colours; the first is also the cursor and the glow. */
  ink: readonly string[];
  /** Emblem pixel on the folded case. */
  emblem: string;
  mark: readonly string[];
  pal: Record<string, string>;
}

const KIT: Record<ToolId, Kit> = {
  // ✻ on orange
  claudecode: {
    body: '#d97757', hi: '#f0a07c', lo: '#a8532f', screen: '#1a0f0a', side: '#2c1910',
    ink: ['#f0a27f', '#e8d5c8', '#9a6248'], emblem: '#fff1e8',
    mark: ['..a..', 'a.a.a', '.aaa.', 'a.a.a', '..a..'], pal: { a: '#f0a27f' },
  },
  // >_ on a white terminal
  codex: {
    body: '#c9ced3', hi: '#eef1f3', lo: '#7b848c', screen: '#0d1117', side: '#18202a',
    ink: ['#e8e8e8', '#10a37f', '#5a6470'], emblem: '#10a37f',
    mark: ['a....', '.a...', 'a....', '..aaa'], pal: { a: '#e8e8e8' },
  },
  // a pointer on graphite
  cursor: {
    body: '#3a3a44', hi: '#5c5c68', lo: '#22222a', screen: '#0b0b0f', side: '#1a1a22',
    ink: ['#f5f5f5', '#9aa0aa', '#7aa2f7'], emblem: '#f5f5f5',
    mark: ['a..', 'aa.', 'aaa', 'aa.', 'a.a'], pal: { a: '#f5f5f5' },
  },
  // an arch opening downward, in four colours
  antigravity: {
    body: '#d9def5', hi: '#ffffff', lo: '#8a92b8', screen: '#0b1030', side: '#16204a',
    ink: ['#9ab8ff', '#4285f4', '#ea4335', '#fbbc04', '#34a853'], emblem: '#4285f4',
    mark: ['..bry..', '.b...y.', 'b.....g', 'b.....g', 'b.....g'], pal: { b: '#4285f4', r: '#ea4335', y: '#fbbc04', g: '#34a853' },
  },
  // a tall white frame whose window is grey in its lower two thirds
  opencode: {
    body: '#2a2626', hi: '#4a4444', lo: '#151212', screen: '#131010', side: '#211c1c',
    ink: ['#f5f5f5', '#8a8686', '#5a5858'], emblem: '#f5f5f5',
    mark: ['wwwwww', 'w....w', 'w....w', 'wggggw', 'wggggw', 'wggggw', 'wwwwww'], pal: { w: '#f5f5f5', g: '#5a5858' },
  },
};

const DESK_HI = '#7a4fb0', DESK = '#3a1f5c', DESK_LO = '#2b1640', LEG_HI = '#4a2a70', PLATE = '#12021e';
const KEY = '#1c0d2e', KEY_HI = '#5a3a86', SHADOW = '#000000', SPARK = '#ffe6f7';

const DW = STATION.w, PW = 46, MW = 20, MH = 14, SW = 18, SH = 11;
const TOP = 13; // desk slab top row, px above the floor
const AG_TOP = 15; // antigravity's hover slab
const CW = 8, CH = 6; // the folded case (+1 px handle)
const DOTS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'] as const;

// ------------------------------------------------------------------ helpers

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const outBack = (p: number) => { const s = 2.2, q = p - 1; return 1 + (s + 1) * q * q * q + s * q * q; };
const outCubic = (p: number) => 1 - (1 - p) ** 3;
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Cheap integer hash → [0, 2^31). */
function hash(n: number): number {
  let h = (n | 0) * 374761393 + 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

function drawMark(c: Ctx, k: Kit, x0: number, y0: number, bw: number, bh: number): void {
  const m = k.mark, h = m.length;
  let w = 0;
  for (let j = 0; j < h; j++) if (m[j].length > w) w = m[j].length;
  const ox = x0 + Math.floor((bw - w) / 2), oy = y0 + Math.floor((bh - h) / 2);
  for (let j = 0; j < h; j++) {
    const row = m[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row.charAt(i);
      if (ch !== '.') rect(c, ox + i, oy + j, 1, 1, k.pal[ch]);
    }
  }
}

/** The folded case, bottom-centred: body, lid seam, emblem, handle; optional glint and lid flaps. */
function drawCase(c: Ctx, tool: ToolId, cx: number, by: number, w: number, h: number, t: number, lid: number): void {
  const k = KIT[tool], trim = STATION_LOOK[tool].trim;
  const x = Math.round(cx - w / 2), y = by - h;
  rect(c, x, y + 1, w, h - 1, k.body);
  rect(c, x + 1, y, w - 2, 1, k.hi);
  rect(c, x, y + h - 1, w, 1, k.lo);
  rect(c, x, y + 2, w, 1, trim);
  rect(c, Math.round(cx) - 1, y + 3, 2, Math.max(1, h - 4), k.emblem);
  if (lid <= 0) {
    rect(c, Math.round(cx) - 1, y - 1, 2, 1, k.lo); // handle
    // a glint sweeping across every ~1.8 s
    const g = ((t % 1.8) / 1.8) * (w + h + 4) - 2;
    const ga = c.globalAlpha;
    c.globalAlpha = ga * 0.75;
    for (let i = 0; i < 2; i++) {
      const gx = Math.round(x + g - i);
      if (gx >= x && gx < x + w) rect(c, gx, y + i, 1, 1, '#ffffff');
    }
    c.globalAlpha = ga;
    return;
  }
  // lid flaps swinging open from the top corners
  const a = lid * 2.3, L = w / 2;
  line(c, x, y, x + Math.cos(a) * L, y - Math.sin(a) * L, k.hi);
  line(c, x + w - 1, y, x + w - 1 - Math.cos(a) * L, y - Math.sin(a) * L, k.hi);
}

/** Code lines scrolling beside the mark, typed with a blinking cursor. */
function busyScreen(c: Ctx, k: Kit, sx: number, sy: number, t: number): void {
  rect(c, sx, sy, 8, SH, k.side);
  drawMark(c, k, sx, sy, 8, SH);
  const LP = 0.6, ph = t / LP, cur = Math.floor(ph), f = ph - cur;
  const cx0 = sx + 9, maxLen = SW - 9;
  for (let i = 0; i < 5; i++) {
    const n = cur - 4 + i, hsh = hash(n);
    const y = sy + 1 + i * 2;
    if (n !== cur && hsh % 6 === 0) continue; // a blank line now and then
    const indent = (hsh >>> 3) % 3;
    // [indent, split) one token, a space, then [split + 1, len) another
    const len = 2 + ((hsh >>> 5) % (maxLen - indent - 2));
    const shown = n === cur ? Math.min(len, Math.floor(len * f * 1.5)) : len;
    const split = 1 + ((hsh >>> 9) % Math.max(1, len - 1));
    const c1 = k.ink[(hsh >>> 12) % k.ink.length], c2 = k.ink[(hsh >>> 15) % k.ink.length];
    const a = Math.min(shown, split);
    if (a > 0) rect(c, cx0 + indent, y, a, 1, c1);
    if (shown > split + 1) rect(c, cx0 + indent + split + 1, y, shown - split - 1, 1, c2);
    if (n === cur && (shown < len || (t * 3) % 2 < 1)) rect(c, cx0 + indent + shown, y - 1, 1, 2, k.ink[0]);
  }
}

/** A telescoping leg: dark outer tube, a lit joint where the inner one slides out, a foot. */
function leg(c: Ctx, lx: number, top: number, by: number, foot: number): void {
  const lh = by - (top + 3);
  rect(c, lx, top + 3, 2, lh, DESK_LO);
  rect(c, lx, top + 3 + Math.round(lh / 2), 2, 1, LEG_HI);
  rect(c, lx + foot, by - 1, 3, 1, DESK_LO);
}

// ------------------------------------------------------------------ API

/** Centre of the nameplate, for drawing STATION_LOOK[tool].label on the text layer. */
export function platePos(tool: ToolId, cx: number, by: number): { x: number; y: number } {
  return { x: cx, y: by - (tool === 'antigravity' ? 9 : 10) + 3.5 };
}

/**
 * Draw a workstation with its bottom-centre at (cx, by).
 * unfold: 0 = the folded case on the floor, 1 = fully open. busy: someone is typing (screen scrolls code).
 */
export function drawStation(c: Ctx, tool: ToolId, cx: number, by: number, o: { unfold: number; t: number; busy: boolean }): void {
  const u = clamp01(o.unfold), t = o.t;
  cx = Math.round(cx); by = Math.round(by);
  if (u <= 0) { drawPocketCube(c, tool, cx, by, t); return; }
  const k = KIT[tool], trim = STATION_LOOK[tool].trim, float = tool === 'antigravity';

  // ---- 1. land: squash and dust
  const pl = seg(u, 0, 0.12);
  if (pl < 1) {
    const sq = Math.sin(pl * Math.PI);
    drawCase(c, tool, cx, by, CW + Math.round(sq * 3), CH - Math.round(sq * 2), t, 0);
    alpha(c, 1 - pl, () => {
      const d = Math.round(4 + pl * 8);
      rect(c, cx - d - 1, by - 1 - Math.round(pl * 2), 2, 1, SPARK);
      rect(c, cx + d, by - 1 - Math.round(pl * 2), 2, 1, SPARK);
    });
    return;
  }

  // ---- 2. pop: lid opens, the case flattens and widens into the slab
  const pp = seg(u, 0.12, 0.3);
  if (pp < 1) {
    if (pp < 0.4) {
      const lp = pp / 0.4;
      drawCase(c, tool, cx, by, CW, CH, t, outCubic(lp));
      alpha(c, 1 - lp, () => {
        for (let i = 0; i < 4; i++) {
          const ang = -0.5 - i * 0.7, r = 3 + lp * 9;
          rect(c, cx + Math.cos(ang) * r, by - CH - 1 + Math.sin(ang) * r, 1, 1, i % 2 ? trim : SPARK);
        }
      });
    } else {
      const q = outCubic((pp - 0.4) / 0.6);
      const w = Math.round(lerp(CW, DW, q)), h = Math.round(lerp(CH, 3, q));
      const x = cx - Math.floor(w / 2);
      rect(c, x, by - h, w, h, mix(k.body, DESK, q));
      rect(c, x, by - h, w, 1, mix(k.hi, DESK_HI, q));
      rect(c, x, by - 1, w, 1, mix(trim, DESK_LO, q * 0.5));
    }
    return;
  }

  // ---- 3. rise: legs telescope out (or the slab lifts off and hovers)
  const pr = seg(u, 0.3, 0.52);
  const top0 = float ? AG_TOP : TOP;
  const settled = seg(u, 0.9, 1);
  const bob = float ? Math.round(Math.sin(t * 1.7) * 1.3 * settled) : 0;
  const top = by - Math.round(lerp(3, top0, outBack(pr))) + bob;
  const x0 = cx - DW / 2;

  const ga = c.globalAlpha;
  // shadow (a hovering desk's shrinks as it rises)
  c.globalAlpha = ga * 0.35 * pr;
  disc(c, cx, by, (DW / 2 - 2) * (float ? 0.8 + bob * 0.04 : 1), 1, SHADOW);
  c.globalAlpha = ga;

  if (float) {
    // thrusters under the slab, four colours, each with a short flickering glow that fades out
    for (let i = 0; i < 4; i++) {
      const tx = x0 + 9 + i * 11;
      rect(c, tx, top + 3, 2, 1, DOTS[i]);
      const g = pr * (0.4 + 0.15 * Math.sin(t * 9 + i * 1.7));
      for (let j = 0; j < 3; j++) {
        c.globalAlpha = ga * g * (1 - j / 3);
        rect(c, tx, top + 4 + j, 2, 1, DOTS[i]);
      }
      c.globalAlpha = ga;
    }
  } else if (pr > 0) {
    leg(c, x0 + 2, top, by, -1);
    leg(c, x0 + DW - 4, top, by, 0);
  }

  // slab
  rect(c, x0, top, DW, 3, DESK);
  rect(c, x0 + 1, top, DW - 2, 1, DESK_HI);
  rect(c, x0, top + 2, DW, 1, mix(trim, DESK_LO, 0.45));

  // ---- 4. nameplate unrolls (antigravity: a hover-sign opening from its middle)
  const pn = seg(u, 0.52, 0.7);
  if (pn > 0) {
    const ph = Math.max(1, Math.min(8, Math.round(7 * outBack(pn))));
    const px0 = cx - PW / 2;
    const py0 = float ? by - 6 - Math.floor(ph / 2) : top + 3;
    rect(c, px0, py0, PW, ph, PLATE);
    rect(c, px0, py0, PW, 1, trim);
    rect(c, px0, py0 + ph - 1, PW, 1, trim);
    rect(c, px0, py0, 1, ph, trim);
    rect(c, px0 + PW - 1, py0, 1, ph, trim);
    if (ph >= 5) {
      rect(c, px0 + 1, py0 + 1, 1, 1, mix(trim, PLATE, 0.5));
      rect(c, px0 + PW - 2, py0 + 1, 1, 1, mix(trim, PLATE, 0.5));
    }
    if (float) {
      c.globalAlpha = ga * 0.5;
      rect(c, px0 + 6, py0 + ph, 3, 1, trim);
      rect(c, px0 + PW - 9, py0 + ph, 3, 1, trim);
      c.globalAlpha = ga;
    }
  }

  // ---- 5. monitor flips up, then powers on
  const pm = seg(u, 0.7, 0.86);
  if (pm <= 0) return;
  const mx = cx - MW / 2;
  const footY = top - 1;
  // stand + keyboard
  rect(c, cx - 3, footY, 6, 1, k.lo);
  const neck = pm > 0.15 ? 2 : 0;
  if (neck) rect(c, cx - 1, footY - neck, 2, neck, k.lo);
  if (pm > 0.3) {
    const kx = cx + 8;
    rect(c, kx, footY, 10, 1, KEY_HI);
    rect(c, kx + 10, footY, 1, 1, KEY);
    if (o.busy && u >= 1) rect(c, kx + (hash(Math.floor(t * 14)) % 10), footY, 1, 1, k.ink[0]);
  }
  const mh = Math.max(1, Math.min(MH + 1, Math.round(MH * outBack(pm))));
  const mb = footY - neck; // first row below the monitor
  const my = mb - mh;
  rect(c, mx, my, MW, mh, k.body);
  rect(c, mx + 1, my, MW - 2, 1, k.hi);
  rect(c, mx, mb - 1, MW, 1, k.lo);
  if (mh < MH) return;
  const sx = mx + 1, sy = my + 1;
  rect(c, sx, sy, SW, SH, k.screen);
  rect(c, mx + MW - 3, mb - 2, 1, 1, u >= 1 ? (o.busy ? k.ink[1 % k.ink.length] : k.ink[0]) : k.lo); // power led

  const po = seg(u, 0.86, 1);
  if (po < 1) {
    // CRT on: a line grows across, then the picture opens vertically
    if (po < 0.45) {
      const lw = Math.round(SW * (po / 0.45));
      rect(c, sx + Math.round((SW - lw) / 2), sy + 5, lw, 1, '#ffffff');
    } else {
      const oh = Math.round(SH * ((po - 0.45) / 0.55));
      const oy = sy + Math.round((SH - oh) / 2);
      rect(c, sx, oy, SW, oh, mix('#ffffff', k.screen, Math.min(1, (po - 0.45) * 3)));
      if (po > 0.75) drawMark(c, k, sx, sy, SW, SH);
      // a twinkle off the top corner as it settles
      alpha(c, 1 - (po - 0.45) / 0.55, () => {
        rect(c, mx + MW, my - 2, 1, 3, SPARK);
        rect(c, mx + MW - 1, my - 1, 3, 1, SPARK);
      });
    }
    return;
  }

  if (o.busy) {
    busyScreen(c, k, sx, sy, t);
    // a soft halo around the bezel (not over the screen, which stays dark)
    const gl = 0.3 + 0.1 * Math.sin(t * 3);
    c.globalAlpha = ga * gl;
    frame(c, mx - 1, my - 1, MW + 2, MH + 1, k.ink[0]);
    c.globalAlpha = ga * gl * 0.4;
    frame(c, mx - 2, my - 2, MW + 4, MH + 2, k.ink[0]);
    c.globalAlpha = ga;
  } else {
    drawMark(c, k, sx, sy, SW, SH);
  }
}

/** The folded workstation: a little case in the tool's colours (in hand, mid-air or just landed). */
export function drawPocketCube(c: Ctx, tool: ToolId, cx: number, by: number, t: number): void {
  drawCase(c, tool, Math.round(cx), Math.round(by), CW, CH, t, 0);
}
