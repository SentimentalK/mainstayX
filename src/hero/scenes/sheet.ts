// Debug sprite sheet (?scene=sheet). Shows every sprite and every animation
// playing, at world scale. Pages cycle every 6 s; `?page=n` pins one page.
//   0  clawd / gpt / grok              1  gemini / glm / deepseek
//   2  sub-agents: mini / glmMini / deepseekMini (1x, shown 2x)
//   3  benched: codex / qwen / kimi    4  the five workstations: unfold loop, busy, unfold film strip
//   5  workstations with four agents around them (scale check)
//   6  orca, packets, fx               7  icons + a walking parade
//   8  static frame strips (walk / idle / back) for the cast + minis
//   9  frame strips for deepseek + the benched, and a line-up next to orca
// `?t=seconds` starts the clock there (headless screenshots don't advance it);
// `?u=0..1` pins the unfold of page 4's top row.
import type { CharacterId, Gfx, Scene, SceneContext, SpriteId, ToolId } from '../types';
import { AGENT_ANIMS, ORCA_ANIMS, PROP_ANIMS, W, H } from '../types';
import { drawSprite, frameAt, frameCount, spriteSize } from '../sprites/render';
import { SPRITES } from '../sprites/defs';
import { PLATE_READY, STATION, STATION_LOOK, drawPocketCube, drawStation, platePos } from '../sprites/art/stations';

const BG = '#0d0221';
const LINE = '#2a0a3f';
const LABEL = '#ffe6f7';
const DIM = '#a58bbf';
const TITLE = '#ff4fd8';
const PAGES = 10;
const PAGE_TIME = 6;

const AGENT_ROWS: CharacterId[][] = [['clawd', 'gpt', 'grok'], ['gemini', 'glm', 'deepseek'], ['mini', 'glmMini', 'deepseekMini'], ['codex', 'qwen', 'kimi']];
const BENCHED = new Set<CharacterId>(['codex', 'qwen', 'kimi']);
const TOOLS: ToolId[] = ['claudecode', 'codex', 'cursor', 'antigravity', 'opencode'];
const STATION_RIM = '#5a1680';
const SCALE: Record<CharacterId, number> = { clawd: 2, gpt: 2, grok: 2, gemini: 2, codex: 2, qwen: 2, kimi: 2, glm: 2, deepseek: 2, mini: 1, glmMini: 1, deepseekMini: 1, orca: 2 };

export function createSheetScene(): Scene {
  let t = 0;
  let pinned: number | null = null;
  let pinU: number | null = null;

  /** Playback time for an anim; non-looping ones restart every `period` s. */
  const at = (id: SpriteId, anim: string, period = 2): number => {
    const a = SPRITES[id]?.anims[anim];
    const local = a && a.loop === false ? t % period : t;
    return frameAt(id, anim, local);
  };

  function cell(g: Gfx, id: SpriteId, anim: string, cx: number, by: number, scale: number, outline?: string, label = anim): void {
    const c = g.ctx;
    c.fillStyle = LINE;
    c.fillRect(cx - 12, by, 24, 1);
    drawSprite(c, id, anim, at(id, anim), cx, by, { scale, outline });
    const n = frameCount(id, anim);
    g.text.draw(label, cx, by + 5, { size: 3.5, color: LABEL, shadow: null });
    g.text.draw(n + 'f', cx, by + 9.5, { size: 3.5, color: DIM, shadow: null });
  }

  function agentsPage(g: Gfx, ids: CharacterId[]): void {
    ids.forEach((id, r) => {
      const y0 = 12 + r * 56;
      const s = SCALE[id];
      const sz = spriteSize(id, 'idle', 1);
      const bench = BENCHED.has(id);
      // 1x sub-agents are shown at 2x so the pixels can be checked; a true-size copy sits by the title
      const show = s === 1 ? 2 : s;
      const note = bench ? '  BENCHED (kept, off stage)' : s === 1 ? '  (shown 2x)' : '';
      g.text.draw(`${id}  ${sz.w}x${sz.h} @${s}x${note}`, 6, y0 + 1, { size: 4, color: bench ? DIM : TITLE, align: 'left' });
      if (s === 1) drawSprite(g.ctx, id, 'idle', at(id, 'idle'), 160, y0 + 4);
      AGENT_ANIMS.forEach((anim, i) => cell(g, id, anim, 20 + i * 28, y0 + 34, show));
    });
  }

  /** Unfold 0 -> 1, hold (busy), 1 -> 0, hold. */
  function unfoldAt(time: number): { u: number; busy: boolean } {
    const k = time % 6;
    if (k < 1.8) return { u: k / 1.8, busy: false };
    if (k < 3.6) return { u: 1, busy: k > 2.1 };
    if (k < 5.2) return { u: 1 - (k - 3.6) / 1.6, busy: false };
    return { u: 0, busy: false };
  }

  function station(g: Gfx, tool: ToolId, cx: number, by: number, u: number, busy: boolean): void {
    drawStation(g.ctx, tool, cx, by, { unfold: u, t, busy });
    if (u >= PLATE_READY) {
      const p = platePos(tool, cx, by);
      g.text.draw(STATION_LOOK[tool].label, p.x, p.y, { size: 4, color: STATION_LOOK[tool].trim, shadow: null });
    }
  }

  function floorLine(g: Gfx, by: number): void {
    g.ctx.fillStyle = LINE;
    g.ctx.fillRect(0, by, W, 1);
  }

  function stationsPage(g: Gfx): void {
    const c = g.ctx;
    const loop = unfoldAt(t);
    const u = pinU ?? loop.u;
    g.text.draw(`stations ${STATION.w}x${STATION.h}  unfold ${u.toFixed(2)}${pinU === null ? '  (?u= pins)' : ''}`, 6, 5, { size: 4, color: TITLE, align: 'left' });
    floorLine(g, 52);
    TOOLS.forEach((tool, i) => station(g, tool, 32 + i * 64, 52, u, pinU === null ? loop.busy : false));
    g.text.draw('busy', 6, 62, { size: 4, color: TITLE, align: 'left' });
    floorLine(g, 108);
    TOOLS.forEach((tool, i) => station(g, tool, 32 + i * 64, 108, 1, true));
    const tool = TOOLS[Math.floor(t / 1.5) % TOOLS.length];
    g.text.draw(`unfold film strip: ${tool}  (pocket case, then u = .15 .25 .42 .62 .8 .93)`, 6, 117, { size: 3.5, color: DIM, align: 'left', shadow: null });
    floorLine(g, 170);
    drawPocketCube(c, tool, 6, 160, t);
    [0.15, 0.25, 0.42, 0.62, 0.8, 0.93].forEach((fu, i) => station(g, tool, 28 + i * 53, 170, fu, false));
  }

  /** Four agents around a desk: two at the ends on the floor, two behind it. */
  function seatsPage(g: Gfx): void {
    const c = g.ctx;
    g.text.draw('a desk seats 4. suggested: two at the ends on the floor (cx +- 38), two at cx +- 17:', 6, 5, { size: 3.5, color: TITLE, align: 'left', shadow: null });
    g.text.draw('2x agents stand behind it at by-6 (drawn first), 1x sub-agents hop onto the desk top at by-14', 6, 10, { size: 3.5, color: TITLE, align: 'left', shadow: null });
    const seat = (id: CharacterId, x: number, by: number, flip: boolean) =>
      drawSprite(c, id, 'work', at(id, 'work'), x, by, { scale: SCALE[id], outline: STATION_RIM, flip });
    const scene = (tool: ToolId, cx: number, by: number, back: [CharacterId, CharacterId], ends: [CharacterId, CharacterId]) => {
      floorLine(g, by);
      const mini = (id: CharacterId) => SCALE[id] === 1;
      // behind the desk first, so the desk hides their legs
      if (!mini(back[0])) seat(back[0], cx - 17, by - 6, false);
      if (!mini(back[1])) seat(back[1], cx + 17, by - 6, true);
      station(g, tool, cx, by, 1, true);
      if (mini(back[0])) seat(back[0], cx - 17, by - 14, false);
      if (mini(back[1])) seat(back[1], cx + 17, by - 14, true);
      seat(ends[0], cx - STATION.w / 2 - 12, by, false);
      seat(ends[1], cx + STATION.w / 2 + 12, by, true);
    };
    scene('opencode', 80, 82, ['glmMini', 'deepseekMini'], ['glm', 'deepseek']);
    scene('claudecode', 240, 82, ['mini', 'mini'], ['clawd', 'mini']);
    scene('codex', 80, 164, ['gpt', 'gpt'], ['gpt', 'gpt']);
    scene('cursor', 240, 164, ['grok', 'grok'], ['grok', 'grok']);
  }

  function propsPage(g: Gfx): void {
    g.text.draw('orca  30x16 @2x outline', 6, 9, { size: 4, color: TITLE, align: 'left' });
    ORCA_ANIMS.forEach((anim, i) => cell(g, 'orca', anim, 55 + i * 105, 50, 2, '#7a4fb0'));
    g.text.draw('packet @2x / @1x', 6, 73, { size: 4, color: TITLE, align: 'left' });
    g.text.draw('fx @2x / @1x', 112, 73, { size: 4, color: TITLE, align: 'left' });
    PROP_ANIMS.packet.forEach((anim, i) => {
      cell(g, 'packet', anim, 20 + i * 30, 104, 2);
      cell(g, 'packet', anim, 20 + i * 30, 146, 1);
    });
    PROP_ANIMS.fx.forEach((anim, i) => {
      cell(g, 'fx', anim, 128 + i * 34, 104, 2);
      cell(g, 'fx', anim, 128 + i * 34, 146, 1);
    });
  }

  function iconsPage(g: Gfx): void {
    const c = g.ctx;
    g.text.draw('icon @2x', 6, 9, { size: 4, color: TITLE, align: 'left' });
    PROP_ANIMS.icon.forEach((anim, i) => cell(g, 'icon', anim, 19 + i * 20.2, 38, 2));
    g.text.draw('icon @1x in a bubble', 6, 56, { size: 4, color: TITLE, align: 'left' });
    PROP_ANIMS.icon.forEach((anim, i) => {
      const cx = 19 + i * 20.2;
      const s = spriteSize('icon', anim, 1);
      const w = s.w + 4, h = s.h + 4;
      const x = Math.round(cx - w / 2), y = 72 - h;
      c.fillStyle = '#d97757';
      c.fillRect(x, y - 1, w, h + 2);
      c.fillRect(x - 1, y, w + 2, h);
      c.fillStyle = BG;
      c.fillRect(x, y, w, h);
      drawSprite(c, 'icon', anim, 0, x + w / 2, y + h - 2);
    });

    // Parade: everyone walking across the floor, orca swimming above.
    g.text.draw('parade (walk / swim / back)', 6, 90, { size: 4, color: TITLE, align: 'left' });
    const floor = 168;
    c.fillStyle = '#12021e';
    c.fillRect(0, floor, W, H - floor);
    c.fillStyle = '#5a1680';
    c.fillRect(0, floor, W, 1);
    const ox = ((t * 30) % (W + 60)) - 30;
    drawSprite(c, 'orca', 'swim', at('orca', 'swim'), Math.round(W - ox), 132, { scale: 2, outline: '#7a4fb0', flip: true });
    const walkers: CharacterId[] = ['clawd', 'mini', 'gpt', 'glmMini', 'grok', 'gemini', 'deepseekMini', 'glm', 'deepseek'];
    walkers.forEach((id, i) => {
      const x = (((t * 24 + i * 40) % (W + 40)) + W + 40) % (W + 40) - 20;
      drawSprite(c, id, 'walk', at(id, 'walk'), Math.round(x), floor, { scale: SCALE[id] });
    });
    // Clawd walking "into the screen".
    drawSprite(c, 'clawd', 'back', at('clawd', 'back'), 300, floor - 22, { scale: 2 });
  }

  /** Every frame of an anim side by side (static), for checking cycles. */
  function strip(g: Gfx, id: SpriteId, anim: string, x: number, by: number, scale: number, pitch: number): number {
    const n = frameCount(id, anim);
    g.text.draw(anim, x + (pitch * n) / 2 - pitch / 2, by + 4, { size: 3.5, color: DIM, shadow: null });
    for (let i = 0; i < n; i++) drawSprite(g.ctx, id, anim, i, x + i * pitch, by, { scale, outline: id === 'orca' ? '#7a4fb0' : undefined });
    return x + n * pitch + 6;
  }

  function framesPage(g: Gfx): void {
    stripRows(g, ['clawd', 'gpt', 'grok', 'gemini', 'glm']);
    const by = 172;
    let x = 4;
    for (const id of ['mini', 'glmMini', 'deepseekMini'] as CharacterId[]) {
      g.text.draw(id, x, by - 20, { size: 3.5, color: TITLE, align: 'left', shadow: null });
      x = strip(g, id, 'walk', x + 6, by - 4, 1, 13);
      x = strip(g, id, 'idle', x - 2, by - 4, 1, 13) + 2;
    }
  }

  /** The rest of the cycles, plus the on-stage cast at world scale next to Orca to compare sizes. */
  function framesPage2(g: Gfx): void {
    stripRows(g, ['deepseek', 'codex', 'qwen', 'kimi']);
    g.text.draw('on stage @2x (world scale), sub-agents @1x', 6, 126, { size: 4, color: TITLE, align: 'left' });
    const c = g.ctx, floor = 170;
    c.fillStyle = LINE;
    c.fillRect(0, floor, W, 1);
    drawSprite(c, 'orca', 'swim', at('orca', 'swim'), 160, floor - 6, { scale: 2, outline: '#7a4fb0' });
    const ids: CharacterId[] = ['clawd', 'gpt', 'grok', 'mini', 'glmMini', 'deepseekMini', 'gemini', 'glm', 'deepseek'];
    const xs = [18, 46, 74, 100, 114, 205, 238, 268, 298];
    ids.forEach((id, i) => drawSprite(c, id, 'idle', at(id, 'idle'), xs[i], floor, { scale: SCALE[id] }));
  }

  function stripRows(g: Gfx, ids: CharacterId[]): void {
    ids.forEach((id, r) => {
      const by = 30 + r * 28;
      g.text.draw(id, 4, by - 8, { size: 3.5, color: TITLE, align: 'left', shadow: null });
      let x = 44;
      x = strip(g, id, 'walk', x, by, 2, 27);
      x = strip(g, id, 'idle', x - 3, by, 2, 27);
      strip(g, id, 'back', x - 3, by, 2, 27);
    });
  }

  return {
    enter(_c: SceneContext) {
      const q = new URLSearchParams(location.search);
      const num = (k: string): number | null => {
        const v = q.get(k);
        return v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null;
      };
      const p = num('page');
      pinned = p !== null ? Math.max(0, Math.min(PAGES - 1, Math.floor(p))) : null;
      t = Math.max(0, num('t') ?? 0);
      const u = num('u');
      pinU = u !== null ? Math.max(0, Math.min(1, u)) : null;
    },
    update(dt) { t += dt; },
    render(g: Gfx) {
      const c = g.ctx;
      c.fillStyle = BG;
      c.fillRect(0, 0, W, H);
      const page = pinned ?? Math.floor(t / PAGE_TIME) % PAGES;
      if (page <= 3) agentsPage(g, AGENT_ROWS[page]);
      else if (page === 4) stationsPage(g);
      else if (page === 5) seatsPage(g);
      else if (page === 6) propsPage(g);
      else if (page === 7) iconsPage(g);
      else if (page === 8) framesPage(g);
      else framesPage2(g);
      g.text.draw(`sheet ${page + 1}/${PAGES}${pinned === null ? '  (?page=n to pin)' : ''}`, W - 4, H - 4, {
        size: 3.5, color: DIM, align: 'right', shadow: null,
      });
    },
    debug() {
      return { page: pinned ?? Math.floor(t / PAGE_TIME) % PAGES, t };
    },
  };
}
