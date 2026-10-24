// Portable IDE workstations: a desk + monitor + nameplate an agent pulls out of
// its pocket, throws on the floor and works at. One look per tool; the screen
// mark is a homage to each tool's own mark, not its artwork.
//
// Contract (used by world/): drawStation / drawPocketCube / platePos and the
// STATION / STATION_LOOK constants. Seats and who sits where live in world/.
import type { ToolId } from '../../types';
import { alpha, ellipse, frame, rect } from '../../engine/draw';

type Ctx = CanvasRenderingContext2D;

/** Desk footprint in low-res px (bottom-centre anchored at the floor). */
export const STATION = { w: 42, h: 26 } as const;

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

interface Screen { bezel: string; screen: string; mark: string[]; pal: Record<string, string> }
const SCREEN: Record<ToolId, Screen> = {
  claudecode: { bezel: '#d97757', screen: '#1a0f0a', mark: ['..a..', 'a.a.a', '.aaa.', 'a.a.a', '..a..'], pal: { a: '#f0a27f' } },
  codex: { bezel: '#c9ced3', screen: '#0d1117', mark: ['a....', '.a...', 'a....', '..aaa'], pal: { a: '#e8e8e8' } },
  cursor: { bezel: '#3a3a44', screen: '#0b0b0f', mark: ['a..', 'aa.', 'aaa', 'aa.', 'a.a'], pal: { a: '#f5f5f5' } },
  // an arch: a parabola opening downward
  antigravity: { bezel: '#d9def5', screen: '#0b1030', mark: ['..bry..', '.b...y.', 'b.....g', 'b.....g', 'b.....g'], pal: { b: '#4285f4', r: '#ea4335', y: '#fbbc04', g: '#34a853' } },
  // tall white frame, the lower two thirds of its window grey
  opencode: { bezel: '#2a2626', screen: '#131010', mark: ['wwwwww', 'w....w', 'w....w', 'wggggw', 'wggggw', 'wggggw', 'wwwwww'], pal: { w: '#f5f5f5', g: '#5a5858' } },
};

const DESK = '#3a1f5c', DESK_HI = '#7a4fb0', LEG = '#2b1640', PLATE = '#12021e';
const FLOAT = (tool: ToolId) => (tool === 'antigravity' ? 6 : 0);

function mark(c: Ctx, s: Screen, x0: number, y0: number, bw: number, bh: number): void {
  const w = Math.max(...s.mark.map(r => r.length)), h = s.mark.length;
  const ox = x0 + Math.floor((bw - w) / 2), oy = y0 + Math.floor((bh - h) / 2);
  s.mark.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') rect(c, ox + i, oy + j, 1, 1, s.pal[ch]); }));
}

/** Centre of the nameplate, for drawing STATION_LOOK[tool].label on the text layer. */
export function platePos(tool: ToolId, cx: number, by: number): { x: number; y: number } {
  return { x: cx, y: by - 12 - FLOAT(tool) + 7 };
}

/**
 * Draw a workstation with its bottom-centre at (cx, by).
 * unfold: 0 = just landed (flat crate), 1 = fully open. busy: someone is typing (screen glows).
 */
export function drawStation(c: Ctx, tool: ToolId, cx: number, by: number, o: { unfold: number; t: number; busy: boolean }): void {
  const s = SCREEN[tool], look = STATION_LOOK[tool], w = STATION.w, x = Math.round(cx - w / 2);
  const float = FLOAT(tool) * Math.min(1, o.unfold * 2);
  const top = Math.round(by - 12 - float);
  if (o.unfold <= 0) { drawPocketCube(c, tool, cx, by, o.t); return; }
  if (FLOAT(tool)) {
    alpha(c, 0.5, () => ellipse(c, cx, by - 1, 13, 2, look.trim));
  } else {
    rect(c, x + 2, top + 4, 2, 8, LEG);
    rect(c, x + w - 4, top + 4, 2, 8, LEG);
  }
  rect(c, x, top, w, 4, DESK);
  rect(c, x, top, w, 1, DESK_HI);
  rect(c, x + 1, top + 4, w - 2, 6, PLATE);
  frame(c, x + 1, top + 4, w - 2, 6, look.trim);
  if (o.unfold < 1) return; // the monitor pops up last
  const mx = Math.round(cx - 7), my = top - 13;
  rect(c, mx, my, 14, 11, s.bezel);
  rect(c, mx + 1, my + 1, 12, 9, s.screen);
  mark(c, s, mx + 1, my + 1, 12, 9);
  rect(c, cx - 1, my + 11, 2, 2, s.bezel);
  if (o.busy) alpha(c, 0.2 + 0.1 * Math.sin(o.t * 6), () => rect(c, mx - 2, my - 2, 18, 15, s.pal[Object.keys(s.pal)[0]]));
}

/** The folded workstation: a small crate in the tool's colour (in hand, mid-air or just landed). */
export function drawPocketCube(c: Ctx, tool: ToolId, cx: number, by: number, _t: number): void {
  const look = STATION_LOOK[tool];
  rect(c, cx - 3, by - 6, 6, 6, SCREEN[tool].bezel);
  frame(c, cx - 3, by - 6, 6, 6, look.trim);
}
