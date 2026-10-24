// Stage: a 320×180 canvas scaled up by an integer factor (nearest neighbour),
// centred with black bars, plus a blurred "bloom" copy blended with screen,
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

  constructor(root: HTMLElement, private bloomPx = 6, scanOpacity = 0.12) {
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
    addEventListener('resize', () => this.resize());
  }

  private makeCanvas(cls: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.className = cls;
    return c;
  }

  resize(): void {
    const vw = innerWidth, vh = innerHeight;
    const fit = Math.min(vw / W, vh / H);
    // Integer scale for crisp pixels; below 1× (tiny phones) fall back to fractional.
    this.scale = fit >= 1 ? Math.floor(fit) : fit;
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
