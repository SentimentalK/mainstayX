// Crisp Silkscreen text and speech bubbles drawn on the hi-res overlay.
// Callers think in low-res px; this layer converts to device px and snaps
// the font size to Silkscreen's 8-unit grid so glyph pixels stay square.
import type { BubbleStyle, Rect, TextLayer, TextStyle } from '../types';
import { W, H } from '../types';

export const FONT = "'Silkscreen', ui-monospace, monospace";

export class Text implements TextLayer {
  private ctx: CanvasRenderingContext2D;
  private k = 1;
  private ox = 0;
  private oy = 0;
  private widthCache = new Map<string, number>();
  private lastFont = '';

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Start a frame: clear and set the scale (device px per low-res px) and shake offset. */
  begin(k: number, ox: number, oy: number): void {
    if (k !== this.k) this.widthCache.clear();
    this.k = k; this.ox = ox; this.oy = oy;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.lastFont = '';
  }

  /** Font loading changes metrics. */
  invalidate(): void {
    this.widthCache.clear();
  }

  private fontPx(size: number): number {
    const d = size * this.k;
    return d >= 12 ? Math.max(8, Math.round(d / 8) * 8) : Math.max(6, Math.round(d));
  }

  private setFont(size: number): number {
    const p = this.fontPx(size);
    const f = `${p}px ${FONT}`;
    if (f !== this.lastFont) { this.ctx.font = f; this.lastFont = f; }
    return p;
  }

  measure(str: string, size = 5): number {
    const key = size + '|' + str;
    let w = this.widthCache.get(key);
    if (w === undefined) {
      this.setFont(size);
      w = this.ctx.measureText(str).width / this.k;
      this.widthCache.set(key, w);
    }
    return w;
  }

  draw(str: string, x: number, y: number, s: TextStyle = {}): void {
    if (!str) return;
    const ctx = this.ctx, k = this.k;
    const size = s.size ?? 5;
    const a = s.alpha ?? 1;
    if (a <= 0) return;
    const p = this.setFont(size);
    ctx.textAlign = s.align ?? 'center';
    ctx.textBaseline = s.baseline ?? 'middle';
    ctx.globalAlpha = a;
    const dx = Math.round((x + this.ox) * k), dy = Math.round((y + this.oy) * k);
    const rot = s.rotate ?? 0;
    if (rot) { ctx.save(); ctx.translate(dx, dy); ctx.rotate(rot); }
    const bx = rot ? 0 : dx, by = rot ? 0 : dy;
    const sh = s.shadow === undefined ? '#000000' : s.shadow;
    const step = Math.max(1, Math.round(p / 8));
    if (sh) { ctx.fillStyle = sh; ctx.fillText(str, bx + step, by + step); }
    if (s.glow) { ctx.shadowColor = s.glow; ctx.shadowBlur = 2 * k; }
    ctx.fillStyle = s.color ?? '#ffe6f7';
    ctx.fillText(str, bx, by);
    if (s.glow) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
    if (rot) ctx.restore();
    ctx.globalAlpha = 1;
  }

  bubble(str: string, x: number, y: number, s: BubbleStyle = {}): Rect {
    const size = s.size ?? 4.5;
    const tw = this.measure(str, size);
    const w = Math.ceil(tw) + 5, h = Math.ceil(size * 0.75) + 4;
    const tail = s.tail ?? true;
    const tailH = tail ? 3 : 0;
    let bx = Math.round(x - w / 2), by = Math.round(y - tailH - h);
    bx = Math.max(1, Math.min(W - w - 1, bx));
    by = Math.max(1, Math.min(H - h - 1, by));
    const a = s.alpha ?? 1;
    if (a <= 0) return { x: bx, y: by, w, h };
    const ctx = this.ctx, k = this.k;
    const R = (rx: number, ry: number, rw: number, rh: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round((rx + this.ox) * k), Math.round((ry + this.oy) * k), Math.round(rw * k), Math.round(rh * k));
    };
    const bg = s.bg ?? '#ffe6f7', border = s.border ?? '#0d0221';
    ctx.globalAlpha = a;
    // border with clipped corners, then fill
    R(bx, by - 1, w, h + 2, border);
    R(bx - 1, by, w + 2, h, border);
    R(bx, by, w, h, bg);
    if (tail) {
      const tx = Math.round(Math.max(bx + 2, Math.min(bx + w - 3, x)));
      R(tx - 2, by + h, 4, 1, border);
      R(tx - 1, by + h, 2, 1, bg);
      R(tx - 1, by + h + 1, 2, 1, border);
      R(tx, by + h + 1, 1, 1, bg);
      R(tx, by + h + 2, 1, 1, border);
    }
    ctx.globalAlpha = 1;
    this.draw(str, bx + w / 2, by + h / 2 + 0.5, { size, color: s.color ?? '#0d0221', shadow: null, alpha: a });
    return { x: bx, y: by, w, h };
  }
}
