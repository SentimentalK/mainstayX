// Debug sprite sheet (?scene=sheet). Shows every sprite and every animation
// playing, at world scale. Pages cycle every 6 s; `?page=n` pins one page.
//   0  clawd / gemini / codex      1  qwen / kimi / mini
//   2  orca, packets, fx           3  icons + a walking parade
//   4  static frame strips (walk / idle / back cycles, orca swim)
import type { CharacterId, Gfx, Scene, SceneContext, SpriteId } from '../types';
import { AGENT_ANIMS, ORCA_ANIMS, PROP_ANIMS, W, H } from '../types';
import { drawSprite, frameAt, frameCount, spriteSize } from '../sprites/render';
import { SPRITES } from '../sprites/defs';

const BG = '#0d0221';
const LINE = '#2a0a3f';
const LABEL = '#ffe6f7';
const DIM = '#a58bbf';
const TITLE = '#ff4fd8';
const PAGES = 5;
const PAGE_TIME = 6;

const AGENT_ROWS: CharacterId[][] = [['clawd', 'gemini', 'codex'], ['qwen', 'kimi', 'mini']];
const SCALE: Record<CharacterId, number> = { clawd: 2, gemini: 2, codex: 2, qwen: 2, kimi: 2, mini: 1, orca: 2 };

export function createSheetScene(): Scene {
  let t = 0;
  let pinned: number | null = null;

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
      g.text.draw(`${id}  ${sz.w}x${sz.h} @${s}x`, 6, y0 + 1, { size: 4, color: TITLE, align: 'left' });
      AGENT_ANIMS.forEach((anim, i) => cell(g, id, anim, 20 + i * 28, y0 + 34, s));
    });
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
    const walkers: CharacterId[] = ['clawd', 'mini', 'gemini', 'codex', 'qwen', 'kimi'];
    walkers.forEach((id, i) => {
      const x = (((t * 24 + i * 56) % (W + 40)) + W + 40) % (W + 40) - 20;
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
    const ids: CharacterId[] = ['clawd', 'gemini', 'codex', 'qwen', 'kimi'];
    ids.forEach((id, r) => {
      const by = 30 + r * 28;
      g.text.draw(id, 4, by - 8, { size: 3.5, color: TITLE, align: 'left', shadow: null });
      let x = 44;
      x = strip(g, id, 'walk', x, by, 2, 27);
      x = strip(g, id, 'idle', x - 3, by, 2, 27);
      strip(g, id, 'back', x - 3, by, 2, 27);
    });
    const by = 172;
    g.text.draw('mini', 4, by - 6, { size: 3.5, color: TITLE, align: 'left', shadow: null });
    let x = 22;
    x = strip(g, 'mini', 'walk', x, by - 4, 1, 12);
    x = strip(g, 'mini', 'idle', x, by - 4, 1, 12);
    x = strip(g, 'mini', 'back', x, by - 4, 1, 12);
    strip(g, 'orca', 'swim', x + 12, by - 4, 1, 34);
  }

  return {
    enter(_c: SceneContext) {
      t = 0;
      const p = new URLSearchParams(location.search).get('page');
      pinned = p !== null && p !== '' && !Number.isNaN(Number(p)) ? Math.max(0, Math.min(PAGES - 1, Math.floor(Number(p)))) : null;
    },
    update(dt) { t += dt; },
    render(g: Gfx) {
      const c = g.ctx;
      c.fillStyle = BG;
      c.fillRect(0, 0, W, H);
      const page = pinned ?? Math.floor(t / PAGE_TIME) % PAGES;
      if (page === 0) agentsPage(g, AGENT_ROWS[0]);
      else if (page === 1) agentsPage(g, AGENT_ROWS[1]);
      else if (page === 2) propsPage(g);
      else if (page === 3) iconsPage(g);
      else framesPage(g);
      g.text.draw(`sheet ${page + 1}/${PAGES}${pinned === null ? '  (?page=n to pin)' : ''}`, W - 4, H - 4, {
        size: 3.5, color: DIM, align: 'right', shadow: null,
      });
    },
    debug() {
      return { page: pinned ?? Math.floor(t / PAGE_TIME) % PAGES, t };
    },
  };
}
