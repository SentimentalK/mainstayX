// Stage: a 320×180 canvas scaled up to fit its container (nearest neighbour),
// centred with bars, plus a blurred "bloom" copy blended with screen,
// faint scanlines and a hi-res overlay for crisp text.
import { W, H } from '../types';

export class Display {
  readonly stage: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly ui: HTMLCanvasElement;
  readonly uiCtx: CanvasRenderingContext2D;
  private bloom: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private scan: HTMLDivElement;
  private frameNo = 0;
  /** CSS px per low-res px. Integer when the viewport allows it. */
  scale = 1;
  /** Device px per low-res px on the UI overlay. */
  uiScale = 1;

  constructor(private root: HTMLElement, private bloomPx = 6, scanOpacity = 0.12) {
    this.stage = document.createElement('div');
    this.stage.className = 'stage';
    this.canvas = this.makeCanvas('main');
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.bloom = this.makeCanvas('bloom');
    this.bloomCtx = this.bloom.getContext('2d')!;
    this.bloom.setAttribute('aria-hidden', 'true');
    this.scan = document.createElement('div');
    this.scan.className = 'scan';
    this.scan.style.opacity = String(scanOpacity);
    this.ui = document.createElement('canvas');
    this.ui.className = 'ui';
    this.ui.setAttribute('aria-hidden', 'true');
    this.uiCtx = this.ui.getContext('2d')!;
    this.stage.append(this.canvas, this.bloom, this.scan, this.ui);
    root.appendChild(this.stage);
    for (const c of [this.ctx, this.bloomCtx]) c.imageSmoothingEnabled = false;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(root);
  }

  private makeCanvas(cls: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.className = cls;
    return c;
  }

  resize(): void {
    const fit = Math.min(this.root.clientWidth / W, this.root.clientHeight / H);
    if (!(fit > 0)) return;
    // Integer scale for crisp pixels, unless that would leave wide bars; at 3×
    // and up the uneven pixels of a fractional scale are hard to spot.
    const whole = Math.floor(fit);
    this.scale = whole >= 1 && whole >= fit * 0.9 ? whole : fit;
    const cw = Math.round(W * this.scale), ch = Math.round(H * this.scale);
    const s = this.stage.style;
    s.width = cw + 'px'; s.height = ch + 'px';
    s.setProperty('--px', this.scale + 'px');
    this.bloom.style.filter = `blur(${(this.bloomPx * this.scale) / 4}px) brightness(1.4)`;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    this.ui.width = Math.round(cw * dpr);
    this.ui.height = Math.round(ch * dpr);
    this.uiScale = this.scale * dpr;
  }

  /** Call after the scene rendered into ctx. Bloom refreshes every other frame. */
  present(): void {
    if ((this.frameNo++ & 1) === 0) this.bloomCtx.drawImage(this.canvas, 0, 0);
  }

  /** Low-res coordinates of a client point. */
  toLocal(clientX: number, clientY: number): { x: number; y: number; inside: boolean } {
    const r = this.stage.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    const y = ((clientY - r.top) / r.height) * H;
    return { x, y, inside: x >= 0 && y >= 0 && x < W && y < H };
  }
}
